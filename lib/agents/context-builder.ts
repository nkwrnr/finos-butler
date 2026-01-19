import db from '@/lib/db';
import type {
  FinancialContext,
  MonthSummary,
  CategorySpending,
  MerchantPattern,
  MerchantSummary,
  RecurringExpenseSummary,
  GoalSummary,
  CashPosition,
} from './types';

/**
 * Builds comprehensive financial context for agent analysis.
 * This is the shared data layer all agents use.
 */
export async function buildFinancialContext(
  asOfDate: Date = new Date(),
  lookbackMonths: number = 6
): Promise<FinancialContext> {
  // Calculate date ranges
  const currentMonth = formatMonth(asOfDate);
  const months = getMonthRange(asOfDate, lookbackMonths);

  // Fetch all month summaries
  const monthsData = months.map((month) => getMonthSummary(month));

  const currentMonthData = monthsData[0];
  const previousMonthData = monthsData[1];

  // Analyze categories
  const categoryAnalysis = analyzeCategorySpending(monthsData);

  // Analyze merchant patterns (current vs previous month)
  const merchantPatterns = analyzeMerchantPatterns(currentMonthData, previousMonthData);

  // Get top merchants by spend
  const topMerchants = getTopMerchants(currentMonthData, 20);

  // Get recurring expenses
  const recurringExpenses = getRecurringExpenses();

  // Get goals
  const goals = getGoals();

  // Get cash position
  const cashPosition = getCashPosition();

  return {
    asOfDate: asOfDate.toISOString().split('T')[0],
    currentMonth: currentMonthData,
    previousMonth: previousMonthData,
    monthsData,
    categoryAnalysis,
    merchantPatterns,
    topMerchants,
    recurringExpenses,
    goals,
    cashPosition,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(endDate: Date, count: number): string[] {
  const months: string[] = [];
  const date = new Date(endDate);

  for (let i = 0; i < count; i++) {
    months.push(formatMonth(date));
    date.setMonth(date.getMonth() - 1);
  }

  return months;
}

function getMonthEndDate(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

function cleanMerchantName(description: string): string {
  // Take first 30 chars, remove numbers at end, clean up
  let clean = description.substring(0, 30).trim();
  clean = clean.replace(/\s+\d+$/, ''); // Remove trailing numbers
  clean = clean.replace(/\s+#\d+$/, ''); // Remove trailing #123
  clean = clean.replace(/\*+/g, ' ').trim(); // Remove asterisks
  clean = clean.replace(/\s+/g, ' '); // Normalize whitespace
  return clean.toUpperCase();
}

function getMonthSummary(month: string): MonthSummary {
  const startDate = `${month}-01`;
  const endDate = getMonthEndDate(month);

  // Get all transactions for the month
  const transactions = db
    .prepare(
      `
    SELECT
      t.id,
      t.date,
      t.normalized_date,
      t.description,
      t.amount,
      t.category,
      t.spending_category,
      a.type as account_type,
      a.name as account_name
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE (t.normalized_date >= ? AND t.normalized_date <= ?)
       OR (t.date >= ? AND t.date <= ?)
    ORDER BY t.normalized_date DESC
  `
    )
    .all(startDate, endDate, startDate, endDate) as Array<{
    id: number;
    date: string;
    normalized_date: string;
    description: string;
    amount: number;
    category: string;
    spending_category: string | null;
    account_type: string;
    account_name: string;
  }>;

  // Calculate income (only from checking, category = 'income')
  const income = transactions
    .filter((t) => t.category === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Calculate spending (category = 'expense' only)
  const expenseTransactions = transactions.filter((t) => t.category === 'expense');

  const totalSpending = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Group by spending category
  const byCategory: Record<string, number> = {};
  for (const t of expenseTransactions) {
    const cat = t.spending_category || 'uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  }

  // Group by merchant (clean description)
  const byMerchant: Record<string, MerchantSummary> = {};
  for (const t of expenseTransactions) {
    const merchant = cleanMerchantName(t.description);
    if (!byMerchant[merchant]) {
      byMerchant[merchant] = {
        merchant,
        totalSpend: 0,
        transactionCount: 0,
        avgTransaction: 0,
        category: t.spending_category || 'uncategorized',
        transactions: [],
      };
    }
    byMerchant[merchant].totalSpend += Math.abs(t.amount);
    byMerchant[merchant].transactionCount += 1;
    byMerchant[merchant].transactions.push({
      id: t.id,
      date: t.normalized_date || t.date,
      description: t.description,
      amount: Math.abs(t.amount),
      category: t.category,
      spendingCategory: t.spending_category || undefined,
    });
  }

  // Calculate averages
  for (const merchant of Object.values(byMerchant)) {
    merchant.avgTransaction = merchant.totalSpend / merchant.transactionCount;
  }

  return {
    month,
    income,
    totalSpending,
    byCategory,
    byMerchant,
    transactionCount: expenseTransactions.length,
    avgTransactionSize: expenseTransactions.length > 0 ? totalSpending / expenseTransactions.length : 0,
  };
}

function analyzeCategorySpending(monthsData: MonthSummary[]): CategorySpending[] {
  const [current, previous, ...older] = monthsData;

  // Get all categories across all months
  const allCategories = new Set<string>();
  for (const month of monthsData) {
    Object.keys(month.byCategory).forEach((cat) => allCategories.add(cat));
  }

  const results: CategorySpending[] = [];

  for (const category of allCategories) {
    const currentAmount = current.byCategory[category] || 0;
    const previousAmount = previous?.byCategory[category] || 0;

    // Calculate 3-month and 6-month averages
    const threeMonthData = monthsData.slice(1, 4);
    const sixMonthData = monthsData.slice(1, 7);

    const threeMonthAvg =
      threeMonthData.length > 0
        ? threeMonthData.reduce((sum, m) => sum + (m.byCategory[category] || 0), 0) / threeMonthData.length
        : 0;

    const sixMonthAvg =
      sixMonthData.length > 0
        ? sixMonthData.reduce((sum, m) => sum + (m.byCategory[category] || 0), 0) / sixMonthData.length
        : 0;

    const percentChangeFromPrev =
      previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : currentAmount > 0 ? 100 : 0;

    const percentChangeFromAvg =
      sixMonthAvg > 0 ? ((currentAmount - sixMonthAvg) / sixMonthAvg) * 100 : currentAmount > 0 ? 100 : 0;

    // Determine trend based on last 3 months
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (monthsData.length >= 3) {
      const m0 = current.byCategory[category] || 0;
      const m1 = monthsData[1]?.byCategory[category] || 0;
      const m2 = monthsData[2]?.byCategory[category] || 0;

      if (m0 > m1 && m1 > m2) trend = 'increasing';
      else if (m0 < m1 && m1 < m2) trend = 'decreasing';
    }

    results.push({
      category,
      currentMonth: currentAmount,
      previousMonth: previousAmount,
      threeMonthAvg,
      sixMonthAvg,
      percentChangeFromPrev,
      percentChangeFromAvg,
      trend,
    });
  }

  // Sort by current month spending descending
  return results.sort((a, b) => b.currentMonth - a.currentMonth);
}

function analyzeMerchantPatterns(current: MonthSummary, previous: MonthSummary): MerchantPattern[] {
  const patterns: MerchantPattern[] = [];

  // Get all merchants from both months
  const allMerchants = new Set([
    ...Object.keys(current.byMerchant),
    ...Object.keys(previous?.byMerchant || {}),
  ]);

  for (const merchant of allMerchants) {
    const curr = current.byMerchant[merchant];
    const prev = previous?.byMerchant[merchant];

    const currentPeriod = curr
      ? {
          count: curr.transactionCount,
          total: curr.totalSpend,
          avgTransaction: curr.avgTransaction,
          firstDate: curr.transactions[curr.transactions.length - 1]?.date || '',
          lastDate: curr.transactions[0]?.date || '',
        }
      : { count: 0, total: 0, avgTransaction: 0, firstDate: '', lastDate: '' };

    const previousPeriod = prev
      ? {
          count: prev.transactionCount,
          total: prev.totalSpend,
          avgTransaction: prev.avgTransaction,
        }
      : { count: 0, total: 0, avgTransaction: 0 };

    // Calculate changes
    const frequencyChange =
      previousPeriod.count > 0
        ? ((currentPeriod.count - previousPeriod.count) / previousPeriod.count) * 100
        : currentPeriod.count > 0
          ? 100
          : 0;

    const spendChange =
      previousPeriod.total > 0
        ? ((currentPeriod.total - previousPeriod.total) / previousPeriod.total) * 100
        : currentPeriod.total > 0
          ? 100
          : 0;

    const avgOrderChange =
      previousPeriod.avgTransaction > 0
        ? ((currentPeriod.avgTransaction - previousPeriod.avgTransaction) / previousPeriod.avgTransaction) * 100
        : currentPeriod.avgTransaction > 0
          ? 100
          : 0;

    patterns.push({
      merchant,
      category: curr?.category || prev?.category || 'uncategorized',
      currentPeriod,
      previousPeriod,
      frequencyChange,
      spendChange,
      avgOrderChange,
    });
  }

  // Sort by absolute spend change
  return patterns.sort(
    (a, b) => Math.abs(b.currentPeriod.total - b.previousPeriod.total) - Math.abs(a.currentPeriod.total - a.previousPeriod.total)
  );
}

function getTopMerchants(monthData: MonthSummary, limit: number): MerchantSummary[] {
  return Object.values(monthData.byMerchant)
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit);
}

function getRecurringExpenses(): RecurringExpenseSummary[] {
  const rows = db
    .prepare(
      `
    SELECT
      id, merchant_display_name as name, typical_amount as amount,
      frequency_days, category, last_occurrence_date, trend
    FROM recurring_expenses
    WHERE tracked = 1
    ORDER BY typical_amount DESC
  `
    )
    .all() as Array<{
    id: number;
    name: string;
    amount: number;
    frequency_days: number;
    category: string;
    last_occurrence_date: string;
    trend: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    frequency: r.frequency_days < 35 ? 'monthly' : r.frequency_days < 100 ? 'quarterly' : 'annual',
    category: r.category,
    lastOccurrence: r.last_occurrence_date,
    trend: (r.trend as 'increasing' | 'decreasing' | 'stable') || 'stable',
    percentChange: undefined,
  }));
}

function getGoals(): GoalSummary[] {
  // Get goals with calculated current_amount from linked accounts using subquery
  const rows = db
    .prepare(
      `
    SELECT
      sg.id,
      sg.name,
      sg.target_amount,
      COALESCE((SELECT SUM(a.balance) FROM accounts a WHERE a.goal_id = sg.id), 0) as current_amount,
      sg.deadline
    FROM savings_goals sg
    ORDER BY sg.deadline ASC
  `
    )
    .all() as Array<{
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string;
  }>;

  const now = new Date();

  return rows.map((r) => {
    const deadline = new Date(r.deadline);
    const monthsRemaining = Math.max(
      0,
      (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth())
    );
    const remaining = r.target_amount - r.current_amount;
    const requiredMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
    const percentComplete = (r.current_amount / r.target_amount) * 100;

    // Determine status
    const expectedProgress = r.target_amount * (1 - monthsRemaining / 36); // Rough estimate
    let status: 'ahead' | 'on_track' | 'behind' = 'on_track';
    if (r.current_amount > expectedProgress * 1.05) status = 'ahead';
    else if (r.current_amount < expectedProgress * 0.95) status = 'behind';

    return {
      id: r.id,
      name: r.name,
      target: r.target_amount,
      current: r.current_amount,
      deadline: r.deadline,
      percentComplete,
      monthsRemaining,
      requiredMonthly,
      status,
    };
  });
}

function getCashPosition(): CashPosition {
  const accounts = db
    .prepare(
      `
    SELECT name, type, balance FROM accounts
  `
    )
    .all() as Array<{ name: string; type: string; balance: number }>;

  let checkingBalance = 0;
  let savingsBalance = 0;
  let creditCardBalance = 0;

  for (const account of accounts) {
    if (account.type === 'checking') checkingBalance += account.balance || 0;
    else if (account.type === 'savings') savingsBalance += account.balance || 0;
    else if (account.type === 'credit_card') creditCardBalance += Math.abs(account.balance || 0);
  }

  const safetyBuffer = 2000; // From user's settings

  return {
    checkingBalance,
    savingsBalance,
    creditCardBalance,
    availableCash: Math.max(0, checkingBalance - safetyBuffer),
    safetyBuffer,
  };
}

export { formatMonth, getMonthRange, cleanMerchantName };
