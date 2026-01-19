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
 * Test recategorization on sample transactions from each account
 */
export function testRecategorization() {
  // Get all accounts
  const accounts = db.prepare('SELECT id, name FROM accounts').all() as AccountInfo[];

  console.log('='.repeat(120));
  console.log('SAMPLE RECATEGORIZATION TEST');
  console.log('='.repeat(120));
  console.log();

  const changeSummary: Record<string, number> = {};

  for (const account of accounts) {
    const accountType = getAccountType(account.id);
    if (!accountType) {
      console.log(`⚠️  Skipping ${account.name} - unknown account type`);
      continue;
    }

    // Get 20 sample transactions from this account
    const transactions = db.prepare(`
      SELECT id, account_id, date, amount, description, category, normalized_date
      FROM transactions
      WHERE account_id = ?
      ORDER BY normalized_date DESC
      LIMIT 20
    `).all(account.id) as Transaction[];

    console.log(`\n## ${account.name} (${accountType.toUpperCase()})`);
    console.log('-'.repeat(120));
    console.log();

    if (transactions.length === 0) {
      console.log('No transactions found.');
      continue;
    }

    // Test each transaction
    for (const txn of transactions) {
      const oldCategory = txn.category;
      const result: CategorizationResult = categorizeTransaction(
        txn.description,
        txn.amount,
        accountType,
        account.name
      );
      const newCategory = result.category;

      // Track changes for summary
      const changeKey = `${oldCategory} → ${newCategory}`;
      if (!changeSummary[changeKey]) {
        changeSummary[changeKey] = 0;
      }
      if (oldCategory !== newCategory) {
        changeSummary[changeKey]++;
      }

      // Only show if category changed or low confidence
      const showChange = oldCategory !== newCategory;
      const showIcon = showChange ? '🔄' : '✓';

      if (showChange || result.confidence === 'low') {
        console.log(`${showIcon} ${txn.normalized_date} | $${txn.amount.toFixed(2).padStart(10)}`);
        console.log(`   ${txn.description.substring(0, 80)}`);
        console.log(`   OLD: ${oldCategory.padEnd(20)} → NEW: ${newCategory.padEnd(20)} [${result.confidence}]`);
        console.log(`   REASON: ${result.reason}`);
        console.log();
      }
    }
  }

  // Print change summary
  console.log('\n' + '='.repeat(120));
  console.log('EXPECTED CHANGE SUMMARY');
  console.log('='.repeat(120));
  console.log();

  const totalChanges = Object.values(changeSummary).reduce((sum, count) => sum + count, 0);
  console.log(`Total transactions that will change category: ${totalChanges}`);
  console.log();

  // Sort by count descending
  const sortedChanges = Object.entries(changeSummary)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  console.log('Category Changes:');
  console.log('-'.repeat(80));
  for (const [change, count] of sortedChanges) {
    console.log(`${change.padEnd(60)} ${count.toString().padStart(5)} transactions`);
  }
  console.log();
}

// Run the test
testRecategorization();
