import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'finance.db');

// Ensure the directory exists before opening the database
const dbDir = path.dirname(dbPath);
try {
  mkdirSync(dbDir, { recursive: true });
} catch (e) {
  // Directory already exists or can't be created - will fail on db open if issue
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Auto-initialize database tables on first load
export function initDatabase() {
  // Create accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      institution TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      goal_id INTEGER,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES savings_goals (id)
    )
  `);

  // Add goal_id column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN goal_id INTEGER REFERENCES savings_goals(id)`);
  } catch (e) {
    // Column already exists, ignore error
  }

  // Create imports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      institution TEXT NOT NULL,
      account_type TEXT NOT NULL,
      account_id INTEGER,
      goal_id INTEGER,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      FOREIGN KEY (account_id) REFERENCES accounts (id),
      FOREIGN KEY (goal_id) REFERENCES savings_goals (id)
    )
  `);

  // Create transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      import_id INTEGER,
      date DATETIME NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts (id),
      FOREIGN KEY (import_id) REFERENCES imports (id) ON DELETE CASCADE
    )
  `);

  // Add import_id column to transactions if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE transactions ADD COLUMN import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE`);
  } catch (e) {
    // Column already exists, ignore error
  }

  // Migrate existing transactions: create import records for existing data
  const unmappedTransactions = db.prepare(`
    SELECT t.account_id, a.institution, a.type, COUNT(*) as count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.import_id IS NULL
    GROUP BY t.account_id
  `).all() as Array<{ account_id: number; institution: string; type: string; count: number }>;

  for (const group of unmappedTransactions) {
    const importRecord = db.prepare(`
      INSERT INTO imports (filename, institution, account_type, account_id, goal_id, imported_at, transaction_count, status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `).run(
      'Legacy Import',
      group.institution,
      group.type,
      group.account_id,
      null,
      group.count,
      'success'
    );

    const importId = importRecord.lastInsertRowid;

    // Link all transactions from this account to the import
    db.prepare(`
      UPDATE transactions
      SET import_id = ?
      WHERE account_id = ? AND import_id IS NULL
    `).run(importId, group.account_id);
  }

  // Create zcash_sources table (replaces zcash_holdings for multi-source tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS zcash_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL UNIQUE,
      zec_amount REAL NOT NULL DEFAULT 0,
      cost_basis_usd REAL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create zcash_snapshots table for historical tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS zcash_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date DATE NOT NULL UNIQUE,
      price_usd REAL NOT NULL,
      total_zec REAL NOT NULL,
      total_value_usd REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create zcash_price_cache table for API caching
  db.exec(`
    CREATE TABLE IF NOT EXISTS zcash_price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_usd REAL NOT NULL,
      change_24h REAL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate from old zcash_holdings to zcash_sources if needed
  try {
    const oldHoldings = db.prepare('SELECT total_zec, cost_basis_usd FROM zcash_holdings WHERE id = 1')
      .get() as { total_zec: number; cost_basis_usd: number | null } | undefined;

    if (oldHoldings && oldHoldings.total_zec > 0) {
      // Check if sources are empty
      const sourcesCount = db.prepare('SELECT COUNT(*) as count FROM zcash_sources').get() as { count: number };
      if (sourcesCount.count === 0) {
        // Migrate old data to "Wallet" source
        db.prepare('INSERT INTO zcash_sources (source_name, zec_amount, cost_basis_usd) VALUES (?, ?, ?)')
          .run('Wallet', oldHoldings.total_zec, oldHoldings.cost_basis_usd);
      }
    }
  } catch (e) {
    // Table doesn't exist or migration already done
  }

  // Seed default zcash sources if empty
  const existingSources = db.prepare('SELECT COUNT(*) as count FROM zcash_sources').get() as { count: number };
  if (existingSources.count === 0) {
    const insertSource = db.prepare('INSERT INTO zcash_sources (source_name, zec_amount, cost_basis_usd) VALUES (?, ?, ?)');
    insertSource.run('Wallet', 0, null);
    insertSource.run('Coinbase', 0, null);
  }

  // Create savings_goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0
    )
  `);

  // Seed savings goals if they don't exist
  const existingGoals = db.prepare('SELECT COUNT(*) as count FROM savings_goals').get() as { count: number };

  if (existingGoals.count === 0) {
    const insertGoal = db.prepare('INSERT INTO savings_goals (name, target_amount, current_amount) VALUES (?, ?, ?)');
    insertGoal.run('House', 100000, 0);
    insertGoal.run('Life', 30000, 0);
  }

  // Add deadline column to savings_goals if it doesn't exist
  try {
    db.exec(`ALTER TABLE savings_goals ADD COLUMN deadline DATE`);
    // Set default deadlines for existing goals
    db.prepare(`UPDATE savings_goals SET deadline = '2027-12-31' WHERE name = 'House' AND deadline IS NULL`).run();
    db.prepare(`UPDATE savings_goals SET deadline = '2026-06-30' WHERE name = 'Life' AND deadline IS NULL`).run();
  } catch (e) {
    // Column already exists
  }

  // Create daily_briefings cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      briefing_json TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create data_changes table for tracking all data modifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      affected_accounts TEXT,
      affected_months TEXT,
      metadata TEXT,
      processed INTEGER DEFAULT 0
    )
  `);

  // Create index for efficient timestamp queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_data_changes_timestamp ON data_changes(timestamp)
  `);

  // Create system_state table for tracking staleness and other state
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )
  `);

  // Add spending_category column to transactions if it doesn't exist
  try {
    db.exec(`ALTER TABLE transactions ADD COLUMN spending_category TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Create merchant_patterns table for learned categorizations
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchant_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      merchant_name TEXT,
      source TEXT DEFAULT 'auto',
      confidence TEXT DEFAULT 'high',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);

  // Create index for pattern lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_merchant_patterns_pattern ON merchant_patterns(pattern)
  `);

  // Create recurring_expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_pattern TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      category TEXT,
      expense_type TEXT NOT NULL,
      frequency TEXT NOT NULL,
      typical_amount REAL,
      amount_variance REAL,
      occurrence_count INTEGER DEFAULT 0,
      first_occurrence_date TEXT,
      last_occurrence_date TEXT,
      last_amount REAL,
      next_predicted_date TEXT,
      next_predicted_amount REAL,
      prediction_confidence REAL,
      confidence TEXT DEFAULT 'medium',
      detected_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      user_confirmed INTEGER DEFAULT 0,
      user_excluded INTEGER DEFAULT 0,
      tracked INTEGER DEFAULT 1
    )
  `);

  // Create normalized_date column on transactions if it doesn't exist
  try {
    db.exec(`ALTER TABLE transactions ADD COLUMN normalized_date TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Create zcash_purchases table for tracking purchase history
  db.exec(`
    CREATE TABLE IF NOT EXISTS zcash_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_date TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      amount_zec REAL,
      price_per_zec REAL,
      source TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

// Initialize tables on module load
initDatabase();

export { initDatabase };
export default db;
