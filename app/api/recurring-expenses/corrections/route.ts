import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { merchant, is_recurring, note } = await request.json();

    if (!merchant || typeof is_recurring !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields: merchant, is_recurring' }, { status: 400 });
    }

    // Insert or update correction
    db.prepare(
      `
      INSERT INTO expense_corrections (merchant_normalized, is_recurring, user_note)
      VALUES (?, ?, ?)
      ON CONFLICT(merchant_normalized) DO UPDATE SET
        is_recurring = excluded.is_recurring,
        user_note = excluded.user_note,
        user_marked_at = CURRENT_TIMESTAMP,
        applied_to_detection = 0
    `
    ).run(merchant, is_recurring ? 1 : 0, note || null);

    // Apply correction to recurring_expenses table
    if (is_recurring) {
      // User marked as recurring - update confidence or create entry
      db.prepare(
        `
        UPDATE recurring_expenses
        SET user_confirmed = 1, confidence = 'high', updated_at = CURRENT_TIMESTAMP
        WHERE merchant_normalized = ?
      `
      ).run(merchant);
    } else {
      // User excluded - mark as excluded
      db.prepare(
        `
        UPDATE recurring_expenses
        SET user_excluded = 1, updated_at = CURRENT_TIMESTAMP
        WHERE merchant_normalized = ?
      `
      ).run(merchant);
    }

    // Mark correction as applied
    db.prepare(
      `
      UPDATE expense_corrections
      SET applied_to_detection = 1
      WHERE merchant_normalized = ?
    `
    ).run(merchant);

    return NextResponse.json({
      success: true,
      message: `Successfully ${is_recurring ? 'confirmed' : 'excluded'} ${merchant}`,
    });
  } catch (error) {
    console.error('Error applying correction:', error);
    return NextResponse.json({ error: `Failed to apply correction: ${error}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get all corrections
    const corrections = db.prepare('SELECT * FROM expense_corrections ORDER BY user_marked_at DESC').all();

    return NextResponse.json({ corrections });
  } catch (error) {
    console.error('Error fetching corrections:', error);
    return NextResponse.json({ error: `Failed to fetch corrections: ${error}` }, { status: 500 });
  }
}
