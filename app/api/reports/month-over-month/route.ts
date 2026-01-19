import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface MonthData {
  month: string;
  income: number;
  expenses: number;
  rent: number;
  variableExpenses: number;
  zcash: number;
  savings: number;
  netCash: number;
  savingsRate: number;
  accountCount: number;
  isIncomplete: boolean;
}

interface MonthlyRaw {
  month: string;
  income: number;
  expenses: number;
  rent: number;
  zcash: number;
  savings: number;
  credit_payments: number;
  account_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get('months');
    const months = monthsParam ? parseInt(monthsParam, 10) : 6;

    if (isNaN(months) || months < 1 || months > 24) {
      return NextResponse.json(
        { error: 'Invalid months parameter. Must be between 1 and 24' },
        { status: 400 }
      );
    }

    // Calculate start date
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0].slice(0, 7) + '-01';

    // Get monthly summaries
    const monthlyData = db.prepare(`
      SELECT
        strftime('%Y-%m', t.normalized_date) as month,
        SUM(CASE WHEN t.category = 'income' THEN t.amount ELSE 0 END) as income,
        SUM(CASE WHEN t.category = 'expense' THEN ABS(t.amount) ELSE 0 END) as expenses,
        SUM(CASE WHEN t.category = 'rent' THEN ABS(t.amount) ELSE 0 END) as rent,
        SUM(CASE WHEN t.category = 'zcash_purchase' THEN ABS(t.amount) ELSE 0 END) as zcash,
        SUM(CASE WHEN t.category = 'savings_transfer' THEN ABS(t.amount) ELSE 0 END) as savings,
        SUM(CASE WHEN t.category = 'credit_payment' THEN ABS(t.amount) ELSE 0 END) as credit_payments,
        COUNT(DISTINCT t.account_id) as account_count
      FROM transactions t
      WHERE t.normalized_date >= ?
      AND t.normalized_date IS NOT NULL
      GROUP BY strftime('%Y-%m', t.normalized_date)
      ORDER BY month DESC
    `).all(startDateStr) as MonthlyRaw[];

    // Get typical account count per month for completeness check
    const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const expectedAccounts = Math.min(totalAccounts.count, 4); // Typically 4 main accounts

    // Transform data
    const monthsData: MonthData[] = monthlyData.map(m => {
      const totalSpending = m.expenses + m.rent;
      const netCash = m.income - totalSpending - m.zcash - m.savings;
      const savingsRate = m.income > 0
        ? ((m.zcash + m.savings) / m.income * 100)
        : 0;

      // Month is incomplete if:
      // 1. Account count is less than expected
      // 2. Expenses are suspiciously low (< $1000)
      const isIncomplete = m.account_count < expectedAccounts || m.expenses < 1000;

      return {
        month: m.month,
        income: m.income,
        expenses: totalSpending,
        rent: m.rent,
        variableExpenses: m.expenses,
        zcash: m.zcash,
        savings: m.savings,
        netCash,
        savingsRate: Math.round(savingsRate * 10) / 10,
        accountCount: m.account_count,
        isIncomplete,
      };
    });

    // Find incomplete months
    const incompleteMonths = monthsData
      .filter(m => m.isIncomplete)
      .map(m => m.month);

    // Calculate averages (excluding incomplete months for accuracy)
    const completeMonths = monthsData.filter(m => !m.isIncomplete);
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const averages = {
      income: Math.round(avg(completeMonths.map(m => m.income))),
      expenses: Math.round(avg(completeMonths.map(m => m.expenses))),
      netCash: Math.round(avg(completeMonths.map(m => m.netCash))),
      savingsRate: Math.round(avg(completeMonths.map(m => m.savingsRate)) * 10) / 10,
    };

    return NextResponse.json({
      months: monthsData,
      incompleteMonths,
      averages,
      meta: {
        startDate: startDateStr,
        totalMonths: monthsData.length,
        completeMonths: completeMonths.length,
        expectedAccounts,
      },
    });
  } catch (error) {
    console.error('Error generating month-over-month report:', error);
    return NextResponse.json(
      { error: 'Failed to generate month-over-month report' },
      { status: 500 }
    );
  }
}
