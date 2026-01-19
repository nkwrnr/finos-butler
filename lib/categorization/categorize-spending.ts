import db from '../db';
import { matchMerchant } from './merchant-intelligence';
import { categorizeBatchWithLLM } from './llm-categorizer';
import { CategorizationStats, SpendingCategory } from './types';

interface Transaction {
  id: number;
  description: string;
  amount: number;
}

interface MerchantPattern {
  pattern: string;
  category: string;
  merchant_name: string;
}

/**
 * Categorize all uncategorized expenses
 */
export async function categorizeAllSpending(): Promise<CategorizationStats> {
  const stats: CategorizationStats = {
    total: 0,
    byRule: 0,
    byLLM: 0,
    alreadyCategorized: 0,
    failed: 0
  };

  // Get all uncategorized expenses
  const expenses = db.prepare(`
    SELECT t.id, t.description, t.amount
    FROM transactions t
    WHERE t.category = 'expense'
    AND (t.spending_category IS NULL OR t.spending_category = '' OR t.spending_category = 'uncategorized')
  `).all() as Transaction[];

  stats.total = expenses.length;

  if (expenses.length === 0) {
    return stats;
  }

  // Load user overrides from database
  const overrides = db.prepare('SELECT pattern, category, merchant_name FROM merchant_patterns').all() as MerchantPattern[];
  const overrideMap = new Map(overrides.map(o => [o.pattern.toLowerCase(), { category: o.category, name: o.merchant_name }]));

  const needsLLM: Transaction[] = [];

  // First pass: Rule-based categorization
  for (const tx of expenses) {
    const descLower = tx.description.toLowerCase();

    // Check user overrides first
    let matched = false;
    for (const [pattern, result] of overrideMap) {
      if (descLower.includes(pattern)) {
        db.prepare(
          'UPDATE transactions SET spending_category = ? WHERE id = ?'
        ).run(result.category, tx.id);
        stats.byRule++;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Check built-in merchant rules
    const merchantMatch = matchMerchant(tx.description);
    if (merchantMatch) {
      db.prepare(
        'UPDATE transactions SET spending_category = ? WHERE id = ?'
      ).run(merchantMatch.category, tx.id);
      stats.byRule++;
      continue;
    }

    // Needs LLM
    needsLLM.push(tx);
  }

  // Second pass: LLM categorization for unknowns (batches of 25)
  for (let i = 0; i < needsLLM.length; i += 25) {
    const batch = needsLLM.slice(i, i + 25);

    try {
      const results = await categorizeBatchWithLLM(batch);

      for (const [id, result] of results) {
        db.prepare(
          'UPDATE transactions SET spending_category = ? WHERE id = ?'
        ).run(result.category, id);

        // Learn from LLM categorization (save pattern for future)
        const tx = batch.find(t => t.id === id);
        if (tx && result.confidence === 'high') {
          const pattern = tx.description.toLowerCase().slice(0, 30).trim();
          try {
            db.prepare(`
              INSERT OR IGNORE INTO merchant_patterns (pattern, category, merchant_name, source, created_at)
              VALUES (?, ?, ?, 'llm', datetime('now'))
            `).run(pattern, result.category, result.merchantName);
          } catch (e) {
            // Ignore duplicate pattern errors
          }
        }

        stats.byLLM++;
      }

      // Rate limit: wait between batches
      if (i + 25 < needsLLM.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error('LLM batch error:', e);
      stats.failed += batch.length;
    }
  }

  return stats;
}

/**
 * Get spending breakdown by category for a time period
 */
export function getSpendingByCategory(months: number = 1): {
  category: SpendingCategory;
  total: number;
  count: number;
}[] {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const startDateStr = startDate.toISOString().split('T')[0];

  const results = db.prepare(`
    SELECT
      COALESCE(spending_category, 'uncategorized') as category,
      COUNT(*) as count,
      SUM(ABS(amount)) as total
    FROM transactions
    WHERE category = 'expense'
    AND normalized_date >= ?
    GROUP BY spending_category
    ORDER BY total DESC
  `).all(startDateStr) as { category: SpendingCategory; count: number; total: number }[];

  return results;
}

/**
 * Get count of uncategorized expenses
 */
export function getUncategorizedCount(): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM transactions
    WHERE category = 'expense'
    AND (spending_category IS NULL OR spending_category = '' OR spending_category = 'uncategorized')
  `).get() as { count: number };

  return result.count;
}

/**
 * Manually categorize a single transaction
 */
export function categorizeTransaction(
  transactionId: number,
  category: SpendingCategory,
  learnPattern: boolean = true
): void {
  // Update transaction
  db.prepare(
    'UPDATE transactions SET spending_category = ? WHERE id = ?'
  ).run(category, transactionId);

  // Learn from correction
  if (learnPattern) {
    const tx = db.prepare('SELECT description FROM transactions WHERE id = ?').get(transactionId) as { description: string } | undefined;
    if (tx) {
      const pattern = tx.description.toLowerCase().slice(0, 30).trim();
      db.prepare(`
        INSERT OR REPLACE INTO merchant_patterns (pattern, category, merchant_name, source, updated_at)
        VALUES (?, ?, '', 'user', datetime('now'))
      `).run(pattern, category);
    }
  }
}

/**
 * Get sample uncategorized transactions for review
 */
export function getSampleUncategorized(limit: number = 20): Transaction[] {
  return db.prepare(`
    SELECT id, description, amount
    FROM transactions
    WHERE category = 'expense'
    AND (spending_category IS NULL OR spending_category = '' OR spending_category = 'uncategorized')
    ORDER BY ABS(amount) DESC
    LIMIT ?
  `).all(limit) as Transaction[];
}
