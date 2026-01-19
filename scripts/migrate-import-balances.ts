import db from '../lib/db';
import { parsePDF, parseCSV } from '../lib/parsers';
import { promises as fs } from 'fs';
import path from 'path';

async function migrateImportBalances() {
  console.log('Starting migration of import balances...');

  // Get all imports that need balance data
  const imports = db.prepare(`
    SELECT id, filename, account_id
    FROM imports
    WHERE statement_ending_balance IS NULL
  `).all() as { id: number; filename: string; account_id: number }[];

  console.log(`Found ${imports.length} imports to migrate`);

  const statementsPath = '/Users/the_machine/app/finance/Statements';
  let updated = 0;
  let failed = 0;

  for (const imp of imports) {
    try {
      // Try to find the file
      const possiblePaths = [
        path.join(statementsPath, imp.filename),
        path.join(statementsPath, 'WellsFargo', imp.filename),
        path.join(statementsPath, 'Chase', imp.filename),
        path.join(statementsPath, 'Ally/House', imp.filename),
        path.join(statementsPath, 'Ally/Life', imp.filename),
        path.join(statementsPath, 'Bilt', imp.filename),
        path.join(statementsPath, 'Gemini', imp.filename),
      ];

      let filePath: string | null = null;
      for (const p of possiblePaths) {
        try {
          await fs.access(p);
          filePath = p;
          break;
        } catch {
          continue;
        }
      }

      if (!filePath) {
        console.log(`  ⚠️  File not found: ${imp.filename}`);
        failed++;
        continue;
      }

      // Parse the file
      const fileBuffer = await fs.readFile(filePath);
      const fileExt = path.extname(filePath).toLowerCase();

      let parseResult;
      if (fileExt === '.csv') {
        parseResult = await parseCSV(fileBuffer);
      } else if (fileExt === '.pdf') {
        parseResult = await parsePDF(fileBuffer);
      } else {
        console.log(`  ⚠️  Unsupported file type: ${imp.filename}`);
        failed++;
        continue;
      }

      const { balance } = parseResult;

      // Extract statement date from filename
      let statementDate: string | null = null;

      // Pattern 1: YYYYMMDD format (e.g., 20251228)
      let dateMatch = imp.filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
      if (dateMatch) {
        statementDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      } else {
        // Pattern 2: MMDDYY format (e.g., 123125 = Dec 31, 2025)
        const shortDateMatch = imp.filename.match(/(\d{2})(\d{2})(\d{2})/);
        if (shortDateMatch) {
          const mm = shortDateMatch[1];
          const dd = shortDateMatch[2];
          const yy = shortDateMatch[3];
          // Assume 20XX for years 00-99
          const yyyy = `20${yy}`;
          statementDate = `${yyyy}-${mm}-${dd}`;
        }
      }

      // Update the import record
      db.prepare(`
        UPDATE imports
        SET statement_ending_balance = ?,
            statement_date = ?
        WHERE id = ?
      `).run(balance || null, statementDate, imp.id);

      if (balance) {
        console.log(`  ✓ ${imp.filename}: Balance = $${balance.toFixed(2)}, Date = ${statementDate}`);
        updated++;
      } else {
        console.log(`  ⚠️  ${imp.filename}: No balance found, Date = ${statementDate}`);
        updated++;
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${imp.filename}:`, error);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${updated} updated, ${failed} failed`);

  // Now update account balances based on most recent statements
  const accounts = db.prepare('SELECT id, name FROM accounts').all() as { id: number; name: string }[];

  console.log(`\nUpdating ${accounts.length} account balances...`);

  for (const account of accounts) {
    const mostRecentImport = db.prepare(`
      SELECT statement_ending_balance, statement_date, filename
      FROM imports
      WHERE account_id = ? AND statement_ending_balance IS NOT NULL
      ORDER BY statement_date DESC, imported_at DESC
      LIMIT 1
    `).get(account.id) as { statement_ending_balance: number; statement_date: string; filename: string } | undefined;

    if (mostRecentImport) {
      db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
        .run(mostRecentImport.statement_ending_balance, account.id);

      console.log(`  ✓ ${account.name}: $${mostRecentImport.statement_ending_balance.toFixed(2)} (from ${mostRecentImport.filename})`);
    } else {
      console.log(`  ⚠️  ${account.name}: No statement balance found`);
    }
  }
}

migrateImportBalances().catch(console.error);
