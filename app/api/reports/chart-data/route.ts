import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { analyzeFinancials } from '@/lib/accounting/monthly-close';

interface MonthlySpending {
  month: string;
  spending: number;
  income: number;
}

interface CategorySpending {
  name: string;
  amount: number;
  color: string;
}

interface GoalProgress {
  month: string;
  house: number;
  life: number;
}

export async function GET() {
  try {
    // Get 6 months of trends data
    const trends = await analyzeFinancials(6);

    // 1. Monthly spending trend (bar chart)
    const monthlySpending: MonthlySpending[] = trends.months.map((m) => ({
      month: formatMonthShort(m.month),
      spending: Math.round(m.spending.total),
      income: Math.round(m.income.total),
    }));

    // 2. Spending by category (pie chart) - current month
    const currentMonth = trends.months[0];
    const categorySpending: CategorySpending[] = [];

    if (currentMonth) {
      const { byAccount } = currentMonth.spending;

      // Add categories with amounts > 0
      if (byAccount.checking > 0) {
        categorySpending.push({ name: 'Checking', amount: Math.round(byAccount.checking), color: '#6366f1' });
      }
      if (byAccount.chase > 0) {
        categorySpending.push({ name: 'Chase', amount: Math.round(byAccount.chase), color: '#8b5cf6' });
      }
      if (byAccount.bilt > 0) {
        categorySpending.push({ name: 'Bilt', amount: Math.round(byAccount.bilt), color: '#a855f7' });
      }
      if (byAccount.gemini > 0) {
        categorySpending.push({ name: 'Gemini', amount: Math.round(byAccount.gemini), color: '#d946ef' });
      }

      // Add rent from fixed expenses
      if (currentMonth.fixed.rent > 0) {
        categorySpending.push({ name: 'Rent', amount: Math.round(currentMonth.fixed.rent), color: '#ec4899' });
      }

      // Add allocations
      if (currentMonth.allocations.zcash > 0) {
        categorySpending.push({ name: 'Zcash', amount: Math.round(currentMonth.allocations.zcash), color: '#f5b041' });
      }
      if (currentMonth.allocations.savings > 0) {
        categorySpending.push({ name: 'Savings', amount: Math.round(currentMonth.allocations.savings), color: '#22c55e' });
      }
    }

    // 3. Goal progress over time - calculate from transactions
    const goalProgress = await calculateGoalProgressOverTime();

    // 4. Income vs expenses (already have from trends)
    const incomeVsExpenses = trends.months.map((m) => ({
      month: formatMonthShort(m.month),
      income: Math.round(m.income.total),
      expenses: Math.round(m.spending.total + m.fixed.rent),
      surplus: Math.round(m.summary.surplus),
    }));

    return NextResponse.json({
      success: true,
      data: {
        monthlySpending,
        categorySpending,
        goalProgress,
        incomeVsExpenses,
        currentMonth: currentMonth?.month || null,
      },
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}

function formatMonthShort(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

async function calculateGoalProgressOverTime(): Promise<GoalProgress[]> {
  // Get all savings accounts linked to goals
  const goalAccounts = db.prepare(`
    SELECT a.id, a.name, a.goal_id, g.name as goal_name
    FROM accounts a
    JOIN savings_goals g ON a.goal_id = g.id
    WHERE a.type = 'savings'
  `).all() as Array<{
    id: number;
    name: string;
    goal_id: number;
    goal_name: string;
  }>;

  // Get house and life account IDs
  const houseAccounts = goalAccounts.filter((a) => a.goal_name === 'House').map((a) => a.id);
  const lifeAccounts = goalAccounts.filter((a) => a.goal_name === 'Life').map((a) => a.id);

  // Generate last 6 months
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const progress: GoalProgress[] = [];

  for (const month of months) {
    // Calculate cumulative balance at end of each month
    const endOfMonth = `${month}-31`;

    let houseTotal = 0;
    let lifeTotal = 0;

    // For house accounts
    for (const accountId of houseAccounts) {
      const result = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE account_id = ? AND date <= ?
      `).get(accountId, endOfMonth) as { total: number };
      houseTotal += result.total;
    }

    // For life accounts
    for (const accountId of lifeAccounts) {
      const result = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE account_id = ? AND date <= ?
      `).get(accountId, endOfMonth) as { total: number };
      lifeTotal += result.total;
    }

    progress.push({
      month: formatMonthShort(month),
      house: Math.round(houseTotal),
      life: Math.round(lifeTotal),
    });
  }

  return progress;
}
