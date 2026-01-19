import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, amount_usd, amount_zec, price_at_purchase, source, notes } = body;

    // Validate inputs
    if (!date || !amount_usd || !amount_zec || !price_at_purchase) {
      return NextResponse.json(
        { error: 'Missing required fields: date, amount_usd, amount_zec, price_at_purchase' },
        { status: 400 }
      );
    }

    if (amount_usd <= 0 || amount_zec <= 0 || price_at_purchase <= 0) {
      return NextResponse.json(
        { error: 'Amounts and price must be greater than 0' },
        { status: 400 }
      );
    }

    // Insert purchase record
    const result = db
      .prepare(
        `INSERT INTO zcash_purchases (date, amount_usd, amount_zec, price_at_purchase, source, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(date, amount_usd, amount_zec, price_at_purchase, source || 'Manual', notes || null);

    const newPurchase = db
      .prepare('SELECT * FROM zcash_purchases WHERE id = ?')
      .get(result.lastInsertRowid);

    return NextResponse.json(newPurchase);
  } catch (error) {
    console.error('Error creating purchase:', error);
    return NextResponse.json(
      { error: `Failed to create purchase: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const purchases = db
      .prepare('SELECT * FROM zcash_purchases ORDER BY date DESC')
      .all();

    return NextResponse.json({ purchases });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}
