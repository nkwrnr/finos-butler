import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface SimilarTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  spending_category: string | null;
  account_name: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Get the original transaction description
    const transaction = db.prepare(
      'SELECT description FROM transactions WHERE id = ?'
    ).get(transactionId) as { description: string } | undefined;

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Match first 15 characters of description
    const pattern = transaction.description.substring(0, 15).toLowerCase();

    // Find similar transactions
    const similar = db.prepare(`
      SELECT
        t.id,
        t.date,
        t.description,
        t.amount,
        t.spending_category,
        a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE LOWER(t.description) LIKE ?
      AND t.id != ?
      AND t.category = 'expense'
      ORDER BY t.normalized_date DESC
      LIMIT 10
    `).all(pattern + '%', transactionId) as SimilarTransaction[];

    // Get total count of similar transactions
    const countResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE LOWER(description) LIKE ?
      AND id != ?
      AND category = 'expense'
    `).get(pattern + '%', transactionId) as { count: number };

    return NextResponse.json({
      similar,
      count: countResult.count,
    });
  } catch (error) {
    console.error('Error finding similar transactions:', error);
    return NextResponse.json(
      { error: 'Failed to find similar transactions' },
      { status: 500 }
    );
  }
}
