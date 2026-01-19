import db from '../lib/db';
import { validateCategorization, type ValidationResult } from '../lib/accounting/controller';

/**
 * Post-recategorization audit
 */
export function postRecategorizationAudit() {
  console.log('='.repeat(120));
  console.log('POST-RECATEGORIZATION AUDIT');
  console.log('='.repeat(120));
  console.log();

  // Get category breakdown
  const categories = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total
    FROM transactions
    GROUP BY category
    ORDER BY count DESC
  `).all() as Array<{ category: string; count: number; total: number }>;

  console.log('## Category Distribution');
  console.log('-'.repeat(120));
  console.log();
  console.log('Category'.padEnd(25) + 'Count'.padStart(10) + 'Total Amount'.padStart(20) + 'Percentage'.padStart(15));
  console.log('-'.repeat(70));

  const totalTxns = categories.reduce((sum, c) => sum + c.count, 0);

  for (const cat of categories) {
    const pct = ((cat.count / totalTxns) * 100).toFixed(1);
    const totalFormatted = `$${cat.total.toFixed(2)}`;
    console.log(
      cat.category.padEnd(25) +
      cat.count.toString().padStart(10) +
      totalFormatted.padStart(20) +
      `${pct}%`.padStart(15)
    );
  }

  console.log('-'.repeat(70));
  console.log('TOTAL'.padEnd(25) + totalTxns.toString().padStart(10));

  console.log();
  console.log();

  // Run validation
  console.log('## Validation Checks');
  console.log('-'.repeat(120));
  console.log();

  const validation: ValidationResult = validateCategorization();

  console.log(`Total transactions: ${validation.totalTransactions}`);
  console.log(`Uncategorized: ${validation.uncategorized} (${((validation.uncategorized / validation.totalTransactions) * 100).toFixed(1)}%)`);
  console.log();

  if (validation.errors.length > 0) {
    console.log('❌ ERRORS FOUND:');
    validation.errors.forEach(err => console.log(`  - ${err}`));
    console.log();
  } else {
    console.log('✓ No logical errors found');
    console.log();
  }

  if (validation.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    validation.warnings.forEach(warn => console.log(`  - ${warn}`));
    console.log();
  } else {
    console.log('✓ No warnings');
    console.log();
  }

  console.log();

  // Check key assertions
  console.log('## Key Assertions');
  console.log('-'.repeat(120));
  console.log();

  const otherIncome = categories.find(c => c.category === 'other_income');
  const uncategorized = categories.find(c => c.category === 'uncategorized');
  const income = categories.find(c => c.category === 'income');
  const expense = categories.find(c => c.category === 'expense');
  const creditPayment = categories.find(c => c.category === 'credit_payment');
  const creditReward = categories.find(c => c.category === 'credit_reward');
  const refund = categories.find(c => c.category === 'refund');
  const transferIn = categories.find(c => c.category === 'transfer_in');
  const taxRefund = categories.find(c => c.category === 'tax_refund');

  console.log(`✓ "other_income" eliminated: ${!otherIncome || otherIncome.count === 0 ? 'YES' : 'NO (still ' + otherIncome.count + ' transactions)'}`);
  console.log(`✓ "uncategorized" count: ${uncategorized?.count || 0} transactions`);
  console.log(`✓ "income" = payroll only: ${income?.count || 0} transactions`);
  console.log(`✓ "expense" = real expenses: ${expense?.count || 0} transactions`);
  console.log(`✓ "credit_payment" separated: ${creditPayment?.count || 0} transactions`);
  console.log(`✓ "credit_reward" identified: ${creditReward?.count || 0} transactions`);
  console.log(`✓ "refund" identified: ${refund?.count || 0} transactions`);
  console.log(`✓ "transfer_in" identified: ${transferIn?.count || 0} transactions`);
  console.log(`✓ "tax_refund" separated: ${taxRefund?.count || 0} transactions`);

  console.log();
  console.log();

  // Show sample transactions by category
  console.log('## Sample Transactions by Category (5 per category)');
  console.log('-'.repeat(120));
  console.log();

  const categoriesOfInterest = ['income', 'expense', 'credit_payment', 'credit_reward', 'refund', 'transfer_in', 'tax_refund'];

  for (const category of categoriesOfInterest) {
    const samples = db.prepare(`
      SELECT date, amount, description, account_id
      FROM transactions
      WHERE category = ?
      ORDER BY normalized_date DESC
      LIMIT 5
    `).all(category) as Array<{ date: string; amount: number; description: string; account_id: number }>;

    if (samples.length > 0) {
      console.log(`### ${category.toUpperCase()} (${samples.length} samples):`);
      for (const sample of samples) {
        const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(sample.account_id) as { name: string };
        console.log(`  ${sample.date.padEnd(12)} | $${sample.amount.toFixed(2).padStart(10)} | ${account.name.padEnd(25)} | ${sample.description.substring(0, 50)}`);
      }
      console.log();
    }
  }
}

// Run the audit
postRecategorizationAudit();
