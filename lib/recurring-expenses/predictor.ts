import { RecurringExpense, ConfidenceLevel, Trend, RecurringExpenseWithAnomalies } from './types';

/**
 * Add days to a date
 */
function addDays(date: string | Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Predict next occurrence date for a recurring expense
 */
export function predictNextOccurrence(
  recurring: RecurringExpense | RecurringExpenseWithAnomalies
): { date: string; confidence: ConfidenceLevel } {
  const { last_occurrence_date, frequency_days, frequency_variance_days } = recurring;

  // Simple prediction: last date + average frequency
  const predictedDate = addDays(last_occurrence_date, Math.round(frequency_days));

  // Adjust confidence based on variance
  const variance = frequency_variance_days || 0;
  const cv = variance > 0 ? (variance / frequency_days) * 100 : 0;

  let confidence: ConfidenceLevel;

  if (cv < 10) confidence = 'high';
  else if (cv < 25) confidence = 'medium';
  else confidence = 'low';

  return { date: predictedDate, confidence };
}

/**
 * Predict next amount for a recurring expense
 */
export function predictNextAmount(
  recurring: RecurringExpense | RecurringExpenseWithAnomalies,
  trend: Trend | null
): { amount: number; range: [number, number] } {
  const { typical_amount, amount_variance_pct, min_amount, max_amount } = recurring;

  let predicted = typical_amount;

  // Apply trend adjustment
  if (trend === 'increasing') {
    predicted = typical_amount * 1.05; // 5% increase
  } else if (trend === 'decreasing') {
    predicted = typical_amount * 0.95; // 5% decrease
  }

  // Calculate range based on variance
  const variance = typical_amount * (amount_variance_pct / 100);
  const range: [number, number] = [
    Math.max(min_amount, predicted - variance * 2),
    Math.min(max_amount, predicted + variance * 2),
  ];

  return { amount: predicted, range };
}

/**
 * Detect trend in transaction amounts using linear regression
 */
export function detectTrend(transactionAmounts: number[]): Trend {
  if (transactionAmounts.length < 3) return 'stable';

  // Use last 6 occurrences for trend analysis
  const recent = transactionAmounts.slice(-6);
  const n = recent.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = recent;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgAmount = sumY / n;

  // Normalize slope relative to average amount
  const normalizedSlope = (slope / avgAmount) * 100; // percent change per occurrence

  if (normalizedSlope > 3) return 'increasing';
  if (normalizedSlope < -3) return 'decreasing';
  return 'stable';
}

/**
 * Apply predictions to a recurring expense
 */
export function applyPredictions(expense: RecurringExpenseWithAnomalies, transactionAmounts: number[]): void {
  // Detect trend
  expense.trend = detectTrend(transactionAmounts);

  // Predict next occurrence
  const nextOccurrence = predictNextOccurrence(expense);
  expense.next_predicted_date = nextOccurrence.date;
  expense.prediction_confidence = nextOccurrence.confidence;

  // Predict next amount
  const nextAmount = predictNextAmount(expense, expense.trend);
  expense.next_predicted_amount = nextAmount.amount;
  expense.amount_range = nextAmount.range;
}
