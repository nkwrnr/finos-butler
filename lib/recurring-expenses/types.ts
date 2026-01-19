// Type definitions for Recurring Expense Detection System

export type ExpenseType = 'fixed' | 'variable_recurring' | 'seasonal' | 'subscription';
export type Priority = 'essential' | 'important' | 'discretionary';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type Trend = 'increasing' | 'stable' | 'decreasing';
export type AnomalyType = 'amount_high' | 'amount_low' | 'missed' | 'early' | 'late' | 'duplicate_suspected';
export type Severity = 'low' | 'medium' | 'high';

export interface RecurringExpense {
  id: number;
  merchant_normalized: string;
  merchant_display_name: string;
  category: string;
  expense_type: ExpenseType;
  priority: Priority;
  frequency_days: number;
  frequency_variance_days: number | null;
  typical_day_of_month: number | null;
  typical_amount: number;
  amount_variance_pct: number;
  min_amount: number;
  max_amount: number;
  trend: Trend | null;
  occurrence_count: number;
  first_occurrence_date: string;
  last_occurrence_date: string;
  last_amount: number;
  next_predicted_date: string | null;
  next_predicted_amount: number | null;
  prediction_confidence: ConfidenceLevel | null;
  confidence: ConfidenceLevel;
  sample_transaction_ids: string | null;
  detected_at: string;
  updated_at: string;
  user_confirmed: number;
  user_excluded: number;
  tracked: number;
}

export interface MerchantStats {
  merchant_key: string;
  sample_description: string;
  occurrence_count: number;
  interval_count: number;
  avg_interval_days: number | null;
  interval_std_dev: number | null;
  avg_amount: number;
  amount_std_dev: number | null;
  min_amount: number;
  max_amount: number;
  first_date: string;
  last_date: string;
  transaction_ids: string;
  transaction_amounts: string;
}

export interface DetectionFilters {
  expense_type?: ExpenseType;
  priority?: Priority;
  confidence?: ConfidenceLevel;
  min_confidence?: ConfidenceLevel;
  include_predictions?: boolean;
  include_anomalies?: boolean;
}

export interface DetectionSummary {
  total_recurring: number;
  transactions_analyzed: number;
  by_type: Record<ExpenseType, number>;
  by_confidence: Record<ConfidenceLevel, number>;
  by_priority: Record<Priority, number>;
  total_monthly_cost: number;
  detection_run_at: string;
}

export interface RecurringExpenseWithAnomalies extends Omit<RecurringExpense, 'sample_transaction_ids'> {
  amount_range: [number, number];
  anomalies?: Anomaly[];
  sample_transactions?: number[];
}

export interface DetectionResult {
  summary: DetectionSummary;
  recurring_expenses: RecurringExpenseWithAnomalies[];
}

export interface Anomaly {
  id?: number;
  recurring_expense_id?: number;
  type: AnomalyType;
  detected_date?: string;
  transaction_id?: number | null;
  expected_value: number | string | null;
  actual_value: number | string | null;
  severity: Severity;
  user_acknowledged?: number;
  created_at?: string;
}

export interface ExpenseCorrection {
  id: number;
  merchant_normalized: string;
  is_recurring: boolean;
  user_note: string | null;
  user_marked_at: string;
  applied_to_detection: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  normalized_date: string;
  amount: number;
  description: string;
  category: string;
}
