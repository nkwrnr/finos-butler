import { NextResponse } from 'next/server';
import db from '@/lib/db';

interface CashFlowTransaction {
  date: string;
  description: string;
  category: string;
  amount: number;
  runningBalance: number | null;
  type: 'inflow' | 'outflow';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Default to current month if not specified
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM (e.g., 2025-12)' },
        { status: 400 }
      );
    }

    const [year, monthNum] = targetMonth.split('-').map(Number);
    const startDate = `${targetMonth}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

    // Get checking account ID
    const account = db.prepare("SELECT id, name FROM accounts WHERE name LIKE '%WellsFargo%'").get() as { id: number; name: string } | undefined;

    if (!account) {
      return NextResponse.json(
        { error: 'Checking account not found' },
        { status: 404 }
      );
    }

    // Get all transactions for the month, ordered chronologically
    const transactions = db.prepare(`
      SELECT normalized_date, description, category, amount
      FROM transactions
      WHERE account_id = ?
        AND normalized_date >= ?
        AND normalized_date <= ?
      ORDER BY normalized_date ASC, id ASC
    `).all(account.id, startDate, endDate) as Array<{
      normalized_date: string;
      description: string;
      category: string;
      amount: number;
    }>;

    // Calculate running balance (we don't have starting balance, so start at 0)
    let runningBalance: number | null = null;

    const cashFlowTransactions: CashFlowTransaction[] = transactions.map(txn => {
      const type: 'inflow' | 'outflow' = txn.amount > 0 ? 'inflow' : 'outflow';

      // Update running balance if we're tracking it
      // For now, we'll leave it null since we don't have starting balance
      if (runningBalance !== null) {
        runningBalance += txn.amount;
      }

      return {
        date: txn.normalized_date,
        description: txn.description,
        category: txn.category,
        amount: txn.amount,
        runningBalance,
        type,
      };
    });

    // Calculate summary
    const totalInflows = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalOutflows = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    const netChange = totalInflows - totalOutflows;

    // Group by category for summary
    const byCategory: Record<string, { inflows: number; outflows: number; count: number }> = {};

    for (const txn of transactions) {
      if (!byCategory[txn.category]) {
        byCategory[txn.category] = { inflows: 0, outflows: 0, count: 0 };
      }

      if (txn.amount > 0) {
        byCategory[txn.category].inflows += txn.amount;
      } else {
        byCategory[txn.category].outflows += Math.abs(txn.amount);
      }

      byCategory[txn.category].count++;
    }

    return NextResponse.json({
      month: targetMonth,
      account: account.name,
      transactions: cashFlowTransactions,
      summary: {
        totalInflows,
        totalOutflows,
        netChange,
        transactionCount: transactions.length,
      },
      byCategory,
    });
  } catch (error) {
    console.error('Error generating cash flow report:', error);
    return NextResponse.json(
      { error: `Failed to generate cash flow report: ${error}` },
      { status: 500 }
    );
  }
}
