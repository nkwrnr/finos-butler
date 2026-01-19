import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  spending_category: string | null;
  account_name: string;
  institution: string;
  account_type: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    const transactions = db.prepare(`
      SELECT
        t.id,
        t.date,
        t.description,
        t.amount,
        t.category,
        t.spending_category,
        a.name as account_name,
        a.institution,
        a.type as account_type
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.normalized_date DESC, t.id DESC
      LIMIT ?
    `).all(limit) as Transaction[];

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
