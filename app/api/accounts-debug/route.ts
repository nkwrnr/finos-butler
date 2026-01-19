import { NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

export async function GET() {
  try {
    const accounts = db.prepare(`
      SELECT
        a.id,
        a.name,
        a.institution,
        a.type,
        a.balance,
        a.goal_id,
        a.last_updated,
        g.name as goal_name,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(t.amount), 0) as sum_of_transactions,
        COALESCE(MIN(t.amount), 0) as min_transaction,
        COALESCE(MAX(t.amount), 0) as max_transaction
      FROM accounts a
      LEFT JOIN savings_goals g ON a.goal_id = g.id
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.id
      ORDER BY a.institution, a.type, a.name
    `).all();

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts debug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: String(error) },
      { status: 500 }
    );
  }
}
