import { detectRecurringExpenses } from '../lib/recurring-expenses/detector';
import { applyPredictions } from '../lib/recurring-expenses/predictor';
import { detectAndStoreAnomalies } from '../lib/recurring-expenses/anomaly-detector';
import db from '../lib/db';

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('RECURRING EXPENSE DETECTION REPORT');
  console.log('='.repeat(70));
  console.log(`Run Date: ${new Date().toISOString()}`);
  console.log('');

  // Run detection
  const result = await detectRecurringExpenses();

  console.log(`Transactions Analyzed: ${result.summary.transactions_analyzed} expense transactions`);
  console.log(`Analysis Period: All available data`);
  console.log('');

  // Apply predictions and anomalies to each expense
  for (const expense of result.recurring_expenses) {
    // Get transaction amounts for trend detection
    const transactionIds = expense.sample_transactions || [];
    const amounts: number[] = [];

    for (const id of transactionIds) {
      const txn = db.prepare('SELECT amount FROM transactions WHERE id = ?').get(id) as { amount: number } | undefined;
      if (txn) {
        amounts.push(Math.abs(txn.amount));
      }
    }

    // Apply predictions
    applyPredictions(expense, amounts);

    // Detect anomalies
    const anomalies = detectAndStoreAnomalies(expense);
    expense.anomalies = anomalies;

    // Update database with predictions
    db.prepare(
      `
      UPDATE recurring_expenses
      SET next_predicted_date = ?,
          next_predicted_amount = ?,
          prediction_confidence = ?,
          trend = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE merchant_normalized = ?
    `
    ).run(
      expense.next_predicted_date,
      expense.next_predicted_amount,
      expense.prediction_confidence,
      expense.trend,
      expense.merchant_normalized
    );
  }

  // Display summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Recurring Expenses Detected: ${result.summary.total_recurring}`);
  console.log(`  High Confidence: ${result.summary.by_confidence.high}`);
  console.log(`  Medium Confidence: ${result.summary.by_confidence.medium}`);
  console.log(`  Low Confidence: ${result.summary.by_confidence.low}`);
  console.log('');

  console.log('By Type:');
  console.log(`  Subscriptions: ${result.summary.by_type.subscription}`);
  console.log(`  Fixed: ${result.summary.by_type.fixed}`);
  console.log(`  Variable Recurring: ${result.summary.by_type.variable_recurring}`);
  console.log(`  Seasonal: ${result.summary.by_type.seasonal}`);
  console.log('');

  console.log('By Priority:');
  console.log(`  Essential: ${result.summary.by_priority.essential}`);
  console.log(`  Important: ${result.summary.by_priority.important}`);
  console.log(`  Discretionary: ${result.summary.by_priority.discretionary}`);
  console.log('');

  console.log(`Total Monthly Cost (estimated): $${result.summary.total_monthly_cost.toFixed(2)}`);
  console.log('');

  // Display high confidence expenses
  console.log('='.repeat(70));
  console.log('HIGH CONFIDENCE RECURRING EXPENSES');
  console.log('='.repeat(70));
  console.log('');

  const highConfidence = result.recurring_expenses.filter((e) => e.confidence === 'high');

  if (highConfidence.length === 0) {
    console.log('  No high confidence recurring expenses detected.');
    console.log('');
  }

  for (const expense of highConfidence) {
    console.log(`${expense.merchant_display_name}`);
    console.log(`  Type: ${expense.expense_type} | Priority: ${expense.priority}`);
    console.log(`  Frequency: Every ${expense.frequency_days.toFixed(0)} days (±${(expense.frequency_variance_days || 0).toFixed(0)} days)`);

    if (expense.typical_day_of_month) {
      console.log(`  Typical Day: ${expense.typical_day_of_month}th of month`);
    }

    if (expense.amount_variance_pct < 10) {
      console.log(`  Amount: $${expense.typical_amount.toFixed(2)} (fixed)`);
    } else {
      console.log(
        `  Amount: $${expense.typical_amount.toFixed(2)} avg (range: $${expense.amount_range[0].toFixed(2)} - $${expense.amount_range[1].toFixed(2)})`
      );
    }

    if (expense.trend && expense.trend !== 'stable') {
      console.log(`  Trend: ${expense.trend === 'increasing' ? '📈' : '📉'} ${expense.trend}`);
    }

    console.log(`  Occurrences: ${expense.occurrence_count}x (${expense.first_occurrence_date} to ${expense.last_occurrence_date})`);
    console.log(`  Last: ${expense.last_occurrence_date} → $${expense.last_amount.toFixed(2)}`);
    console.log(`  Next: ${expense.next_predicted_date} → $${expense.next_predicted_amount?.toFixed(2)} (${expense.prediction_confidence} confidence)`);

    if (expense.anomalies && expense.anomalies.length > 0) {
      const anomalyStr = expense.anomalies.map((a) => a.type).join(', ');
      console.log(`  ⚠ ANOMALIES: ${anomalyStr}`);
    }

    console.log('');
  }

  // Display medium confidence expenses
  console.log('='.repeat(70));
  console.log('MEDIUM CONFIDENCE RECURRING EXPENSES');
  console.log('='.repeat(70));
  console.log('');

  const mediumConfidence = result.recurring_expenses.filter((e) => e.confidence === 'medium');

  if (mediumConfidence.length === 0) {
    console.log('  No medium confidence recurring expenses detected.');
    console.log('');
  }

  for (const expense of mediumConfidence) {
    console.log(`${expense.merchant_display_name}`);
    console.log(`  Type: ${expense.expense_type} | Priority: ${expense.priority}`);
    console.log(`  Frequency: Every ${expense.frequency_days.toFixed(0)} days (±${(expense.frequency_variance_days || 0).toFixed(0)} days)`);
    console.log(`  Amount: $${expense.typical_amount.toFixed(2)} avg (range: $${expense.amount_range[0].toFixed(2)} - $${expense.amount_range[1].toFixed(2)})`);
    console.log(`  Occurrences: ${expense.occurrence_count}x`);
    console.log(`  Next: ${expense.next_predicted_date} → $${expense.next_predicted_amount?.toFixed(2)}`);

    if (expense.anomalies && expense.anomalies.length > 0) {
      const anomalyStr = expense.anomalies.map((a) => a.type).join(', ');
      console.log(`  ⚠ ANOMALIES: ${anomalyStr}`);
    }

    console.log('');
  }

  // Display low confidence expenses
  const lowConfidence = result.recurring_expenses.filter((e) => e.confidence === 'low');

  if (lowConfidence.length > 0) {
    console.log('='.repeat(70));
    console.log('LOW CONFIDENCE RECURRING EXPENSES');
    console.log('='.repeat(70));
    console.log('');
    console.log(`${lowConfidence.length} expenses detected with low confidence.`);
    console.log('These may be irregular shopping patterns rather than true recurring bills.');
    console.log('');

    for (const expense of lowConfidence.slice(0, 5)) {
      console.log(`  - ${expense.merchant_display_name}: ${expense.occurrence_count}x, ~${expense.frequency_days.toFixed(0)} days apart`);
    }

    if (lowConfidence.length > 5) {
      console.log(`  ... and ${lowConfidence.length - 5} more`);
    }

    console.log('');
  }

  // Recommendations
  console.log('='.repeat(70));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(70));
  console.log('');

  if (highConfidence.length > 0) {
    console.log(`✓ ${highConfidence.length} recurring expenses detected with high confidence`);
  }

  const hasVariableUtilities = highConfidence.some((e) => e.priority === 'essential' && e.amount_variance_pct > 15);
  if (hasVariableUtilities) {
    console.log('✓ Consider setting up alerts for variable utility bills');
  }

  if (mediumConfidence.length > 0) {
    console.log(`⚠ Review ${mediumConfidence.length} medium confidence items - may need classification`);
  }

  const hasAnomalies = result.recurring_expenses.some((e) => e.anomalies && e.anomalies.length > 0);
  if (hasAnomalies) {
    console.log('⚠ Some anomalies detected - review unusual patterns');
  }

  console.log('');
  console.log('Next Steps:');
  console.log('1. Review this list and mark any false positives in /settings');
  console.log('2. Run: npx tsx scripts/cash-reservation.ts to see upcoming bills');
  console.log('3. Monitor for anomalies in future transactions');
  console.log('');

  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('Error running detection:', error);
  process.exit(1);
});
