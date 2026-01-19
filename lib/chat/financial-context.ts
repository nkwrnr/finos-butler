import db from '../db';
import { getDailyBriefing, type DailyBriefing } from '../accounting/daily-briefing';
import { detectIncomeProfile, analyzeExpenses } from '../financial-intelligence';
import { CATEGORY_DISPLAY_NAMES, type SpendingCategory } from '../categorization/types';

// Account info with rewards metadata
export interface AccountInfo {
  id: number;
  name: string;
  institution: string;
  type: string;
  balance: number;
  purpose: string;
  rewards?: string;
}

// Spending aggregated by category
export interface SpendingByCategory {
  category: string;
  total: number;
  count: number;
}

// Recent transaction for context
export interface RecentTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

// Goal with progress
export interface GoalProgress {
  name: string;
  current: number;
  target: number;
  deadline: string;
  percentComplete: number;
  monthlyRequired: number;
  status: 'ahead' | 'on_track' | 'behind';
}

// Zcash goal details
export interface ZcashGoalInfo {
  currentZec: number;
  targetZec: number;
  deadline: string;
  currentPrice: number;
  dailyTargetUsd: number;
  monthlyBudget: number;
  monthlySpent: number;
  status: 'ahead' | 'on_track' | 'behind';
}

// Financial metrics summary
export interface FinancialMetrics {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyDiscretionary: number;
  dailyBudget: number;
  safetyBuffer: number;
  savingsRate: number;
}

// Complete financial context for the AI
export interface FinancialContext {
  briefing: DailyBriefing;
  accounts: AccountInfo[];
  recentTransactions: RecentTransaction[];
  spendingByCategory: SpendingByCategory[];
  goals: GoalProgress[];
  zcashGoal: ZcashGoalInfo | null;
  metrics: FinancialMetrics;
  timestamp: string;
}

// Credit card rewards metadata (from CLAUDE.md)
const CARD_REWARDS: Record<string, string> = {
  'Chase': '3% dining, 1.5% everything else',
  'Gemini': 'Crypto rewards on all purchases',
  'Bilt': 'Rent payments only (1x points)',
};

// Account purposes based on type
const ACCOUNT_PURPOSES: Record<string, string> = {
  'checking': 'Primary cash account for income and expenses',
  'savings': 'Goal-linked savings account',
  'credit_card': 'Spending instrument',
};

/**
 * Build complete financial context for chat
 */
export async function buildFinancialContext(): Promise<FinancialContext> {
  const timestamp = new Date().toISOString();

  // 1. Get cached daily briefing (refreshes if stale)
  const briefing = await getDailyBriefing();

  // 2. Get accounts with enrichment
  const accountRows = db.prepare(`
    SELECT a.id, a.name, a.institution, a.type, a.balance, sg.name as goal_name
    FROM accounts a
    LEFT JOIN savings_goals sg ON a.goal_id = sg.id
  `).all() as Array<{
    id: number;
    name: string;
    institution: string;
    type: string;
    balance: number;
    goal_name: string | null;
  }>;

  const accounts: AccountInfo[] = accountRows.map(a => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    type: a.type,
    balance: a.balance,
    purpose: a.goal_name
      ? `Savings for ${a.goal_name} goal`
      : ACCOUNT_PURPOSES[a.type] || 'Financial account',
    rewards: CARD_REWARDS[a.institution],
  }));

  // 3. Get recent transactions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const transactionRows = db.prepare(`
    SELECT t.normalized_date as date, t.description, t.amount, t.category, a.name as account
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.normalized_date >= ?
    ORDER BY t.normalized_date DESC
    LIMIT 100
  `).all(thirtyDaysAgo.toISOString().split('T')[0]) as Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
    account: string;
  }>;

  const recentTransactions: RecentTransaction[] = transactionRows.map(t => ({
    date: t.date,
    description: t.description,
    amount: t.amount,
    category: t.category || 'uncategorized',
    account: t.account,
  }));

  // 4. Get spending by category using the spending_category column (last 30 days)
  const spendingRows = db.prepare(`
    SELECT
      COALESCE(spending_category, 'uncategorized') as spend_category,
      SUM(ABS(amount)) as total,
      COUNT(*) as count
    FROM transactions
    WHERE category = 'expense'
      AND normalized_date >= ?
    GROUP BY spending_category
    ORDER BY total DESC
  `).all(thirtyDaysAgo.toISOString().split('T')[0]) as Array<{
    spend_category: SpendingCategory;
    total: number;
    count: number;
  }>;

  const spendingByCategory: SpendingByCategory[] = spendingRows.map(r => ({
    category: CATEGORY_DISPLAY_NAMES[r.spend_category] || r.spend_category,
    total: r.total,
    count: r.count,
  }));

  // 5. Get goals from briefing (already enriched)
  const goals: GoalProgress[] = briefing.goals.map(g => ({
    name: g.name,
    current: g.current,
    target: g.target,
    deadline: g.deadline,
    percentComplete: g.percentComplete,
    monthlyRequired: g.requiredMonthlyContribution,
    status: g.status,
  }));

  // 6. Build Zcash goal info
  let zcashGoal: ZcashGoalInfo | null = null;
  if (briefing.zcash) {
    const priceRow = db.prepare(
      'SELECT price_usd FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1'
    ).get() as { price_usd: number } | undefined;

    zcashGoal = {
      currentZec: briefing.zcash.currentZec,
      targetZec: briefing.zcash.targetZec,
      deadline: briefing.zcash.deadline,
      currentPrice: priceRow?.price_usd || 40,
      dailyTargetUsd: briefing.zcash.dailyRateForGoal,
      monthlyBudget: briefing.zcash.monthlyBudget,
      monthlySpent: briefing.zcash.monthlySpent,
      status: briefing.zcash.progressVsGoal,
    };
  }

  // 7. Calculate financial metrics
  const checkingAccount = accounts.find(a => a.type === 'checking');
  const incomeProfile = checkingAccount
    ? detectIncomeProfile(checkingAccount.id)
    : { averageMonthlyIncome: 0 };
  const expenseProfile = checkingAccount
    ? analyzeExpenses(checkingAccount.id)
    : { averageMonthlyExpenses: 0, fixedExpenses: 0 };

  const monthlyIncome = incomeProfile.averageMonthlyIncome;
  const monthlyExpenses = expenseProfile.averageMonthlyExpenses;
  const monthlyDiscretionary = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0
    ? ((briefing.monthToDate.savingsTransferred + briefing.monthToDate.zcashPurchased) / (monthlyIncome / 2)) * 100
    : 0;

  const metrics: FinancialMetrics = {
    monthlyIncome,
    monthlyExpenses,
    monthlyDiscretionary,
    dailyBudget: briefing.dailyBudget.suggestedDailyLimit,
    safetyBuffer: briefing.cash.safetyBuffer,
    savingsRate: Math.min(100, savingsRate),
  };

  return {
    briefing,
    accounts,
    recentTransactions,
    spendingByCategory,
    goals,
    zcashGoal,
    metrics,
    timestamp,
  };
}

/**
 * Get a simplified context summary for response metadata
 */
export function getContextSummary(ctx: FinancialContext): {
  checkingBalance: number;
  available: number;
  daysUntilPay: number;
  dailyBudget: number;
} {
  return {
    checkingBalance: ctx.briefing.cash.checkingBalance,
    available: ctx.briefing.cash.available,
    daysUntilPay: ctx.briefing.payCycle.daysUntilPay,
    dailyBudget: ctx.briefing.dailyBudget.suggestedDailyLimit,
  };
}
