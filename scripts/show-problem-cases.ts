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
 * Show specific problem cases that need attention
 */
export function showProblemCases() {
  console.log('='.repeat(120));
  console.log('PROBLEM CASES - Transactions Going to "uncategorized"');
  console.log('='.repeat(120));
  console.log();

  const accounts = db.prepare('SELECT id, name FROM accounts').all() as AccountInfo[];

  const uncategorizedSamples: Array<{
    account: string;
    accountType: string;
    date: string;
    amount: number;
    description: string;
    oldCategory: string;
    reason: string;
  }> = [];

  const uncategorizedByPattern: Record<string, number> = {};

  for (const account of accounts) {
    const accountType = getAccountType(account.id);
    if (!accountType) continue;

    const transactions = db.prepare(`
      SELECT id, account_id, date, amount, description, category, normalized_date
      FROM transactions
      WHERE account_id = ?
    `).all(account.id) as Transaction[];

    for (const txn of transactions) {
      const result: CategorizationResult = categorizeTransaction(
        txn.description,
        txn.amount,
        accountType,
        account.name
      );

      if (result.category === 'uncategorized') {
        uncategorizedSamples.push({
          account: account.name,
          accountType: accountType,
          date: txn.normalized_date,
          amount: txn.amount,
          description: txn.description,
          oldCategory: txn.category,
          reason: result.reason,
        });

        // Pattern grouping
        const normalizedDesc = txn.description.toLowerCase().replace(/\d+/g, '').trim().substring(0, 30);
        if (!uncategorizedByPattern[normalizedDesc]) {
          uncategorizedByPattern[normalizedDesc] = 0;
        }
        uncategorizedByPattern[normalizedDesc]++;
      }
    }
  }

  console.log(`Found ${uncategorizedSamples.length} transactions that will be marked "uncategorized"`);
  console.log();
  console.log();

  console.log('## Pattern Analysis - Most Common Uncategorized Descriptions');
  console.log('-'.repeat(120));
  console.log();

  const sortedPatterns = Object.entries(uncategorizedByPattern).sort((a, b) => b[1] - a[1]).slice(0, 20);

  console.log('Description Pattern'.padEnd(50) + 'Count'.padStart(15));
  console.log('-'.repeat(65));
  for (const [pattern, count] of sortedPatterns) {
    console.log(pattern.padEnd(50) + count.toString().padStart(15));
  }

  console.log();
  console.log();

  console.log('## Sample Uncategorized Transactions (First 30)');
  console.log('-'.repeat(120));
  console.log();

  for (let i = 0; i < Math.min(30, uncategorizedSamples.length); i++) {
    const sample = uncategorizedSamples[i];
    console.log(`${sample.date} | ${sample.account} (${sample.accountType})`);
    console.log(`  Amount: $${sample.amount.toFixed(2)} | Old: ${sample.oldCategory}`);
    console.log(`  Description: ${sample.description}`);
    console.log(`  Reason: ${sample.reason}`);
    console.log();
  }

  console.log();
  console.log('## Recommendations');
  console.log('-'.repeat(120));
  console.log();
  console.log('These transactions need additional rules or manual review:');
  console.log('1. Add rules for common patterns (like "PAYMENT THANK YOU" variants)');
  console.log('2. Review and manually categorize unique one-off transactions');
  console.log('3. Consider adding merchant-specific rules');
  console.log();
}

// Run the analysis
showProblemCases();
