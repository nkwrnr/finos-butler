import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // 1. CATEGORY BREAKDOWN
    const categoryBreakdown = db.prepare(`
      SELECT
        category,
        COUNT(*) as count,
        SUM(ABS(amount)) as total
      FROM transactions
      GROUP BY category
      ORDER BY COUNT(*) DESC
    `).all() as Array<{ category: string; count: number; total: number }>;

    // 2. DATA QUALITY CHECKS

    // Check for duplicates
    const duplicates = db.prepare(`
      SELECT COUNT(*) as duplicate_groups
      FROM (
        SELECT
          normalized_date, description, amount, account_id,
          COUNT(*) as occurrences
        FROM transactions
        GROUP BY normalized_date, description, amount, account_id
        HAVING COUNT(*) > 1
      )
    `).get() as { duplicate_groups: number };

    // Check for uncategorized
    const uncategorized = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE category = 'uncategorized'
    `).get() as { count: number };

    // Check income pattern (paychecks per month)
    const incomePattern = db.prepare(`
      SELECT
        substr(normalized_date, 1, 7) as month,
        COUNT(*) as paycheck_count
      FROM transactions
      WHERE category = 'income'
        AND description LIKE '%payroll%'
        AND amount > 1000
        AND normalized_date >= date('now', '-6 months')
      GROUP BY substr(normalized_date, 1, 7)
    `).all() as Array<{ month: string; paycheck_count: number }>;

    const avgPaychecksPerMonth = incomePattern.length > 0
      ? incomePattern.reduce((sum, m) => sum + m.paycheck_count, 0) / incomePattern.length
      : 0;

    // 3. IMPORT HEALTH BY MONTH
    const importHealth = db.prepare(`
      SELECT
        substr(normalized_date, 1, 7) as month,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN category = 'income' AND amount > 100 THEN amount ELSE 0 END) as income_total,
        COUNT(CASE WHEN category = 'income' AND amount > 100 THEN 1 END) as income_count,
        SUM(CASE WHEN category = 'expense' THEN ABS(amount) ELSE 0 END) as expense_total,
        COUNT(CASE WHEN category = 'expense' THEN 1 END) as expense_count
      FROM transactions
      WHERE normalized_date IS NOT NULL
      GROUP BY substr(normalized_date, 1, 7)
      ORDER BY month DESC
      LIMIT 12
    `).all() as Array<{
      month: string;
      transaction_count: number;
      income_total: number;
      income_count: number;
      expense_total: number;
      expense_count: number;
    }>;

    // Flag problematic months
    const importHealthWithFlags = importHealth.map(month => {
      const flags: string[] = [];
      let status: 'complete' | 'warning' | 'incomplete' = 'complete';

      if (month.income_count < 2) {
        flags.push('Missing paychecks');
        status = 'warning';
      }
      if (month.transaction_count < 20) {
        flags.push('Low activity');
        status = 'incomplete';
      }
      if (month.expense_total < 1000) {
        flags.push('Unusually low expenses');
        if (status === 'complete') status = 'warning';
      }

      return { ...month, flags, status };
    });

    // 4. OVERALL STATS
    const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };

    const dateRange = db.prepare(`
      SELECT
        MIN(normalized_date) as first_date,
        MAX(normalized_date) as last_date
      FROM transactions
      WHERE normalized_date IS NOT NULL
    `).get() as { first_date: string; last_date: string };

    return NextResponse.json({
      categoryBreakdown,
      qualityChecks: {
        duplicates: {
          count: duplicates.duplicate_groups,
          status: duplicates.duplicate_groups === 0 ? 'pass' : 'fail',
        },
        uncategorized: {
          count: uncategorized.count,
          status: uncategorized.count === 0 ? 'pass' : 'warn',
        },
        incomePattern: {
          avgPaychecksPerMonth: Math.round(avgPaychecksPerMonth * 10) / 10,
          status: avgPaychecksPerMonth >= 1.5 && avgPaychecksPerMonth <= 2.5 ? 'pass' : 'warn',
          message: `${avgPaychecksPerMonth.toFixed(1)} paychecks/month detected`,
        },
      },
      importHealth: importHealthWithFlags,
      overview: {
        totalTransactions: totalTransactions.count,
        dateRange: {
          first: dateRange.first_date,
          last: dateRange.last_date,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching data health:', error);
    return NextResponse.json(
      { error: `Failed to fetch data health: ${error}` },
      { status: 500 }
    );
  }
}
