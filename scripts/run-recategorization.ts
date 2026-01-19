import db from '../lib/db';
import { categorizeTransaction, getAccountType, type CategorizationResult } from '../lib/accounting/controller';

type Transaction = {
  id: number;
  account_id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  normalized_date: string;
};

type AccountInfo = {
  id: number;
  name: string;
};

/**
 * Run bulk recategorization on all transactions
 */
export function runRecategorization() {
  console.log('='.repeat(120));
  console.log('BULK RECATEGORIZATION - Running on All Transactions');
  console.log('='.repeat(120));
  console.log();

  const accounts = db.prepare('SELECT id, name FROM accounts').all() as AccountInfo[];

  let totalProcessed = 0;
  let totalUpdated = 0;

  // Prepare update statement
  const updateStmt = db.prepare('UPDATE transactions SET category = ? WHERE id = ?');

  // Use transaction for bulk update
  const bulkUpdate = db.transaction((updates: Array<{ id: number; category: string }>) => {
    for (const update of updates) {
      updateStmt.run(update.category, update.id);
    }
  });

  const updates: Array<{ id: number; category: string }> = [];

  for (const account of accounts) {
    const accountType = getAccountType(account.id);
    if (!accountType) {
      console.log(`⚠️  Skipping ${account.name} - unknown account type`);
      continue;
    }

    // Get all transactions from this account
    const transactions = db.prepare(`
      SELECT id, account_id, date, amount, description, category, normalized_date
      FROM transactions
      WHERE account_id = ?
    `).all(account.id) as Transaction[];

    console.log(`Processing ${account.name}: ${transactions.length} transactions...`);

    for (const txn of transactions) {
      const oldCategory = txn.category;
      const result: CategorizationResult = categorizeTransaction(
        txn.description,
        txn.amount,
        accountType,
        account.name
      );
      const newCategory = result.category;

      totalProcessed++;

      if (oldCategory !== newCategory) {
        updates.push({ id: txn.id, category: newCategory });
        totalUpdated++;
      }
    }
  }

  console.log();
  console.log(`Total transactions processed: ${totalProcessed}`);
  console.log(`Total transactions to update: ${totalUpdated}`);
  console.log();
  console.log('Running bulk update...');

  // Execute bulk update in transaction
  bulkUpdate(updates);

  console.log('✓ Bulk update completed successfully!');
  console.log();
}

// Run the recategorization
runRecategorization();
