import db from './db';

export type IncomeProfile = {
  averageMonthlyIncome: number;
  lastPaycheckDate: string | null;
  estimatedNextPaycheckDate: string | null;
  payFrequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' | 'unknown';
  daysSinceLastPaycheck: number;
  daysUntilNextPaycheck: number;
  confidence: 'high' | 'medium' | 'low';
};

export type ExpenseProfile = {
  averageMonthlyExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  dailyBurnRate: number;
  recurringBills: Array<{ description: string; amount: number; frequency: string }>;
};

export type CashFlowPosition = {
  currentBalance: number;
  daysSincePaycheck: number;
  daysUntilPaycheck: number;
  payCyclePosition: number; // 0.0 to 1.0
  balanceHealthScore: number; // -1 (low) to 1 (high) relative to typical
  upcomingBills: number;
};

export type SavingsGoalStatus = {
  goalId: number;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  monthlyRequired: number;
  monthlyActual: number;
  monthsBehind: number;
  status: 'ahead' | 'on-track' | 'behind';
};

export type ZcashGoalStatus = {
  targetZec: number;
  currentZec: number;
  zcashNeeded: number;
  deadline: string;
  monthsRemaining: number;
  currentPrice: number;
  usdNeeded: number;
  monthlyUsdRequired: number;
  dailyUsdTarget: number;
  status: 'ahead' | 'on-track' | 'behind';
};

/**
 * Detect income pattern from checking account transactions
 * Only analyzes recent transactions (last 90 days)
 * Uses categorized 'income' transactions (payroll only)
 */
export function detectIncomeProfile(accountId: number): IncomeProfile {
  // Get unique payroll deposits (deduplicated by date, taking max amount)
  // This handles duplicate entries from statement imports
  const deposits = db.prepare(`
    SELECT normalized_date as date, MAX(amount) as amount, description
    FROM transactions
    WHERE account_id = ?
      AND category = 'income'
      AND amount > 1000
      AND normalized_date >= date('now', '-90 days')
    GROUP BY normalized_date
    ORDER BY normalized_date DESC
    LIMIT 50
  `).all(accountId) as Array<{ date: string; amount: number; description: string }>;

  // Parse dates for interval calculation
  const depositsWithParsed = deposits.map(d => ({
    ...d,
    parsedDate: new Date(d.date)
  }));

  if (depositsWithParsed.length < 2) {
    return {
      averageMonthlyIncome: 0,
      lastPaycheckDate: null,
      estimatedNextPaycheckDate: null,
      payFrequency: 'unknown',
      daysSinceLastPaycheck: 0,
      daysUntilNextPaycheck: 0,
      confidence: 'low',
    };
  }

  // All deposits are already filtered and deduplicated
  const payrollDeposits = depositsWithParsed;

  if (payrollDeposits.length < 2) {
    // Fallback: use all deposits
    const avgIncome = depositsWithParsed.slice(0, 6).reduce((sum, d) => sum + d.amount, 0) / Math.min(6, depositsWithParsed.length);
    return {
      averageMonthlyIncome: avgIncome,
      lastPaycheckDate: depositsWithParsed[0].date,
      estimatedNextPaycheckDate: null,
      payFrequency: 'unknown',
      daysSinceLastPaycheck: daysBetween(depositsWithParsed[0].parsedDate, new Date()),
      daysUntilNextPaycheck: 0,
      confidence: 'low',
    };
  }

  // Calculate days between paychecks using parsed dates
  const intervals: number[] = [];
  for (let i = 0; i < payrollDeposits.length - 1; i++) {
    const days = daysBetween(payrollDeposits[i + 1].parsedDate, payrollDeposits[i].parsedDate);
    if (days > 0 && days < 45) intervals.push(days);
  }

  if (intervals.length === 0) {
    const avgIncome = payrollDeposits.slice(0, 3).reduce((sum, d) => sum + d.amount, 0) / Math.min(3, payrollDeposits.length);
    return {
      averageMonthlyIncome: avgIncome,
      lastPaycheckDate: payrollDeposits[0].date,
      estimatedNextPaycheckDate: null,
      payFrequency: 'unknown',
      daysSinceLastPaycheck: daysBetween(payrollDeposits[0].parsedDate, new Date()),
      daysUntilNextPaycheck: 0,
      confidence: 'low',
    };
  }

  const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;

  // Determine pay frequency
  let payFrequency: IncomeProfile['payFrequency'];
  let payCycleDays: number;
  if (avgInterval >= 6 && avgInterval <= 8) {
    payFrequency = 'weekly';
    payCycleDays = 7;
  } else if (avgInterval >= 13 && avgInterval <= 15) {
    payFrequency = 'bi-weekly';
    payCycleDays = 14;
  } else if (avgInterval >= 14 && avgInterval <= 16) {
    payFrequency = 'semi-monthly';
    payCycleDays = 15;
  } else if (avgInterval >= 28 && avgInterval <= 32) {
    payFrequency = 'monthly';
    payCycleDays = 30;
  } else {
    payFrequency = 'unknown';
    payCycleDays = avgInterval;
  }

  const lastPaycheckDate = payrollDeposits[0].date;
  const daysSince = daysBetween(payrollDeposits[0].parsedDate, new Date());
  const estimatedNextDate = addDays(lastPaycheckDate, payCycleDays);
  const daysUntil = daysBetween(new Date(), new Date(estimatedNextDate));

  // Calculate monthly income
  const recentPaychecks = payrollDeposits.slice(0, Math.min(6, payrollDeposits.length));
  const avgPaycheck = recentPaychecks.reduce((sum, d) => sum + d.amount, 0) / recentPaychecks.length;

  let monthlyIncome: number;
  if (payFrequency === 'weekly') {
    monthlyIncome = avgPaycheck * 4.33;
  } else if (payFrequency === 'bi-weekly') {
    monthlyIncome = avgPaycheck * 2.17;
  } else if (payFrequency === 'semi-monthly') {
    monthlyIncome = avgPaycheck * 2;
  } else if (payFrequency === 'monthly') {
    monthlyIncome = avgPaycheck;
  } else {
    monthlyIncome = avgPaycheck * (30 / payCycleDays);
  }

  const confidence = intervals.length >= 4 && payFrequency !== 'unknown' ? 'high' :
                     intervals.length >= 2 ? 'medium' : 'low';

  return {
    averageMonthlyIncome: monthlyIncome,
    lastPaycheckDate,
    estimatedNextPaycheckDate: estimatedNextDate,
    payFrequency,
    daysSinceLastPaycheck: daysSince,
    daysUntilNextPaycheck: Math.max(0, daysUntil),
    confidence,
  };
}

/**
 * Analyze expense patterns
 * Only analyzes recent transactions (last 90 days)
 * Uses categorized 'expense' transactions only (excludes Zcash, savings, credit payments)
 */
export function analyzeExpenses(accountId: number): ExpenseProfile {
  // Get expense transactions from last 90 days using categorized data
  const expenses = db.prepare(`
    SELECT date, amount, description, normalized_date
    FROM transactions
    WHERE account_id = ?
      AND category = 'expense'
      AND normalized_date >= date('now', '-90 days')
    ORDER BY normalized_date DESC
  `).all(accountId) as Array<{ date: string; amount: number; description: string; normalized_date: string }>;

  if (expenses.length === 0) {
    return {
      averageMonthlyExpenses: 0,
      fixedExpenses: 0,
      variableExpenses: 0,
      dailyBurnRate: 0,
      recurringBills: [],
    };
  }

  // Calculate total expenses over the period
  const totalExpenses = Math.abs(expenses.reduce((sum, e) => sum + e.amount, 0));

  // Get date range (use actual 90 days, not the data range)
  const daysSpanned = 90;
  const monthsSpanned = 3; // 90 days = 3 months

  const avgMonthlyExpenses = totalExpenses / monthsSpanned;
  const dailyBurnRate = avgMonthlyExpenses / 30; // Daily burn rate is monthly expenses / 30

  // Detect recurring bills (same description, similar amounts)
  const recurringBills: ExpenseProfile['recurringBills'] = [];
  const descriptionGroups = new Map<string, number[]>();

  expenses.forEach(exp => {
    const normalizedDesc = exp.description.toLowerCase().replace(/\d+/g, '').trim();
    if (!descriptionGroups.has(normalizedDesc)) {
      descriptionGroups.set(normalizedDesc, []);
    }
    descriptionGroups.get(normalizedDesc)!.push(Math.abs(exp.amount));
  });

  descriptionGroups.forEach((amounts, desc) => {
    if (amounts.length >= 2) {
      const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const variance = amounts.reduce((sum, a) => sum + Math.abs(a - avgAmount), 0) / amounts.length;

      // If variance is low, it's likely a recurring bill
      if (variance / avgAmount < 0.2 && avgAmount > 10) {
        recurringBills.push({
          description: desc,
          amount: avgAmount,
          frequency: amounts.length >= 4 ? 'monthly' : 'occasional',
        });
      }
    }
  });

  const fixedExpenses = recurringBills
    .filter(b => b.frequency === 'monthly')
    .reduce((sum, b) => sum + b.amount, 0);
  const variableExpenses = avgMonthlyExpenses - fixedExpenses;

  return {
    averageMonthlyExpenses: avgMonthlyExpenses,
    fixedExpenses,
    variableExpenses: Math.max(0, variableExpenses),
    dailyBurnRate,
    recurringBills: recurringBills.slice(0, 10), // Top 10
  };
}

/**
 * Calculate account balance using ledger approach
 * Formula: Baseline Balance + SUM(transactions after baseline date)
 */
export function calculateAccountBalance(accountId: number): number {
  const account = db.prepare(
    'SELECT balance, baseline_balance, baseline_date FROM accounts WHERE id = ?'
  ).get(accountId) as { balance: number; baseline_balance: number | null; baseline_date: string | null } | undefined;

  if (!account) return 0;

  // If no baseline set, use stored balance
  if (!account.baseline_date || account.baseline_balance === null) {
    return account.balance || 0;
  }

  // Calculate: baseline + net change after baseline date
  const result = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as net_change
    FROM transactions
    WHERE account_id = ? AND normalized_date > ?
  `).get(accountId, account.baseline_date) as { net_change: number };

  return account.baseline_balance + result.net_change;
}

/**
 * Get current cash flow position
 */
export function getCashFlowPosition(accountId: number, incomeProfile: IncomeProfile): CashFlowPosition {
  const currentBalance = calculateAccountBalance(accountId);

  const payCyclePosition = incomeProfile.daysSinceLastPaycheck /
    (incomeProfile.daysSinceLastPaycheck + incomeProfile.daysUntilNextPaycheck);

  // Estimate typical balance at this point (simple linear model)
  // Assumes balance is highest right after payday, decreases linearly
  const expenseProfile = analyzeExpenses(accountId);
  const estimatedSpendSincePayday = expenseProfile.dailyBurnRate * incomeProfile.daysSinceLastPaycheck;
  const typicalBalanceNow = incomeProfile.averageMonthlyIncome - estimatedSpendSincePayday;

  const balanceHealthScore = typicalBalanceNow > 0
    ? Math.max(-1, Math.min(1, (currentBalance - typicalBalanceNow) / typicalBalanceNow))
    : 0;

  // Estimate upcoming bills in next 7 days
  const upcomingBills = expenseProfile.recurringBills
    .filter(b => b.frequency === 'monthly')
    .reduce((sum, b) => sum + b.amount, 0) * 0.25; // Rough estimate

  return {
    currentBalance,
    daysSincePaycheck: incomeProfile.daysSinceLastPaycheck,
    daysUntilPaycheck: incomeProfile.daysUntilNextPaycheck,
    payCyclePosition,
    balanceHealthScore,
    upcomingBills,
  };
}

/**
 * Get Zcash goal status
 */
export function getZcashGoalStatus(currentPrice: number): ZcashGoalStatus {
  const settings = db.prepare('SELECT * FROM zcash_strategy_settings WHERE id = 1')
    .get() as { target_zec: number; goal_deadline: string } | undefined;

  const targetZec = settings?.target_zec || 100;
  const deadline = settings?.goal_deadline || '2025-12-31';

  const sources = db.prepare('SELECT SUM(zec_amount) as total FROM zcash_sources')
    .get() as { total: number | null };
  const currentZec = sources?.total || 0;

  const zcashNeeded = Math.max(0, targetZec - currentZec);
  const monthsRemaining = monthsBetween(new Date().toISOString(), deadline);
  const usdNeeded = zcashNeeded * currentPrice;
  const monthlyUsdRequired = monthsRemaining > 0 ? usdNeeded / monthsRemaining : usdNeeded;
  const dailyUsdTarget = monthlyUsdRequired / 30;

  const progressPct = targetZec > 0 ? currentZec / targetZec : 0;
  const timePct = 1 - (monthsRemaining / 12); // Assuming 12 month goal period

  let status: ZcashGoalStatus['status'];
  if (progressPct >= timePct + 0.1) {
    status = 'ahead';
  } else if (progressPct >= timePct - 0.1) {
    status = 'on-track';
  } else {
    status = 'behind';
  }

  return {
    targetZec,
    currentZec,
    zcashNeeded,
    deadline,
    monthsRemaining: Math.max(0, monthsRemaining),
    currentPrice,
    usdNeeded,
    monthlyUsdRequired,
    dailyUsdTarget,
    status,
  };
}

// Utility functions

/**
 * Parse dates that may be in MM/DD or MM/DD/YYYY or YYYY-MM-DD format
 * Assumes MM/DD dates without year are from the current year or previous year
 */
function parseFlexibleDate(dateStr: string): Date {
  // Handle YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateStr);
  }

  // Handle MM/DD/YYYY format
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    return new Date(dateStr);
  }

  // Handle MM/DD format (no year)
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const now = new Date();
    const currentYear = now.getFullYear();

    // Try current year first
    let date = new Date(currentYear, month - 1, day);

    // If the date is in the future, it's probably from last year
    if (date > now) {
      date = new Date(currentYear - 1, month - 1, day);
    }

    return date;
  }

  // Fallback to attempting native Date parsing
  return new Date(dateStr);
}

function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = typeof date1 === 'string' ? parseFlexibleDate(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseFlexibleDate(date2) : date2;
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, days: number): string {
  const d = parseFlexibleDate(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function monthsBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  return Math.max(0, months);
}
