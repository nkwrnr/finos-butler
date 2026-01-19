import db from '../db';
import { Anomaly, RecurringExpense, RecurringExpenseWithAnomalies, Transaction, Severity } from './types';

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date
 */
function addDays(date: string | Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

/**
 * Detect anomalies in a recurring expense pattern
 */
export function detectAnomalies(
  recurring: RecurringExpense | RecurringExpenseWithAnomalies,
  recentTransactions: Transaction[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const today = new Date().toISOString().split('T')[0];

  // 1. MISSED PAYMENT: Expected date has passed without occurrence
  const daysSinceLast = daysBetween(recurring.last_occurrence_date, today);
  const expectedInterval = recurring.frequency_days;

  if (daysSinceLast > expectedInterval * 1.5) {
    // 50% overdue
    const severity: Severity = daysSinceLast > expectedInterval * 2 ? 'high' : 'medium';
    anomalies.push({
      type: 'missed',
      severity,
      expected_value: addDays(recurring.last_occurrence_date, expectedInterval),
      actual_value: null,
    });
  }

  // 2. AMOUNT ANOMALIES: Recent transaction outside expected range
  if (recentTransactions.length > 0) {
    const lastTransaction = recentTransactions[0];
    const deviation = Math.abs(Math.abs(lastTransaction.amount) - recurring.typical_amount);
    const deviationPct = (deviation / recurring.typical_amount) * 100;

    const varianceThreshold = recurring.amount_variance_pct * 2;

    // Amount HIGH: More than 2 std deviations above mean
    if (deviationPct > varianceThreshold && Math.abs(lastTransaction.amount) > recurring.typical_amount) {
      const severity: Severity = deviationPct > recurring.amount_variance_pct * 3 ? 'high' : 'medium';
      anomalies.push({
        type: 'amount_high',
        severity,
        transaction_id: lastTransaction.id,
        expected_value: recurring.typical_amount,
        actual_value: Math.abs(lastTransaction.amount),
      });
    }

    // Amount LOW: More than 2 std deviations below mean
    if (deviationPct > varianceThreshold && Math.abs(lastTransaction.amount) < recurring.typical_amount) {
      anomalies.push({
        type: 'amount_low',
        severity: 'low',
        transaction_id: lastTransaction.id,
        expected_value: recurring.typical_amount,
        actual_value: Math.abs(lastTransaction.amount),
      });
    }
  }

  // 3. TIMING ANOMALIES: Early or late occurrence
  if (recentTransactions.length >= 2) {
    const lastTwo = recentTransactions.slice(0, 2);
    const actualInterval = daysBetween(lastTwo[1].normalized_date, lastTwo[0].normalized_date);
    const expectedInterval = recurring.frequency_days;
    const variance = recurring.frequency_variance_days || expectedInterval * 0.1;

    if (Math.abs(actualInterval - expectedInterval) > variance * 2) {
      anomalies.push({
        type: actualInterval < expectedInterval ? 'early' : 'late',
        severity: 'low',
        transaction_id: lastTwo[0].id,
        expected_value: expectedInterval,
        actual_value: actualInterval,
      });
    }
  }

  // 4. DUPLICATE SUSPECTED: Two charges within short time
  if (recentTransactions.length >= 2) {
    const lastTwo = recentTransactions.slice(0, 2);
    const daysBetweenCharges = daysBetween(lastTwo[1].normalized_date, lastTwo[0].normalized_date);

    if (daysBetweenCharges < 7 && Math.abs(Math.abs(lastTwo[0].amount) - Math.abs(lastTwo[1].amount)) < 1) {
      anomalies.push({
        type: 'duplicate_suspected',
        severity: 'medium',
        transaction_id: lastTwo[0].id,
        expected_value: null,
        actual_value: null,
      });
    }
  }

  return anomalies;
}

/**
 * Store anomalies in the database
 */
export function storeAnomalies(recurringExpenseId: number, anomalies: Anomaly[]): void {
  for (const anomaly of anomalies) {
    db.prepare(
      `
      INSERT INTO recurring_anomalies (
        recurring_expense_id, anomaly_type, detected_date,
        transaction_id, expected_value, actual_value, severity
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `
    ).run(
      recurringExpenseId,
      anomaly.type,
      new Date().toISOString().split('T')[0],
      anomaly.transaction_id || null,
      anomaly.expected_value,
      anomaly.actual_value,
      anomaly.severity
    );
  }
}

/**
 * Get anomalies for a recurring expense from the database
 */
export function getAnomalies(recurringExpenseId: number): Anomaly[] {
  return db
    .prepare(
      `
    SELECT * FROM recurring_anomalies
    WHERE recurring_expense_id = ?
      AND user_acknowledged = 0
    ORDER BY created_at DESC
    LIMIT 10
  `
    )
    .all(recurringExpenseId) as Anomaly[];
}

/**
 * Detect and store anomalies for a recurring expense
 */
export function detectAndStoreAnomalies(recurring: RecurringExpense | RecurringExpenseWithAnomalies): Anomaly[] {
  // Get recent transactions for this merchant
  const transactions = db
    .prepare(
      `
    SELECT id, account_id, normalized_date, amount, description, category
    FROM transactions
    WHERE category = 'expense'
      AND description LIKE ?
    ORDER BY normalized_date DESC
    LIMIT 10
  `
    )
    .all(`%${recurring.merchant_display_name}%`) as Transaction[];

  // Detect anomalies
  const anomalies = detectAnomalies(recurring, transactions);

  // Store in database if we have the recurring expense ID
  if ('id' in recurring && recurring.id && anomalies.length > 0) {
    storeAnomalies(recurring.id, anomalies);
  }

  return anomalies;
}
