import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';
import { calculateAccountBalance } from '@/lib/financial-intelligence';

// Initialize database
initDatabase();

export async function GET() {
  try {
    const accounts = db.prepare(`
      SELECT
        a.*,
        g.name as goal_name
      FROM accounts a
      LEFT JOIN savings_goals g ON a.goal_id = g.id
      ORDER BY a.institution, a.type
    `).all() as Array<{ id: number; balance: number; baseline_date: string | null; [key: string]: unknown }>;

    // For accounts with baseline_date, calculate balance using ledger approach
    const accountsWithCalculatedBalances = accounts.map(account => {
      if (account.baseline_date) {
        return { ...account, balance: calculateAccountBalance(account.id) };
      }
      return account;
    });

    return NextResponse.json(accountsWithCalculatedBalances);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, goal_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Update account's goal_id (can be null)
    db.prepare('UPDATE accounts SET goal_id = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
      .run(goal_id === null || goal_id === undefined ? null : goal_id, id);

    const updatedAccount = db.prepare(`
      SELECT
        a.*,
        g.name as goal_name
      FROM accounts a
      LEFT JOIN savings_goals g ON a.goal_id = g.id
      WHERE a.id = ?
    `).get(id);

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
