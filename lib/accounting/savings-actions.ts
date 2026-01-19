import db from '../db';

export interface SavingsGoalAction {
  goalId: number;
  goalName: string;
  current: number;
  target: number;
  deadline: string;
  percentComplete: number;
  status: 'ahead' | 'on_track' | 'behind';
  projectedCompletionDate: string;
  requiredMonthlyContribution: number;
  actualMonthlyContribution: number;
  shortfall: number;
  action: 'transfer' | 'none';
  recommendedAmount: number;
  urgency: 'high' | 'medium' | 'low' | 'none';
  reason: string;
}

interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

interface Account {
  id: number;
  balance: number;
}

/**
 * Calculate what savings action is needed for a specific goal
 */
export function calculateSavingsAction(goalId: number): SavingsGoalAction {
  // 1. Get goal details
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId) as SavingsGoal | undefined;

  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  // 2. Get linked accounts and calculate current balance
  const linkedAccounts = db.prepare('SELECT id, balance FROM accounts WHERE goal_id = ?').all(goalId) as Account[];
  const currentAmount = linkedAccounts.reduce((sum, a) => sum + a.balance, 0);

  // 3. Use goal's deadline or default
  const deadline = goal.deadline || '2027-12-31';

  // 4. Calculate months remaining
  const monthsRemaining = monthsBetween(new Date().toISOString(), deadline);

  // 5. Calculate required monthly contribution
  const remaining = goal.target_amount - currentAmount;
  const requiredMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;

  // 6. Get 3-month average actual contribution
  // Query savings_transfer transactions to linked accounts
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

  const accountIds = linkedAccounts.map(a => a.id);
  let actualContributionsTotal = 0;

  if (accountIds.length > 0) {
    const placeholders = accountIds.map(() => '?').join(',');
    const result = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transactions
      WHERE account_id IN (${placeholders})
        AND category = 'savings_transfer'
        AND amount > 0
        AND normalized_date >= ?
    `).get(...accountIds, threeMonthsAgoStr) as { total: number };
    actualContributionsTotal = result?.total || 0;
  }

  const actualMonthlyAvg = actualContributionsTotal / 3;

  // 7. Calculate status based on progress vs time
  const progressPct = goal.target_amount > 0 ? currentAmount / goal.target_amount : 0;

  // Calculate what percentage of time has elapsed
  // Assume goal started ~24 months before deadline for House, ~12 months for Life
  const totalMonths = goal.name === 'House' ? 24 : 12;
  const monthsElapsed = Math.max(0, totalMonths - monthsRemaining);
  const timeElapsedPct = totalMonths > 0 ? monthsElapsed / totalMonths : 0;

  let status: 'ahead' | 'on_track' | 'behind';
  if (progressPct >= timeElapsedPct + 0.05) {
    status = 'ahead';
  } else if (progressPct >= timeElapsedPct - 0.05) {
    status = 'on_track';
  } else {
    status = 'behind';
  }

  // 8. Calculate shortfall
  const shortfall = requiredMonthly - actualMonthlyAvg;

  // 9. Determine action and recommendation
  let action: 'transfer' | 'none' = 'none';
  let recommendedAmount = 0;
  let urgency: 'high' | 'medium' | 'low' | 'none' = 'none';

  if (status === 'behind' && shortfall > 100) {
    action = 'transfer';
    // Recommend catching up over the next 2 months
    recommendedAmount = Math.min(shortfall * 2, requiredMonthly * 1.5);
    recommendedAmount = Math.round(recommendedAmount / 50) * 50; // Round to nearest $50

    if (monthsRemaining < 6) {
      urgency = 'high';
    } else if (monthsRemaining < 12) {
      urgency = 'medium';
    } else {
      urgency = 'low';
    }
  } else if (status === 'on_track' && shortfall > 50) {
    // Slight shortfall but still on track - gentle nudge
    action = 'transfer';
    recommendedAmount = Math.round(shortfall / 50) * 50;
    urgency = 'low';
  }

  // 10. Project completion date based on current rate
  let projectedCompletionDate: string;
  if (actualMonthlyAvg > 0 && remaining > 0) {
    const monthsToComplete = remaining / actualMonthlyAvg;
    const projectedDate = addMonths(new Date(), Math.ceil(monthsToComplete));
    projectedCompletionDate = projectedDate.toISOString().split('T')[0];
  } else if (remaining <= 0) {
    projectedCompletionDate = 'Complete';
  } else {
    projectedCompletionDate = 'Unknown';
  }

  // 11. Generate reason message
  const reason = generateReason(goal.name, status, shortfall, monthsRemaining, recommendedAmount, urgency);

  return {
    goalId,
    goalName: goal.name,
    current: currentAmount,
    target: goal.target_amount,
    deadline,
    percentComplete: progressPct * 100,
    status,
    projectedCompletionDate,
    requiredMonthlyContribution: requiredMonthly,
    actualMonthlyContribution: actualMonthlyAvg,
    shortfall: Math.max(0, shortfall),
    action,
    recommendedAmount,
    urgency,
    reason,
  };
}

/**
 * Calculate actions for all savings goals
 */
export function calculateAllSavingsActions(): SavingsGoalAction[] {
  const goals = db.prepare('SELECT id FROM savings_goals').all() as { id: number }[];
  return goals.map(g => calculateSavingsAction(g.id));
}

function generateReason(
  goalName: string,
  status: 'ahead' | 'on_track' | 'behind',
  shortfall: number,
  monthsRemaining: number,
  recommendedAmount: number,
  urgency: 'high' | 'medium' | 'low' | 'none'
): string {
  if (status === 'ahead') {
    return `${goalName} savings ahead of schedule - no action needed`;
  }

  if (status === 'on_track' && urgency === 'none') {
    return `${goalName} savings on track - no action needed`;
  }

  if (status === 'on_track' && urgency === 'low') {
    return `Transfer $${recommendedAmount} to ${goalName} to maintain pace`;
  }

  if (status === 'behind') {
    if (urgency === 'high') {
      return `Urgent: Transfer $${recommendedAmount} to ${goalName} - only ${monthsRemaining} months until deadline`;
    } else if (urgency === 'medium') {
      return `Transfer $${recommendedAmount} to ${goalName} this week to get back on track`;
    } else {
      return `Transfer $${recommendedAmount} to ${goalName} to stay on track`;
    }
  }

  return 'No action needed';
}

// Utility functions
function monthsBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  return Math.max(0, months);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
