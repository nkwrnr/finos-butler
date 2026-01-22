import db from './db';
import {
  detectIncomeProfile,
  analyzeExpenses,
  getCashFlowPosition,
  getZcashGoalStatus,
  type IncomeProfile,
  type ExpenseProfile,
  type CashFlowPosition,
  type ZcashGoalStatus,
} from './financial-intelligence';

export type RecommendationResult = {
  recommendation: 'buy' | 'wait' | 'blocked';
  amount: number;
  reasoning: string;
  details: RecommendationDetails;
};

export type PriceTier = 'dip' | 'normal' | 'spike' | 'unknown';

export type PriceMetrics = {
  currentPrice: number;
  avgPrice7d: number | null;
  priceChange7d: number | null;
  priceTier: PriceTier;
  priceAdjustment: number;
  priceReasoning: string | null;
};

export type RecommendationDetails = {
  incomeProfile: IncomeProfile;
  expenseProfile: ExpenseProfile;
  cashFlowPosition: CashFlowPosition;
  zcashGoal: ZcashGoalStatus;
  priceMetrics: PriceMetrics;
  calculations: {
    monthlyDiscretionary: number;
    availableForZcash: number;
    dailySustainableBudget: number;
    payCycleAdjustment: number;
    adjustedDailyBudget: number;
    zcashSpentThisWeek: number;
    zcashSpentToday: number;
    weeklyBudget: number;
    remainingWeekly: number;
    baseRecommendation: number;
    priceAdjustedRecommendation: number;
    finalRecommendation: number;
  };
  constraints: {
    safetyBuffer: number;
    maxDailyPurchase: number;
    discretionaryAllocation: number;
  };
  blockingReasons: string[];
  warnings: string[];
};

/**
 * Get 7-day average price from history
 */
function get7DayAveragePrice(): { avgPrice: number; days: number } | null {
  const result = db.prepare(`
    SELECT AVG(price_usd) as avg_price, COUNT(*) as days
    FROM zcash_price_history
    WHERE date >= date('now', '-7 days')
  `).get() as { avg_price: number | null; days: number } | undefined;

  if (!result || !result.avg_price || result.days < 1) {
    return null;
  }

  return { avgPrice: result.avg_price, days: result.days };
}

/**
 * Calculate price adjustment based on goal status and price momentum
 */
function calculatePriceAdjustment(
  currentPrice: number,
  goalStatus: 'ahead' | 'on-track' | 'behind'
): PriceMetrics {
  const avgData = get7DayAveragePrice();

  // Not enough price history
  if (!avgData || avgData.days < 3) {
    return {
      currentPrice,
      avgPrice7d: avgData?.avgPrice || null,
      priceChange7d: null,
      priceTier: 'unknown',
      priceAdjustment: 1.0,
      priceReasoning: avgData
        ? `Only ${avgData.days} day(s) of price history — need 3+ days for price-based adjustment`
        : 'No price history yet — price adjustment disabled',
    };
  }

  const priceChange = (currentPrice - avgData.avgPrice) / avgData.avgPrice;

  // Determine price tier
  let priceTier: PriceTier;
  if (priceChange <= -0.05) {
    priceTier = 'dip';
  } else if (priceChange >= 0.05) {
    priceTier = 'spike';
  } else {
    priceTier = 'normal';
  }

  // Adjustment matrix: [goalStatus][priceTier]
  const matrix: Record<string, Record<PriceTier, number>> = {
    behind: { dip: 1.30, normal: 1.10, spike: 1.00, unknown: 1.0 },
    'on-track': { dip: 1.20, normal: 1.00, spike: 0.85, unknown: 1.0 },
    ahead: { dip: 1.10, normal: 1.00, spike: 0.75, unknown: 1.0 },
  };

  const adjustment = matrix[goalStatus]?.[priceTier] ?? 1.0;

  // Generate reasoning
  let priceReasoning: string | null = null;
  const changePercent = Math.abs(priceChange * 100).toFixed(1);

  if (priceTier === 'dip') {
    priceReasoning = `Price is down ${changePercent}% vs 7-day avg ($${avgData.avgPrice.toFixed(2)}) — good buying opportunity`;
  } else if (priceTier === 'spike') {
    priceReasoning = `Price is up ${changePercent}% vs 7-day avg ($${avgData.avgPrice.toFixed(2)}) — consider waiting`;
  }

  if (adjustment !== 1.0 && priceReasoning) {
    const adjustPercent = ((adjustment - 1) * 100).toFixed(0);
    const sign = adjustment > 1 ? '+' : '';
    priceReasoning += `. Adjusting by ${sign}${adjustPercent}% (${goalStatus === 'on-track' ? 'on track' : goalStatus} on goal)`;
  }

  return {
    currentPrice,
    avgPrice7d: avgData.avgPrice,
    priceChange7d: priceChange,
    priceTier,
    priceAdjustment: adjustment,
    priceReasoning,
  };
}

/**
 * Generate daily Zcash purchase recommendation
 */
export async function generateZcashRecommendation(zcashPrice: number): Promise<RecommendationResult> {
  // Get strategy settings
  const settings = db.prepare('SELECT * FROM zcash_strategy_settings WHERE id = 1').get() as {
    target_zec: number;
    goal_deadline: string;
    max_daily_purchase: number;
    safety_buffer: number;
    discretionary_allocation: number;
  };

  const safetyBuffer = settings.safety_buffer;
  const maxDailyPurchase = settings.max_daily_purchase;
  const discretionaryAllocation = settings.discretionary_allocation;

  // Find checking account
  const checkingAccount = db.prepare(`
    SELECT id FROM accounts
    WHERE type = 'checking'
    ORDER BY balance DESC
    LIMIT 1
  `).get() as { id: number } | undefined;

  if (!checkingAccount) {
    return createBlockedRecommendation('No checking account found', settings, zcashPrice);
  }

  // Gather intelligence
  const incomeProfile = detectIncomeProfile(checkingAccount.id);
  const expenseProfile = analyzeExpenses(checkingAccount.id);
  const cashFlowPosition = getCashFlowPosition(checkingAccount.id, incomeProfile);
  const zcashGoal = getZcashGoalStatus(zcashPrice);

  // Calculate price adjustment based on goal status and price momentum
  const priceMetrics = calculatePriceAdjustment(zcashPrice, zcashGoal.status);

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // Check if goal deadline has passed
  const deadlineDate = new Date(settings.goal_deadline);
  const now = new Date();
  if (deadlineDate < now) {
    warnings.push(
      `Your Zcash goal deadline (${settings.goal_deadline}) has passed. Consider updating your goal in settings.`
    );
  }

  // STEP 1: Check Hard Stops
  if (cashFlowPosition.currentBalance < safetyBuffer + 500) {
    blockingReasons.push(
      `Your checking balance ($${cashFlowPosition.currentBalance.toFixed(2)}) is too low. ` +
      `Keep at least $${(safetyBuffer + 500).toFixed(2)} for safety.`
    );
  }

  // Check if close to payday with low balance
  if (
    incomeProfile.daysUntilNextPaycheck <= 3 &&
    incomeProfile.daysUntilNextPaycheck > 0 &&
    cashFlowPosition.balanceHealthScore < -0.2
  ) {
    blockingReasons.push(
      `Payday is in ${incomeProfile.daysUntilNextPaycheck} days and your balance is lower than usual. ` +
      `Wait for your deposit.`
    );
  }

  // STEP 2: Calculate Sustainable Daily Budget
  const monthlyIncome = incomeProfile.averageMonthlyIncome;
  const monthlyExpenses = expenseProfile.averageMonthlyExpenses;

  // For now, skip savings goal checking - can add later
  const monthlySavingsRequired = 0;

  const monthlyDiscretionary = monthlyIncome - monthlyExpenses - monthlySavingsRequired;

  if (monthlyDiscretionary <= 0) {
    blockingReasons.push(
      `Your monthly expenses ($${monthlyExpenses.toFixed(2)}) exceed your income ($${monthlyIncome.toFixed(2)}). ` +
      `Cannot afford Zcash purchases right now.`
    );
  }

  const availableForZcash = monthlyDiscretionary * discretionaryAllocation;
  const dailySustainableBudget = availableForZcash / 30;

  // STEP 3: Adjust for Pay Cycle Position
  let payCycleAdjustment = 1.0;
  if (cashFlowPosition.payCyclePosition < 0.3) {
    // Early in pay cycle (just got paid)
    payCycleAdjustment = 1.3;
  } else if (cashFlowPosition.payCyclePosition > 0.7) {
    // Late in pay cycle
    payCycleAdjustment = 0.5;
  }

  const adjustedDailyBudget = dailySustainableBudget * payCycleAdjustment;

  // STEP 4: Consider Recent Zcash Purchases
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const zcashSpentResult = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as total
    FROM zcash_purchases
    WHERE date >= ?
  `).get(sevenDaysAgo.toISOString().split('T')[0]) as { total: number };

  const zcashSpentThisWeek = zcashSpentResult.total;
  const weeklyBudget = dailySustainableBudget * 7;

  if (zcashSpentThisWeek >= weeklyBudget) {
    warnings.push(
      `You've already spent $${zcashSpentThisWeek.toFixed(2)} on Zcash this week, ` +
      `which meets your $${weeklyBudget.toFixed(2)} weekly budget.`
    );
  }

  // Check for same-day purchases
  const today = new Date().toISOString().split('T')[0];
  const todayPurchaseResult = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as total
    FROM zcash_purchases WHERE date = ?
  `).get(today) as { total: number };

  const todayPurchased = todayPurchaseResult.total;
  if (todayPurchased > 0) {
    warnings.push(`Already purchased $${todayPurchased.toFixed(0)} today`);
  }

  const remainingWeekly = Math.max(0, weeklyBudget - zcashSpentThisWeek);
  const todayMax = Math.min(adjustedDailyBudget, remainingWeekly);

  // STEP 5: Apply Final Constraints (base recommendation before price adjustment)
  let baseRecommendation = Math.min(
    todayMax,
    maxDailyPurchase,
    cashFlowPosition.currentBalance - safetyBuffer - cashFlowPosition.upcomingBills
  );

  // Don't recommend tiny amounts
  if (baseRecommendation < 10) {
    baseRecommendation = 0;
  }

  // Round to nearest dollar
  baseRecommendation = Math.floor(baseRecommendation);

  // STEP 6: Apply Price Adjustment
  let priceAdjustedRecommendation = Math.round(baseRecommendation * priceMetrics.priceAdjustment);

  // Still respect hard caps after price adjustment
  let finalRecommendation = Math.min(
    priceAdjustedRecommendation,
    maxDailyPurchase,
    Math.floor(cashFlowPosition.currentBalance - safetyBuffer - cashFlowPosition.upcomingBills)
  );

  // Don't recommend tiny amounts after adjustment
  if (finalRecommendation < 10) {
    finalRecommendation = 0;
  }

  const calculations = {
    monthlyDiscretionary,
    availableForZcash,
    dailySustainableBudget,
    payCycleAdjustment,
    adjustedDailyBudget,
    zcashSpentThisWeek,
    zcashSpentToday: todayPurchased,
    weeklyBudget,
    remainingWeekly,
    baseRecommendation,
    priceAdjustedRecommendation,
    finalRecommendation,
  };

  const constraints = {
    safetyBuffer,
    maxDailyPurchase,
    discretionaryAllocation,
  };

  const details: RecommendationDetails = {
    incomeProfile,
    expenseProfile,
    cashFlowPosition,
    zcashGoal,
    priceMetrics,
    calculations,
    constraints,
    blockingReasons,
    warnings,
  };

  // Determine final recommendation
  if (blockingReasons.length > 0) {
    return {
      recommendation: 'blocked',
      amount: 0,
      reasoning: blockingReasons[0],
      details,
    };
  }

  if (finalRecommendation === 0 || incomeProfile.confidence === 'low') {
    let waitReason = 'Unable to calculate a safe recommendation with current data.';

    if (incomeProfile.confidence === 'low') {
      waitReason = 'Not enough transaction history to confidently recommend an amount. Import more statements or check back later.';
    } else if (warnings.length > 0) {
      waitReason = warnings[0];
    } else if (cashFlowPosition.daysUntilPaycheck <= 5) {
      waitReason = `Payday is in ${cashFlowPosition.daysUntilPaycheck} days. Consider waiting for your deposit.`;
    }

    return {
      recommendation: 'wait',
      amount: 0,
      reasoning: waitReason,
      details,
    };
  }

  // Generate personalized reasoning
  const payCyclePhase =
    cashFlowPosition.payCyclePosition < 0.3 ? 'early in your pay cycle' :
    cashFlowPosition.payCyclePosition > 0.7 ? 'late in your pay cycle' :
    `${cashFlowPosition.daysSincePaycheck} days from payday`;

  const balanceHealth =
    cashFlowPosition.balanceHealthScore > 0.2 ? 'healthy' :
    cashFlowPosition.balanceHealthScore < -0.2 ? 'lower than usual' :
    'typical';

  let reasoning = `You're ${payCyclePhase} with a ${balanceHealth} balance. ` +
    `Based on your income (~$${monthlyIncome.toFixed(0)}/month), expenses (~$${monthlyExpenses.toFixed(0)}/month), ` +
    `and Zcash goal, $${finalRecommendation} is sustainable today.`;

  // Add price adjustment context to reasoning
  if (priceMetrics.priceReasoning && priceMetrics.priceAdjustment !== 1.0) {
    reasoning += ` ${priceMetrics.priceReasoning}`;
  }

  return {
    recommendation: 'buy',
    amount: finalRecommendation,
    reasoning,
    details,
  };
}

function createBlockedRecommendation(
  reason: string,
  settings: { safety_buffer: number; max_daily_purchase: number; discretionary_allocation: number },
  zcashPrice: number
): RecommendationResult {
  const emptyProfile: IncomeProfile = {
    averageMonthlyIncome: 0,
    lastPaycheckDate: null,
    estimatedNextPaycheckDate: null,
    payFrequency: 'unknown',
    daysSinceLastPaycheck: 0,
    daysUntilNextPaycheck: 0,
    confidence: 'low',
  };

  const emptyExpense: ExpenseProfile = {
    averageMonthlyExpenses: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
    dailyBurnRate: 0,
    recurringBills: [],
  };

  const emptyCashFlow: CashFlowPosition = {
    currentBalance: 0,
    daysSincePaycheck: 0,
    daysUntilPaycheck: 0,
    payCyclePosition: 0,
    balanceHealthScore: 0,
    upcomingBills: 0,
  };

  const zcashGoal = getZcashGoalStatus(zcashPrice);
  const priceMetrics = calculatePriceAdjustment(zcashPrice, zcashGoal.status);

  return {
    recommendation: 'blocked',
    amount: 0,
    reasoning: reason,
    details: {
      incomeProfile: emptyProfile,
      expenseProfile: emptyExpense,
      cashFlowPosition: emptyCashFlow,
      zcashGoal,
      priceMetrics,
      calculations: {
        monthlyDiscretionary: 0,
        availableForZcash: 0,
        dailySustainableBudget: 0,
        payCycleAdjustment: 0,
        adjustedDailyBudget: 0,
        zcashSpentThisWeek: 0,
        zcashSpentToday: 0,
        weeklyBudget: 0,
        remainingWeekly: 0,
        baseRecommendation: 0,
        priceAdjustedRecommendation: 0,
        finalRecommendation: 0,
      },
      constraints: {
        safetyBuffer: settings.safety_buffer,
        maxDailyPurchase: settings.max_daily_purchase,
        discretionaryAllocation: settings.discretionary_allocation,
      },
      blockingReasons: [reason],
      warnings: [],
    },
  };
}
