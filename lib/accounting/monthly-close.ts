import db from '../db';
import { isRealExpense, isRealIncome } from './controller';

export interface MonthlyClose {
  month: string; // "2025-12"

  // Income (payroll only)
  income: {
    total: number;
    transactions: { id: number; date: string; description: string; amount: number }[];
    paycheckCount: number;
    isComplete: boolean; // true if 2 paychecks present
  };

  // Fixed expenses
  fixed: {
    rent: number;
  };

  // Real spending (variable expenses)
  spending: {
    total: number;
    byAccount: {
      checking: number;    // direct debits from WellsFargo
      chase: number;       // credit card purchases
      gemini: number;
      bilt: number;
    };
    topMerchants: { name: string; total: number; count: number }[];
    largeExpenses: { id: number; date: string; description: string; amount: number }[]; // > $200
  };

  // Allocations (intentional cash outflows)
  allocations: {
    savings: number;        // transfers to Ally
    zcash: number;          // Coinbase purchases
    creditPayments: number; // paying off cards
  };

  // Cash position (checking account only)
  cashFlow: {
    startingBalance: number | null;  // if we can calculate
    totalInflows: number;            // income + refunds + transfers in
    totalOutflows: number;           // expenses + allocations
    netChange: number;
    endingBalance: number | null;
  };

  // Non-operating items (excluded from budget calcs)
  nonOperating: {
    taxRefunds: number;
    creditRewards: number;
    refunds: number;
    transfersIn: number;
  };

  // Health flags
  flags: string[]; // "Missing paycheck", "Spending 40% above average", etc.

  // Summary metrics
  summary: {
    surplus: number;           // income - spending - allocations
    savingsRate: number;       // (savings + zcash) / income as percentage
    expenseRatio: number;      // spending / income as percentage
  };
}

export interface FinancialTrends {
  months: MonthlyClose[];

  averages: {
    income: number;
    spending: number;
    surplus: number;
    savingsRate: number;
  };

  trends: {
    incomeDirection: 'increasing' | 'stable' | 'decreasing';
    spendingDirection: 'increasing' | 'stable' | 'decreasing';
    surplusDirection: 'increasing' | 'stable' | 'decreasing';
  };

  insights: string[]; // "Spending increased 15% over last 3 months"
}

/**
 * Close a specific month and generate financial statement
 */
export async function closeMonth(month: string): Promise<MonthlyClose> {
  // Parse month (YYYY-MM format)
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

  // Get all transactions for the month
  const transactions = db.prepare(`
    SELECT id, account_id, normalized_date, amount, description, category
    FROM transactions
    WHERE normalized_date >= ? AND normalized_date <= ?
    ORDER BY normalized_date ASC
  `).all(startDate, endDate) as Array<{
    id: number;
    account_id: number;
    normalized_date: string;
    amount: number;
    description: string;
    category: string;
  }>;

  // Get account info
  const accounts = db.prepare('SELECT id, name FROM accounts').all() as Array<{ id: number; name: string }>;
  const accountMap = new Map(accounts.map(a => [a.id, a.name]));

  // Initialize result
  const flags: string[] = [];

  // 1. INCOME ANALYSIS (category = 'income' only)
  const incomeTransactions = transactions.filter(t => t.category === 'income' && t.amount > 100);
  const incomeTotal = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const paycheckCount = incomeTransactions.filter(t =>
    t.description.toLowerCase().includes('payroll') && t.amount > 1000
  ).length;

  const income = {
    total: incomeTotal,
    transactions: incomeTransactions.map(t => ({
      id: t.id,
      date: t.normalized_date,
      description: t.description,
      amount: t.amount,
    })),
    paycheckCount,
    isComplete: paycheckCount >= 2,
  };

  if (paycheckCount < 2) {
    flags.push(`Missing paycheck: Only ${paycheckCount} paycheck(s) in ${month}`);
  }

  // 2. FIXED EXPENSES (rent)
  const rentTransactions = transactions.filter(t => t.category === 'rent');
  const rentTotal = Math.abs(rentTransactions.reduce((sum, t) => sum + t.amount, 0));

  const fixed = {
    rent: rentTotal,
  };

  // 3. SPENDING ANALYSIS (category = 'expense' only - variable expenses)
  const expenseTransactions = transactions.filter(t => t.category === 'expense');
  const spendingTotal = Math.abs(expenseTransactions.reduce((sum, t) => sum + t.amount, 0));

  // Group by account
  const checkingId = accounts.find(a => a.name.includes('WellsFargo'))?.id;
  const chaseId = accounts.find(a => a.name.includes('Chase'))?.id;
  const biltId = accounts.find(a => a.name.includes('Bilt'))?.id;
  const geminiId = accounts.find(a => a.name.includes('Gemini'))?.id;

  const byAccount = {
    checking: Math.abs(expenseTransactions.filter(t => t.account_id === checkingId).reduce((sum, t) => sum + t.amount, 0)),
    chase: Math.abs(expenseTransactions.filter(t => t.account_id === chaseId).reduce((sum, t) => sum + t.amount, 0)),
    bilt: Math.abs(expenseTransactions.filter(t => t.account_id === biltId).reduce((sum, t) => sum + t.amount, 0)),
    gemini: Math.abs(expenseTransactions.filter(t => t.account_id === geminiId).reduce((sum, t) => sum + t.amount, 0)),
  };

  // Top merchants (group by normalized description)
  const merchantGroups = new Map<string, { total: number; count: number }>();
  for (const txn of expenseTransactions) {
    const merchant = normalizeMerchantName(txn.description);
    const existing = merchantGroups.get(merchant) || { total: 0, count: 0 };
    merchantGroups.set(merchant, {
      total: existing.total + Math.abs(txn.amount),
      count: existing.count + 1,
    });
  }

  const topMerchants = Array.from(merchantGroups.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Large expenses (> $200)
  const largeExpenses = expenseTransactions
    .filter(t => Math.abs(t.amount) > 200)
    .map(t => ({
      id: t.id,
      date: t.normalized_date,
      description: t.description,
      amount: Math.abs(t.amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  if (largeExpenses.some(e => e.amount > 500)) {
    const count = largeExpenses.filter(e => e.amount > 500).length;
    flags.push(`${count} expense(s) over $500 in ${month}`);
  }

  const spending = {
    total: spendingTotal,
    byAccount,
    topMerchants,
    largeExpenses,
  };

  // 3. ALLOCATIONS
  const savingsTransactions = transactions.filter(t => t.category === 'savings_transfer');
  const zcashTransactions = transactions.filter(t => t.category === 'zcash_purchase');
  const creditPaymentTransactions = transactions.filter(t => t.category === 'credit_payment');

  const allocations = {
    savings: Math.abs(savingsTransactions.reduce((sum, t) => sum + t.amount, 0)),
    zcash: Math.abs(zcashTransactions.reduce((sum, t) => sum + t.amount, 0)),
    creditPayments: Math.abs(creditPaymentTransactions.reduce((sum, t) => sum + t.amount, 0)),
  };

  // 4. CASH FLOW (checking account only)
  const checkingTransactions = transactions.filter(t => t.account_id === checkingId);

  const inflowTransactions = checkingTransactions.filter(t =>
    t.amount > 0 && ['income', 'refund', 'transfer_in', 'tax_refund'].includes(t.category)
  );
  const totalInflows = inflowTransactions.reduce((sum, t) => sum + t.amount, 0);

  const outflowTransactions = checkingTransactions.filter(t =>
    t.amount < 0 && ['expense', 'zcash_purchase', 'savings_transfer', 'credit_payment'].includes(t.category)
  );
  const totalOutflows = Math.abs(outflowTransactions.reduce((sum, t) => sum + t.amount, 0));

  const netChange = totalInflows - totalOutflows;

  const cashFlow = {
    startingBalance: null, // Would need historical balance tracking
    totalInflows,
    totalOutflows,
    netChange,
    endingBalance: null,
  };

  // 5. NON-OPERATING ITEMS
  const nonOperating = {
    taxRefunds: transactions.filter(t => t.category === 'tax_refund').reduce((sum, t) => sum + t.amount, 0),
    creditRewards: transactions.filter(t => t.category === 'credit_reward').reduce((sum, t) => sum + t.amount, 0),
    refunds: transactions.filter(t => t.category === 'refund').reduce((sum, t) => sum + t.amount, 0),
    transfersIn: transactions.filter(t => t.category === 'transfer_in').reduce((sum, t) => sum + t.amount, 0),
  };

  // 6. SUMMARY METRICS
  const totalAllocations = allocations.savings + allocations.zcash + allocations.creditPayments;
  const surplus = incomeTotal - spendingTotal - rentTotal - totalAllocations;
  const savingsRate = incomeTotal > 0 ? ((allocations.savings + allocations.zcash) / incomeTotal) * 100 : 0;
  const expenseRatio = incomeTotal > 0 ? ((spendingTotal + rentTotal) / incomeTotal) * 100 : 0;

  const summary = {
    surplus,
    savingsRate,
    expenseRatio,
  };

  // 7. CHECK SPENDING AGAINST AVERAGE
  // Get previous 3 months average
  const threeMonthsAgo = new Date(year, monthNum - 4, 1).toISOString().split('T')[0];
  const previousMonthEnd = new Date(year, monthNum - 1, 0).toISOString().split('T')[0];

  const previousExpenses = db.prepare(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE category = 'expense'
      AND normalized_date >= ?
      AND normalized_date <= ?
  `).get(threeMonthsAgo, previousMonthEnd) as { total: number | null };

  if (previousExpenses?.total) {
    const avgMonthlySpending = previousExpenses.total / 3;
    const percentIncrease = ((spendingTotal - avgMonthlySpending) / avgMonthlySpending) * 100;

    if (percentIncrease > 30) {
      flags.push(`Spending ${percentIncrease.toFixed(0)}% above 3-month average`);
    }
  }

  return {
    month,
    income,
    fixed,
    spending,
    allocations,
    cashFlow,
    nonOperating,
    flags,
    summary,
  };
}

/**
 * Analyze financial trends over multiple months
 */
export async function analyzeFinancials(monthCount: number = 3): Promise<FinancialTrends> {
  // Get list of months with data
  const monthsWithData = db.prepare(`
    SELECT DISTINCT substr(normalized_date, 1, 7) as month
    FROM transactions
    WHERE normalized_date IS NOT NULL
    ORDER BY month DESC
    LIMIT ?
  `).all(monthCount) as Array<{ month: string }>;

  // Close each month
  const months: MonthlyClose[] = [];
  for (const { month } of monthsWithData) {
    const closed = await closeMonth(month);
    months.push(closed);
  }

  // Calculate averages
  const totalMonths = months.length;
  const averages = {
    income: months.reduce((sum, m) => sum + m.income.total, 0) / totalMonths,
    spending: months.reduce((sum, m) => sum + m.spending.total, 0) / totalMonths,
    surplus: months.reduce((sum, m) => sum + m.summary.surplus, 0) / totalMonths,
    savingsRate: months.reduce((sum, m) => sum + m.summary.savingsRate, 0) / totalMonths,
  };

  // Calculate trends (compare first half to second half)
  const midpoint = Math.floor(totalMonths / 2);
  const recentMonths = months.slice(0, midpoint);
  const olderMonths = months.slice(midpoint);

  const recentAvgIncome = recentMonths.reduce((sum, m) => sum + m.income.total, 0) / recentMonths.length;
  const olderAvgIncome = olderMonths.reduce((sum, m) => sum + m.income.total, 0) / olderMonths.length;

  const recentAvgSpending = recentMonths.reduce((sum, m) => sum + m.spending.total, 0) / recentMonths.length;
  const olderAvgSpending = olderMonths.reduce((sum, m) => sum + m.spending.total, 0) / olderMonths.length;

  const recentAvgSurplus = recentMonths.reduce((sum, m) => sum + m.summary.surplus, 0) / recentMonths.length;
  const olderAvgSurplus = olderMonths.reduce((sum, m) => sum + m.summary.surplus, 0) / olderMonths.length;

  const trends = {
    incomeDirection: getTrendDirection(recentAvgIncome, olderAvgIncome),
    spendingDirection: getTrendDirection(recentAvgSpending, olderAvgSpending),
    surplusDirection: getTrendDirection(recentAvgSurplus, olderAvgSurplus),
  };

  // Generate insights
  const insights: string[] = [];

  const incomeChange = ((recentAvgIncome - olderAvgIncome) / olderAvgIncome) * 100;
  if (Math.abs(incomeChange) > 5) {
    insights.push(`Income ${incomeChange > 0 ? 'increased' : 'decreased'} ${Math.abs(incomeChange).toFixed(0)}% over last ${monthCount} months`);
  }

  const spendingChange = ((recentAvgSpending - olderAvgSpending) / olderAvgSpending) * 100;
  if (Math.abs(spendingChange) > 10) {
    insights.push(`Spending ${spendingChange > 0 ? 'increased' : 'decreased'} ${Math.abs(spendingChange).toFixed(0)}% over last ${monthCount} months`);
  }

  const avgSavingsRate = averages.savingsRate;
  if (avgSavingsRate > 30) {
    insights.push(`Strong savings rate: ${avgSavingsRate.toFixed(0)}% of income saved/invested`);
  } else if (avgSavingsRate < 10) {
    insights.push(`Low savings rate: Only ${avgSavingsRate.toFixed(0)}% of income saved/invested`);
  }

  if (trends.surplusDirection === 'decreasing') {
    insights.push('Surplus declining - spending growth outpacing income');
  }

  return {
    months,
    averages,
    trends,
    insights,
  };
}

/**
 * Get available months with transaction data
 */
export function getAvailableMonths(): string[] {
  const months = db.prepare(`
    SELECT DISTINCT substr(normalized_date, 1, 7) as month
    FROM transactions
    WHERE normalized_date IS NOT NULL
    ORDER BY month DESC
  `).all() as Array<{ month: string }>;

  return months.map(m => m.month);
}

// Helper functions

function normalizeMerchantName(description: string): string {
  // Remove transaction IDs, dates, and normalize merchant names
  let normalized = description.toLowerCase();

  // Remove common prefixes
  normalized = normalized.replace(/^(purchase authorized on|recurring payment authorized on|purchase)\s+/i, '');
  normalized = normalized.replace(/\d{2}\/\d{2}(\/\d{4})?\s*/g, ''); // Remove dates
  normalized = normalized.replace(/\s+\d{10,}\s*/g, ' '); // Remove long numbers
  normalized = normalized.replace(/\s+[a-z]\d+\w*\s*/gi, ' '); // Remove reference codes

  // Extract merchant name (first meaningful part)
  const parts = normalized.trim().split(/\s{2,}/);
  const merchant = parts[0].trim();

  // Truncate to reasonable length
  return merchant.substring(0, 40);
}

function getTrendDirection(recent: number, older: number): 'increasing' | 'stable' | 'decreasing' {
  const change = ((recent - older) / older) * 100;
  if (change > 5) return 'increasing';
  if (change < -5) return 'decreasing';
  return 'stable';
}
