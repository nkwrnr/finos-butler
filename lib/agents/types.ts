// ============================================
// CORE TYPES FOR ALL AGENTS
// ============================================

export interface Insight {
  id?: number;
  agentType: AgentType;
  insightType: InsightType;
  title: string;
  body: string;
  dataJson?: Record<string, unknown>;
  severity: Severity;
  category?: string;
  merchant?: string;
  periodType: PeriodType;
  referenceDate: string;
  comparisonPeriod?: string;
  amountCurrent?: number;
  amountPrevious?: number;
  percentChange?: number;
  actionable: boolean;
  actionText?: string;
  dismissed: boolean;
  viewed: boolean;
  createdAt?: string;
  expiresAt?: string;
}

export type AgentType = 'analyst' | 'optimizer' | 'predictor' | 'advisor';

export type InsightType =
  | 'spending_spike'
  | 'spending_drop'
  | 'merchant_frequency'
  | 'merchant_avg_change'
  | 'merchant_total_change'
  | 'seasonal_anomaly'
  | 'category_trend'
  | 'unusual_transaction'
  | 'recurring_change';

export type Severity = 'info' | 'warning' | 'action_needed';
export type PeriodType = 'daily' | 'weekly' | 'monthly';

export interface AgentRun {
  id?: number;
  agentType: AgentType;
  runType: 'scheduled' | 'manual' | 'triggered';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  insightsGenerated: number;
  insightsData?: Record<string, unknown>;
  errorMessage?: string;
  runMetadata?: Record<string, unknown>;
}

// ============================================
// FINANCIAL CONTEXT (shared across all agents)
// ============================================

export interface MonthSummary {
  month: string; // YYYY-MM
  income: number;
  totalSpending: number;
  byCategory: Record<string, number>;
  byMerchant: Record<string, MerchantSummary>;
  transactionCount: number;
  avgTransactionSize: number;
}

export interface MerchantSummary {
  merchant: string;
  totalSpend: number;
  transactionCount: number;
  avgTransaction: number;
  category: string;
  transactions: TransactionSummary[];
}

export interface TransactionSummary {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  spendingCategory?: string;
}

export interface CategorySpending {
  category: string;
  currentMonth: number;
  previousMonth: number;
  threeMonthAvg: number;
  sixMonthAvg: number;
  percentChangeFromPrev: number;
  percentChangeFromAvg: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface MerchantPattern {
  merchant: string;
  category: string;
  currentPeriod: {
    count: number;
    total: number;
    avgTransaction: number;
    firstDate: string;
    lastDate: string;
  };
  previousPeriod: {
    count: number;
    total: number;
    avgTransaction: number;
  };
  frequencyChange: number;
  spendChange: number;
  avgOrderChange: number;
}

export interface FinancialContext {
  asOfDate: string;
  currentMonth: MonthSummary;
  previousMonth: MonthSummary;
  monthsData: MonthSummary[]; // Last 6 months
  categoryAnalysis: CategorySpending[];
  merchantPatterns: MerchantPattern[];
  topMerchants: MerchantSummary[];
  recurringExpenses: RecurringExpenseSummary[];
  goals: GoalSummary[];
  cashPosition: CashPosition;
}

export interface RecurringExpenseSummary {
  id: number;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  lastOccurrence: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentChange?: number;
}

export interface GoalSummary {
  id: number;
  name: string;
  target: number;
  current: number;
  deadline: string;
  percentComplete: number;
  monthsRemaining: number;
  requiredMonthly: number;
  status: 'ahead' | 'on_track' | 'behind';
}

export interface CashPosition {
  checkingBalance: number;
  savingsBalance: number;
  creditCardBalance: number;
  availableCash: number; // checking - safety buffer
  safetyBuffer: number;
}

// ============================================
// SPENDING ANOMALY TYPES
// ============================================

export interface SpendingAnomaly {
  category: string;
  currentAmount: number;
  comparisonAmount: number;
  comparisonType: 'previous_month' | 'three_month_avg' | 'six_month_avg' | 'same_month_last_year';
  percentChange: number;
  absoluteChange: number;
  isSignificant: boolean;
  direction: 'increase' | 'decrease';
  topContributors: Array<{
    merchant: string;
    amount: number;
    count: number;
    percentOfCategory: number;
  }>;
  possibleReasons: string[];
}

// ============================================
// ANALYST AGENT SPECIFIC
// ============================================

export interface AnalystRunConfig {
  analysisMonth?: string; // YYYY-MM, defaults to current month
  lookbackMonths?: number; // How many months to compare, default 6
  includeCategories?: string[]; // Filter to specific categories
  excludeCategories?: string[]; // Exclude specific categories
  minAnomalyThreshold?: number; // Min % change to flag, default 25
  minAmountThreshold?: number; // Min $ difference to flag, default 50
}

export interface AnalystResult {
  runId: number;
  analysisMonth: string;
  spendingAnomalies: SpendingAnomaly[];
  merchantPatterns: MerchantPattern[];
  generatedInsights: Insight[];
  summary: {
    totalCategoriesAnalyzed: number;
    anomaliesFound: number;
    merchantPatternsFound: number;
    insightsGenerated: number;
  };
}
