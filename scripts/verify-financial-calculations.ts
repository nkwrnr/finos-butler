import db from '../lib/db';
import { detectIncomeProfile, analyzeExpenses } from '../lib/financial-intelligence';

/**
 * Verify financial calculations after recategorization
 */
export function verifyFinancialCalculations() {
  console.log('='.repeat(120));
  console.log('FINANCIAL CALCULATIONS VERIFICATION');
  console.log('='.repeat(120));
  console.log();

  // Get WellsFargo checking account ID
  const account = db.prepare("SELECT id, name FROM accounts WHERE name LIKE '%WellsFargo%'").get() as { id: number; name: string } | undefined;

  if (!account) {
    console.log('❌ WellsFargo checking account not found');
    return;
  }

  console.log(`Account: ${account.name} (ID: ${account.id})`);
  console.log();

  // Detect income profile
  console.log('## Income Analysis');
  console.log('-'.repeat(120));
  console.log();

  const incomeProfile = detectIncomeProfile(account.id);

  console.log(`Average Monthly Income: $${incomeProfile.averageMonthlyIncome.toFixed(2)}`);
  console.log(`Pay Frequency: ${incomeProfile.payFrequency}`);
  console.log(`Last Paycheck: ${incomeProfile.lastPaycheckDate || 'N/A'}`);
  console.log(`Next Paycheck (estimated): ${incomeProfile.estimatedNextPaycheckDate || 'N/A'}`);
  console.log(`Days Since Last Paycheck: ${incomeProfile.daysSinceLastPaycheck}`);
  console.log(`Days Until Next Paycheck: ${incomeProfile.daysUntilNextPaycheck}`);
  console.log(`Confidence: ${incomeProfile.confidence}`);

  console.log();

  // Show recent income transactions
  const recentIncome = db.prepare(`
    SELECT date, amount, description, normalized_date
    FROM transactions
    WHERE account_id = ?
      AND category = 'income'
      AND normalized_date >= date('now', '-90 days')
    ORDER BY normalized_date DESC
    LIMIT 10
  `).all(account.id) as Array<{ date: string; amount: number; description: string; normalized_date: string }>;

  console.log(`Recent Income Transactions (last 90 days): ${recentIncome.length} transactions`);
  for (const txn of recentIncome) {
    console.log(`  ${txn.normalized_date} | $${txn.amount.toFixed(2).padStart(10)} | ${txn.description.substring(0, 60)}`);
  }

  console.log();
  console.log();

  // Analyze expenses
  console.log('## Expense Analysis');
  console.log('-'.repeat(120));
  console.log();

  const expenseProfile = analyzeExpenses(account.id);

  console.log(`Average Monthly Expenses: $${expenseProfile.averageMonthlyExpenses.toFixed(2)}`);
  console.log(`Fixed Expenses: $${expenseProfile.fixedExpenses.toFixed(2)}`);
  console.log(`Variable Expenses: $${expenseProfile.variableExpenses.toFixed(2)}`);
  console.log(`Daily Burn Rate: $${expenseProfile.dailyBurnRate.toFixed(2)}`);

  console.log();

  if (expenseProfile.recurringBills.length > 0) {
    console.log('Recurring Bills:');
    for (const bill of expenseProfile.recurringBills) {
      console.log(`  - ${bill.description.substring(0, 40).padEnd(40)} | $${bill.amount.toFixed(2).padStart(8)} | ${bill.frequency}`);
    }
  }

  console.log();

  // Show recent expense transactions
  const recentExpenses = db.prepare(`
    SELECT date, amount, description, normalized_date
    FROM transactions
    WHERE account_id = ?
      AND category = 'expense'
      AND normalized_date >= date('now', '-90 days')
    ORDER BY normalized_date DESC
    LIMIT 10
  `).all(account.id) as Array<{ date: string; amount: number; description: string; normalized_date: string }>;

  console.log(`Recent Expense Transactions (last 90 days): ${recentExpenses.length} transactions`);
  for (const txn of recentExpenses) {
    console.log(`  ${txn.normalized_date} | $${Math.abs(txn.amount).toFixed(2).padStart(10)} | ${txn.description.substring(0, 60)}`);
  }

  console.log();
  console.log();

  // Calculate net cash flow
  console.log('## Net Cash Flow (Last 90 Days)');
  console.log('-'.repeat(120));
  console.log();

  const monthlyIncome = incomeProfile.averageMonthlyIncome;
  const monthlyExpenses = expenseProfile.averageMonthlyExpenses;
  const netCashFlow = monthlyIncome - monthlyExpenses;

  console.log(`Monthly Income:   $${monthlyIncome.toFixed(2).padStart(12)}`);
  console.log(`Monthly Expenses: $${monthlyExpenses.toFixed(2).padStart(12)}`);
  console.log('-'.repeat(40));
  console.log(`Net Cash Flow:    $${netCashFlow.toFixed(2).padStart(12)} ${netCashFlow > 0 ? '✓' : '❌'}`);
  console.log();

  if (netCashFlow > 0) {
    console.log(`✓ Positive cash flow: $${netCashFlow.toFixed(2)}/month available for savings/investing`);
  } else {
    console.log(`❌ Negative cash flow: Spending $${Math.abs(netCashFlow).toFixed(2)}/month more than income`);
  }

  console.log();
  console.log();

  // Check Zcash purchases
  console.log('## Zcash Purchase Analysis (Last 90 Days)');
  console.log('-'.repeat(120));
  console.log();

  const zcashPurchases = db.prepare(`
    SELECT date, amount, description, normalized_date
    FROM transactions
    WHERE account_id = ?
      AND category = 'zcash_purchase'
      AND normalized_date >= date('now', '-90 days')
    ORDER BY normalized_date DESC
  `).all(account.id) as Array<{ date: string; amount: number; description: string; normalized_date: string }>;

  const totalZcashSpent = Math.abs(zcashPurchases.reduce((sum, txn) => sum + txn.amount, 0));
  const monthlyZcashSpend = totalZcashSpent / 3; // 90 days = 3 months

  console.log(`Total Zcash Purchases: ${zcashPurchases.length} transactions`);
  console.log(`Total Amount Spent: $${totalZcashSpent.toFixed(2)}`);
  console.log(`Average Monthly: $${monthlyZcashSpend.toFixed(2)}`);
  console.log();

  if (zcashPurchases.length > 0) {
    console.log('Recent Zcash Purchases:');
    for (const txn of zcashPurchases.slice(0, 5)) {
      console.log(`  ${txn.normalized_date} | $${Math.abs(txn.amount).toFixed(2).padStart(10)} | ${txn.description}`);
    }
  }

  console.log();
  console.log();

  // Summary
  console.log('## Summary');
  console.log('-'.repeat(120));
  console.log();

  console.log(`✓ Income tracking: ${incomeProfile.confidence === 'high' ? 'Accurate' : incomeProfile.confidence === 'medium' ? 'Good' : 'Needs improvement'}`);
  console.log(`✓ Expense tracking: Real expenses only (excludes Zcash, savings, credit payments)`);
  console.log(`✓ Cash flow: ${netCashFlow > 0 ? 'Positive' : 'Negative'} ($${netCashFlow.toFixed(2)}/month)`);
  console.log(`✓ Zcash budget: $${monthlyZcashSpend.toFixed(2)}/month`);

  console.log();
}

// Run verification
verifyFinancialCalculations();
