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
 * Analyze all transactions and show expected changes
 */
export function analyzeAllChanges() {
  console.log('='.repeat(120));
  console.log('FULL RECATEGORIZATION ANALYSIS (All 1,150+ Transactions)');
  console.log('='.repeat(120));
  console.log();

  // Get all accounts
  const accounts = db.prepare('SELECT id, name FROM accounts').all() as AccountInfo[];

  const changeSummary: Record<string, number> = {};
  const accountSummary: Record<string, { total: number; changed: number; byOldCategory: Record<string, number> }> = {};

  let totalTransactions = 0;
  let totalChanged = 0;

  for (const account of accounts) {
    const accountType = getAccountType(account.id);
    if (!accountType) {
      continue;
    }

    accountSummary[account.name] = {
      total: 0,
      changed: 0,
      byOldCategory: {},
    };

    // Get ALL transactions from this account
    const transactions = db.prepare(`
      SELECT id, account_id, date, amount, description, category, normalized_date
      FROM transactions
      WHERE account_id = ?
    `).all(account.id) as Transaction[];

    accountSummary[account.name].total = transactions.length;
    totalTransactions += transactions.length;

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

      // Track by old category for this account
      if (!accountSummary[account.name].byOldCategory[oldCategory]) {
        accountSummary[account.name].byOldCategory[oldCategory] = 0;
      }
      accountSummary[account.name].byOldCategory[oldCategory]++;

      // Track changes
      if (oldCategory !== newCategory) {
        const changeKey = `${oldCategory} → ${newCategory}`;
        if (!changeSummary[changeKey]) {
          changeSummary[changeKey] = 0;
        }
        changeSummary[changeKey]++;
        accountSummary[account.name].changed++;
        totalChanged++;
      }
    }
  }

  // Print account summary
  console.log('## Summary by Account');
  console.log('-'.repeat(120));
  console.log();
  console.log('Account'.padEnd(30) + 'Total Txns'.padStart(15) + 'Will Change'.padStart(15) + '% Changed'.padStart(15));
  console.log('-'.repeat(75));

  for (const [accountName, summary] of Object.entries(accountSummary)) {
    const pctChanged = summary.total > 0 ? ((summary.changed / summary.total) * 100).toFixed(1) : '0.0';
    console.log(
      accountName.padEnd(30) +
      summary.total.toString().padStart(15) +
      summary.changed.toString().padStart(15) +
      `${pctChanged}%`.padStart(15)
    );
  }

  console.log('-'.repeat(75));
  const overallPct = totalTransactions > 0 ? ((totalChanged / totalTransactions) * 100).toFixed(1) : '0.0';
  console.log(
    'TOTAL'.padEnd(30) +
    totalTransactions.toString().padStart(15) +
    totalChanged.toString().padStart(15) +
    `${overallPct}%`.padStart(15)
  );

  console.log();
  console.log();

  // Print current category distribution
  console.log('## Current Category Distribution (Before Recategorization)');
  console.log('-'.repeat(120));
  console.log();

  const currentCategories: Record<string, number> = {};
  for (const summary of Object.values(accountSummary)) {
    for (const [category, count] of Object.entries(summary.byOldCategory)) {
      if (!currentCategories[category]) {
        currentCategories[category] = 0;
      }
      currentCategories[category] += count;
    }
  }

  const sortedCurrent = Object.entries(currentCategories).sort((a, b) => b[1] - a[1]);
  console.log('Category'.padEnd(30) + 'Count'.padStart(15) + 'Percentage'.padStart(15));
  console.log('-'.repeat(60));
  for (const [category, count] of sortedCurrent) {
    const pct = ((count / totalTransactions) * 100).toFixed(1);
    console.log(category.padEnd(30) + count.toString().padStart(15) + `${pct}%`.padStart(15));
  }

  console.log();
  console.log();

  // Print expected changes
  console.log('## Expected Category Changes');
  console.log('-'.repeat(120));
  console.log();

  const sortedChanges = Object.entries(changeSummary).sort((a, b) => b[1] - a[1]);

  console.log('Change'.padEnd(60) + 'Count'.padStart(15) + 'Percentage'.padStart(15));
  console.log('-'.repeat(90));

  for (const [change, count] of sortedChanges) {
    const pct = ((count / totalChanged) * 100).toFixed(1);
    console.log(change.padEnd(60) + count.toString().padStart(15) + `${pct}%`.padStart(15));
  }

  console.log();
  console.log();

  // Print key insights
  console.log('## Key Insights');
  console.log('-'.repeat(120));
  console.log();

  if (currentCategories['other_income']) {
    console.log(`✓ Will eliminate ${currentCategories['other_income']} "other_income" transactions`);
  }
  if (changeSummary['other_income → credit_reward']) {
    console.log(`✓ Will properly categorize ${changeSummary['other_income → credit_reward']} credit rewards/interest`);
  }
  if (changeSummary['other_income → savings_transfer']) {
    console.log(`✓ Will properly categorize ${changeSummary['other_income → savings_transfer']} savings deposits`);
  }
  if (changeSummary['other_income → tax_refund']) {
    console.log(`✓ Will separate ${changeSummary['other_income → tax_refund']} tax refunds from income`);
  }
  if (changeSummary['other_income → transfer_in']) {
    console.log(`✓ Will properly categorize ${changeSummary['other_income → transfer_in']} transfers from savings`);
  }
  if (changeSummary['expense → credit_payment']) {
    console.log(`✓ Will reclassify ${changeSummary['expense → credit_payment']} credit payments (not expenses)`);
  }

  console.log();
  console.log(`Overall: ${totalChanged} of ${totalTransactions} transactions (${overallPct}%) will change category.`);
  console.log();
}

// Run the analysis
analyzeAllChanges();
