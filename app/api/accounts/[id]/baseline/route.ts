import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { balance, date } = await request.json();
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    if (typeof balance !== 'number' || isNaN(balance) || !date) {
      return NextResponse.json(
        { error: 'Balance (number) and date (string) are required' },
        { status: 400 }
      );
    }

    // Update baseline and current balance
    db.prepare(`
      UPDATE accounts
      SET baseline_balance = ?,
          baseline_date = ?,
          balance = ?,
          last_updated = datetime('now')
      WHERE id = ?
    `).run(balance, date, balance, accountId);

    const updated = db.prepare(
      'SELECT * FROM accounts WHERE id = ?'
    ).get(accountId);

    if (!updated) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating baseline:', error);
    return NextResponse.json(
      { error: 'Failed to update baseline' },
      { status: 500 }
    );
  }
}
