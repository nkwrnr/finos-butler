import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

export async function GET() {
  try {
    let settings = db
      .prepare('SELECT * FROM zcash_strategy_settings WHERE id = 1')
      .get() as {
        id: number;
        target_zec: number;
        goal_deadline: string;
        max_daily_purchase: number;
        safety_buffer: number;
        discretionary_allocation: number;
      } | undefined;

    // If no settings exist, create defaults
    if (!settings) {
      db.prepare(
        'INSERT INTO zcash_strategy_settings (id, target_zec, goal_deadline, max_daily_purchase, safety_buffer, discretionary_allocation) VALUES (1, 100, ?, 300, 2000, 0.5)'
      ).run('2025-12-31');

      settings = db.prepare('SELECT * FROM zcash_strategy_settings WHERE id = 1').get() as {
        id: number;
        target_zec: number;
        goal_deadline: string;
        max_daily_purchase: number;
        safety_buffer: number;
        discretionary_allocation: number;
      };
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching Zcash strategy settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      target_zec,
      goal_deadline,
      max_daily_purchase,
      safety_buffer,
      discretionary_allocation,
    } = body;

    // Validate inputs
    if (target_zec <= 0) {
      return NextResponse.json(
        { error: 'Target ZEC must be greater than 0' },
        { status: 400 }
      );
    }

    if (max_daily_purchase <= 0) {
      return NextResponse.json(
        { error: 'Max daily purchase must be greater than 0' },
        { status: 400 }
      );
    }

    if (safety_buffer < 0) {
      return NextResponse.json(
        { error: 'Safety buffer cannot be negative' },
        { status: 400 }
      );
    }

    if (discretionary_allocation < 0 || discretionary_allocation > 1) {
      return NextResponse.json(
        { error: 'Discretionary allocation must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Update settings
    db.prepare(
      `UPDATE zcash_strategy_settings
       SET target_zec = ?,
           goal_deadline = ?,
           max_daily_purchase = ?,
           safety_buffer = ?,
           discretionary_allocation = ?
       WHERE id = 1`
    ).run(
      target_zec,
      goal_deadline,
      max_daily_purchase,
      safety_buffer,
      discretionary_allocation
    );

    const updatedSettings = db
      .prepare('SELECT * FROM zcash_strategy_settings WHERE id = 1')
      .get();

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Error updating Zcash strategy settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
