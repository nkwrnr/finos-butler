import db from '../db';
import {
  detectIncomeProfile,
  analyzeExpenses,
  getCashFlowPosition,
  getZcashGoalStatus,
  type IncomeProfile,
  type ExpenseProfile,
} from '../financial-intelligence';
import { generateZcashRecommendation } from '../zcash-recommendation';
import { closeMonth } from './monthly-close';
import { calculateSavingsAction, type SavingsGoalAction } from './savings-actions';
import { calculateCashReservation } from '../recurring-expenses/cash-reservation';
import { briefingNeedsRefresh, getCachedBriefing } from '../data-pipeline/cache';

// Types
export interface DailyBriefing {
  date: string;

  cash: {
    checkingBalance: number;
    safetyBuffer: number;
    available: number;
  };

  payCycle: {
    lastPaycheck: string;
    nextPaycheck: string;
    daysSincePay: number;
    daysUntilPay: number;
    position: 'early' | 'mid' | 'late';
  };

  todayActions: {
    zcash: {
      action: 'buy' | 'skip' | 'wait';
      amount: number;
      reason: string;
    };
    houseSavings: {
      action: 'transfer' | 'none';
      amount: number;
      reason: string;
    };
    lifeSavings: {
      action: 'transfer' | 'none';
      amount: number;
      reason: string;
    };
    other: string[];
  };

  zcash: {
    recommendation: number;
    reasoning: string[];
    monthlyBudget: number;
    monthlySpent: number;
    monthlyRemaining: number;
    dailyRateForGoal: number;
    progressVsGoal: 'ahead' | 'on_track' | 'behind';
    currentZec: number;
    targetZec: number;
    deadline: string;
  };

  goals: GoalStatus[];

  upcoming: UpcomingEvent[];

  monthToDate: {
    income: number;
    paychecksReceived: number;
    spending: number;
    spendingVsAverage: number;
    zcashPurchased: number;
    savingsTransferred: number;
  };

  dailyBudget: {
    discretionaryRemaining: number;
    suggestedDailyLimit: number;
    spentToday: number;
  };

  insights: string[];
  alerts: Alert[];
}

export interface GoalStatus {
  name: string;
  current: number;
  target: number;
  deadline: string;
  percentComplete: number;
  status: 'ahead' | 'on_track' | 'behind';
  projectedCompletionDate: string;
  requiredMonthlyContribution: number;
  actualMonthlyContribution: number;
  shortfall: number;
  actionRequired: string | null;
}

export interface UpcomingEvent {
  description: string;
  estimatedAmount: number;
  estimatedDate: string;
  daysAway: number;
}

export interface Alert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

/**
 * Get daily briefing with caching and staleness check
 */
export async function getDailyBriefing(): Promise<DailyBriefing> {
  const today = new Date().toISOString().split('T')[0];

  // Check cache with staleness detection
  const cached = getCachedBriefing(today);

  if (cached) {
    // Check if data has changed since the briefing was cached
    const needsRefresh = briefingNeedsRefresh(cached.generated_at);

    if (!needsRefresh) {
      return JSON.parse(cached.briefing_json);
    }

    // Data changed since cache was created, delete stale cache
    db.prepare('DELETE FROM daily_briefings WHERE date = ?').run(today);
  }

  // Generate fresh briefing
  const briefing = await generateDailyBriefing();

  // Cache it
  db.prepare('INSERT OR REPLACE INTO daily_briefings (date, briefing_json, generated_at) VALUES (?, ?, ?)').run(
    today,
    JSON.stringify(briefing),
    new Date().toISOString()
  );

  return briefing;
}

/**
 * Invalidate today's cache and regenerate
 */
export async function refreshDailyBriefing(): Promise<DailyBriefing> {
  const today = new Date().toISOString().split('T')[0];
  db.prepare('DELETE FROM daily_briefings WHERE date = ?').run(today);
  return getDailyBriefing();
}

/**
 * Generate a full daily briefing
 */
export async function generateDailyBriefing(): Promise<DailyBriefing> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = todayStr.substring(0, 7);

  // 1. Get checking account
  const checkingAccount = db.prepare(`
    SELECT id, balance FROM accounts
    WHERE type = 'checking'
    ORDER BY balance DESC
    LIMIT 1
  `).get() as { id: number; balance: number } | undefined;

  if (!checkingAccount) {
    return createEmptyBriefing(todayStr, 'No checking account found');
  }

  // 2. Get strategy settings
  const settings = db.prepare('SELECT * FROM zcash_strategy_settings WHERE id = 1').get() as {
    target_zec: number;
    goal_deadline: string;
    max_daily_purchase: number;
    safety_buffer: number;
    discretionary_allocation: number;
  } | undefined;

  const safetyBuffer = settings?.safety_buffer || 2000;

  // 3. Gather financial intelligence
  const incomeProfile = detectIncomeProfile(checkingAccount.id);
  const expenseProfile = analyzeExpenses(checkingAccount.id);
  const cashFlowPosition = getCashFlowPosition(checkingAccount.id, incomeProfile);

  // 4. Get Zcash price and recommendation
  const priceCache = db.prepare('SELECT price_usd FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1').get() as { price_usd: number } | undefined;
  const price = priceCache?.price_usd || 40;
  const zcashStatus = getZcashGoalStatus(price);
  const zcashRec = await generateZcashRecommendation(price);

  // 5. Calculate savings actions for each goal
  const goals = db.prepare('SELECT id, name FROM savings_goals').all() as { id: number; name: string }[];
  const goalActions: SavingsGoalAction[] = goals.map(g => calculateSavingsAction(g.id));

  // 6. Get month-to-date data
  let monthlyClose;
  try {
    monthlyClose = await closeMonth(currentMonth);
  } catch (e) {
    monthlyClose = null;
  }

  // 7. Calculate month-to-date spending vs average
  const avgMonthlySpending = expenseProfile.averageMonthlyExpenses;
  const mtdSpending = monthlyClose?.spending.total || 0;
  const dayOfMonth = today.getDate();
  const expectedSpendingPace = (mtdSpending / dayOfMonth) * 30;
  const spendingVsAverage = avgMonthlySpending > 0
    ? Math.round(((expectedSpendingPace - avgMonthlySpending) / avgMonthlySpending) * 100)
    : 0;

  // 8. Calculate daily budget
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const monthlyIncome = incomeProfile.averageMonthlyIncome;
  const monthlyDiscretionary = monthlyIncome - expenseProfile.fixedExpenses - 2000 - 1500; // savings + zcash targets
  const discretionarySpent = mtdSpending;
  const discretionaryRemaining = Math.max(0, monthlyDiscretionary - discretionarySpent);
  const suggestedDailyLimit = daysRemaining > 0 ? discretionaryRemaining / daysRemaining : 0;

  // Today's spending
  const spentTodayResult = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE category = 'expense'
      AND normalized_date = ?
  `).get(todayStr) as { total: number };
  const spentToday = spentTodayResult?.total || 0;

  // 9. Build pay cycle info
  const payCyclePosition = calculatePayCyclePosition(incomeProfile);

  // 10. Build cash position
  const cash = {
    checkingBalance: cashFlowPosition.currentBalance,
    safetyBuffer,
    available: Math.max(0, cashFlowPosition.currentBalance - safetyBuffer),
  };

  // 11. Build today's actions
  const todayActions = buildTodayActions(zcashRec, goalActions);

  // 12. Build zcash details
  const zcashMonthlyBudget = (incomeProfile.averageMonthlyIncome - expenseProfile.averageMonthlyExpenses) * (settings?.discretionary_allocation || 0.5);
  const zcashMonthlySpent = monthlyClose?.allocations.zcash || 0;

  const zcash = {
    recommendation: zcashRec.amount,
    reasoning: [zcashRec.reasoning],
    monthlyBudget: zcashMonthlyBudget,
    monthlySpent: zcashMonthlySpent,
    monthlyRemaining: Math.max(0, zcashMonthlyBudget - zcashMonthlySpent),
    dailyRateForGoal: zcashStatus.dailyUsdTarget,
    progressVsGoal: mapZcashStatus(zcashStatus.status),
    currentZec: zcashStatus.currentZec,
    targetZec: zcashStatus.targetZec,
    deadline: zcashStatus.deadline,
  };

  // 13. Build goals status
  const goalsStatus: GoalStatus[] = goalActions.map(ga => ({
    name: ga.goalName,
    current: ga.current,
    target: ga.target,
    deadline: ga.deadline,
    percentComplete: ga.percentComplete,
    status: ga.status,
    projectedCompletionDate: ga.projectedCompletionDate,
    requiredMonthlyContribution: ga.requiredMonthlyContribution,
    actualMonthlyContribution: ga.actualMonthlyContribution,
    shortfall: ga.shortfall,
    actionRequired: ga.action === 'transfer' ? ga.reason : null,
  }));

  // 14. Build upcoming events (recurring bills + payday)
  const upcoming: UpcomingEvent[] = [];

  // Add recurring bills due in next 7 days
  const cashReservation = calculateCashReservation(checkingAccount.balance, 7);
  for (const bill of cashReservation.upcoming_bills) {
    // Only include high confidence bills
    if (bill.confidence === 'high' || bill.confidence === 'medium') {
      upcoming.push({
        description: `${bill.merchant} bill`,
        estimatedAmount: bill.predicted_amount,
        estimatedDate: bill.due_date,
        daysAway: bill.days_until_due,
      });
    }
  }

  // Add payday as upcoming event if within 7 days
  if (incomeProfile.daysUntilNextPaycheck > 0 && incomeProfile.daysUntilNextPaycheck <= 7) {
    upcoming.push({
      description: 'Payday',
      estimatedAmount: incomeProfile.averageMonthlyIncome / 2.17, // bi-weekly paycheck
      estimatedDate: incomeProfile.estimatedNextPaycheckDate || 'Unknown',
      daysAway: incomeProfile.daysUntilNextPaycheck,
    });
  }

  // Sort by days away
  upcoming.sort((a, b) => a.daysAway - b.daysAway);

  // 15. Build month-to-date summary
  const monthToDate = {
    income: monthlyClose?.income.total || 0,
    paychecksReceived: monthlyClose?.income.paycheckCount || 0,
    spending: mtdSpending,
    spendingVsAverage,
    zcashPurchased: zcashMonthlySpent,
    savingsTransferred: monthlyClose?.allocations.savings || 0,
  };

  // 16. Build daily budget
  const dailyBudget = {
    discretionaryRemaining,
    suggestedDailyLimit: Math.round(suggestedDailyLimit),
    spentToday,
  };

  // 17. Generate insights (including recurring expense insights)
  const insights = generateInsights({
    payCycle: payCyclePosition,
    cash,
    monthToDate,
    goals: goalsStatus,
    zcash,
    incomeProfile,
    expenseProfile,
    cashReservation,
  });

  // 18. Generate alerts
  const alerts = generateAlerts({
    cash,
    payCycle: payCyclePosition,
    goals: goalsStatus,
    monthToDate,
  });

  // 19. Check for duplicate transactions
  const duplicates = checkDuplicateTransactions();
  if (duplicates > 0) {
    todayActions.other.push(`Review ${duplicates} potential duplicate transaction(s)`);
  }

  return {
    date: todayStr,
    cash,
    payCycle: payCyclePosition,
    todayActions,
    zcash,
    goals: goalsStatus,
    upcoming,
    monthToDate,
    dailyBudget,
    insights,
    alerts,
  };
}

function calculatePayCyclePosition(incomeProfile: IncomeProfile): DailyBriefing['payCycle'] {
  const totalCycleDays = incomeProfile.daysSinceLastPaycheck + incomeProfile.daysUntilNextPaycheck;
  const cycleProgress = totalCycleDays > 0 ? incomeProfile.daysSinceLastPaycheck / totalCycleDays : 0;

  let position: 'early' | 'mid' | 'late';
  if (cycleProgress < 0.35) {
    position = 'early';
  } else if (cycleProgress < 0.70) {
    position = 'mid';
  } else {
    position = 'late';
  }

  return {
    lastPaycheck: incomeProfile.lastPaycheckDate || 'Unknown',
    nextPaycheck: incomeProfile.estimatedNextPaycheckDate || 'Unknown',
    daysSincePay: incomeProfile.daysSinceLastPaycheck,
    daysUntilPay: incomeProfile.daysUntilNextPaycheck,
    position,
  };
}

function buildTodayActions(
  zcashRec: Awaited<ReturnType<typeof generateZcashRecommendation>>,
  goalActions: SavingsGoalAction[]
): DailyBriefing['todayActions'] {
  // Map Zcash recommendation
  let zcashAction: 'buy' | 'skip' | 'wait';
  if (zcashRec.recommendation === 'buy') {
    zcashAction = 'buy';
  } else if (zcashRec.recommendation === 'blocked') {
    zcashAction = 'skip';
  } else {
    zcashAction = 'wait';
  }

  // Find House and Life goals
  const houseGoal = goalActions.find(g => g.goalName === 'House');
  const lifeGoal = goalActions.find(g => g.goalName === 'Life');

  return {
    zcash: {
      action: zcashAction,
      amount: zcashRec.amount,
      reason: zcashRec.reasoning,
    },
    houseSavings: {
      action: houseGoal?.action || 'none',
      amount: houseGoal?.recommendedAmount || 0,
      reason: houseGoal?.reason || 'On track',
    },
    lifeSavings: {
      action: lifeGoal?.action || 'none',
      amount: lifeGoal?.recommendedAmount || 0,
      reason: lifeGoal?.reason || 'On track',
    },
    other: [],
  };
}

function mapZcashStatus(status: 'ahead' | 'on-track' | 'behind'): 'ahead' | 'on_track' | 'behind' {
  if (status === 'on-track') return 'on_track';
  return status;
}

function generateInsights(data: {
  payCycle: DailyBriefing['payCycle'];
  cash: DailyBriefing['cash'];
  monthToDate: DailyBriefing['monthToDate'];
  goals: GoalStatus[];
  zcash: DailyBriefing['zcash'];
  incomeProfile: IncomeProfile;
  expenseProfile: ExpenseProfile;
  cashReservation: ReturnType<typeof calculateCashReservation>;
}): string[] {
  const insights: string[] = [];

  // Recurring expense insights
  if (data.cashReservation.upcoming_bills.length > 0) {
    const billsDueSoon = data.cashReservation.upcoming_bills.filter(b => b.days_until_due <= 3);
    if (billsDueSoon.length > 0) {
      const totalDue = billsDueSoon.reduce((sum, b) => sum + b.predicted_amount, 0);
      insights.push(`${billsDueSoon.length} bill(s) due in next 3 days ($${totalDue.toFixed(0)} total)`);
    }
  }

  // Cash reservation health
  if (data.cashReservation.health_status === 'tight') {
    insights.push(`Only $${data.cashReservation.true_available_cash.toFixed(0)} available after upcoming bills - tight buffer`);
  } else if (data.cashReservation.health_status === 'overdrawn') {
    insights.push(`Upcoming bills exceed current balance by $${Math.abs(data.cashReservation.true_available_cash).toFixed(0)}`);
  }

  // Pay cycle insights
  if (data.payCycle.position === 'early' && data.cash.available > 5000) {
    insights.push('Strong position early in pay cycle - good time for planned purchases or extra savings');
  }
  if (data.payCycle.position === 'late' && data.cash.available < 3000) {
    insights.push('Approaching payday with reduced buffer - consider postponing discretionary spending');
  }

  // Spending pace insight
  if (data.monthToDate.spendingVsAverage > 20) {
    insights.push(`Spending pace ${data.monthToDate.spendingVsAverage}% above your monthly average`);
  } else if (data.monthToDate.spendingVsAverage < -15) {
    insights.push(`Spending ${Math.abs(data.monthToDate.spendingVsAverage)}% below average - extra room for savings`);
  }

  // Goals insights
  for (const goal of data.goals) {
    if (goal.status === 'behind' && goal.shortfall > 500) {
      const shortfallPct = Math.round((goal.shortfall / goal.requiredMonthlyContribution) * 100);
      insights.push(`${goal.name} savings ${shortfallPct}% below target pace`);
    }
    if (goal.status === 'ahead') {
      insights.push(`${goal.name} savings ahead of schedule`);
    }
  }

  // Zcash insights
  if (data.zcash.progressVsGoal === 'behind') {
    insights.push(`Zcash accumulation behind schedule - need $${data.zcash.dailyRateForGoal.toFixed(0)}/day to reach ${data.zcash.targetZec} ZEC by deadline`);
  }

  // Payday insight
  if (data.payCycle.daysUntilPay === 1) {
    insights.push('Payday tomorrow - good time to plan allocations');
  }

  return insights.slice(0, 5); // Limit to 5 insights
}

function generateAlerts(data: {
  cash: DailyBriefing['cash'];
  payCycle: DailyBriefing['payCycle'];
  goals: GoalStatus[];
  monthToDate: DailyBriefing['monthToDate'];
}): Alert[] {
  const alerts: Alert[] = [];

  // Critical: Below safety buffer
  if (data.cash.available < 0) {
    alerts.push({
      level: 'critical',
      message: `Below safety buffer by $${Math.abs(data.cash.available).toFixed(0)} - avoid all discretionary spending`,
    });
  }

  // Critical: Payday far away with low balance
  if (data.payCycle.daysUntilPay > 5 && data.cash.available < 1000) {
    alerts.push({
      level: 'critical',
      message: `Only $${data.cash.available.toFixed(0)} available with ${data.payCycle.daysUntilPay} days until payday`,
    });
  }

  // Warning: Goal significantly behind
  for (const goal of data.goals) {
    if (goal.status === 'behind' && goal.actionRequired) {
      alerts.push({
        level: 'warning',
        message: goal.actionRequired,
      });
    }
  }

  // Warning: Spending spike
  if (data.monthToDate.spendingVsAverage > 30) {
    alerts.push({
      level: 'warning',
      message: `Spending ${data.monthToDate.spendingVsAverage}% above average this month`,
    });
  }

  // Info: Low balance but payday soon
  if (data.cash.available < 2000 && data.payCycle.daysUntilPay <= 3 && data.payCycle.daysUntilPay > 0) {
    alerts.push({
      level: 'info',
      message: `Balance low but payday is in ${data.payCycle.daysUntilPay} day(s)`,
    });
  }

  return alerts;
}

function checkDuplicateTransactions(): number {
  // Check for potential duplicates in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const duplicates = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT normalized_date, amount, description, COUNT(*) as cnt
      FROM transactions
      WHERE normalized_date >= ?
      GROUP BY normalized_date, amount, description
      HAVING cnt > 1
    )
  `).get(thirtyDaysAgo.toISOString().split('T')[0]) as { count: number };

  return duplicates?.count || 0;
}

function createEmptyBriefing(date: string, error: string): DailyBriefing {
  return {
    date,
    cash: { checkingBalance: 0, safetyBuffer: 2000, available: 0 },
    payCycle: { lastPaycheck: 'Unknown', nextPaycheck: 'Unknown', daysSincePay: 0, daysUntilPay: 0, position: 'mid' },
    todayActions: {
      zcash: { action: 'skip', amount: 0, reason: error },
      houseSavings: { action: 'none', amount: 0, reason: error },
      lifeSavings: { action: 'none', amount: 0, reason: error },
      other: [],
    },
    zcash: {
      recommendation: 0,
      reasoning: [error],
      monthlyBudget: 0,
      monthlySpent: 0,
      monthlyRemaining: 0,
      dailyRateForGoal: 0,
      progressVsGoal: 'behind',
      currentZec: 0,
      targetZec: 100,
      deadline: '2025-12-31',
    },
    goals: [],
    upcoming: [],
    monthToDate: {
      income: 0,
      paychecksReceived: 0,
      spending: 0,
      spendingVsAverage: 0,
      zcashPurchased: 0,
      savingsTransferred: 0,
    },
    dailyBudget: { discretionaryRemaining: 0, suggestedDailyLimit: 0, spentToday: 0 },
    insights: [],
    alerts: [{ level: 'critical', message: error }],
  };
}
