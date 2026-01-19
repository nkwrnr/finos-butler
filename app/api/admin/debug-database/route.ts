import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import path from 'path';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Verify auth PIN
    const authPin = request.headers.get('x-auth-pin');
    const expectedPin = process.env.AUTH_PIN || '0926';

    if (!authPin || authPin !== expectedPin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'finance.db');
    const fileExists = existsSync(dbPath);
    let fileSize = 0;

    if (fileExists) {
      const stats = statSync(dbPath);
      fileSize = stats.size;
    }

    // Get list of all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];

    // Get row counts for each table
    const tableCounts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as { count: number };
        tableCounts[table.name] = result.count;
      } catch (e) {
        tableCounts[table.name] = -1; // Error reading table
      }
    }

    // Sample data from accounts
    let accountsSample: unknown[] = [];
    try {
      accountsSample = db.prepare('SELECT * FROM accounts LIMIT 3').all();
    } catch (e) {
      accountsSample = [{ error: String(e) }];
    }

    // Sample data from savings_goals
    let savingsGoalsSample: unknown[] = [];
    try {
      savingsGoalsSample = db.prepare('SELECT * FROM savings_goals').all();
    } catch (e) {
      savingsGoalsSample = [{ error: String(e) }];
    }

    // Sample transactions
    let transactionsSample: unknown[] = [];
    try {
      transactionsSample = db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 5').all();
    } catch (e) {
      transactionsSample = [{ error: String(e) }];
    }

    return NextResponse.json({
      success: true,
      database: {
        path: dbPath,
        exists: fileExists,
        sizeBytes: fileSize,
        sizeKB: Math.round(fileSize / 1024),
        sizeMB: (fileSize / 1024 / 1024).toFixed(2),
      },
      tables: tables.map(t => t.name),
      tableCounts,
      samples: {
        accounts: accountsSample,
        savings_goals: savingsGoalsSample,
        transactions: transactionsSample,
      },
      environment: {
        DATABASE_PATH: process.env.DATABASE_PATH || '(not set)',
        NODE_ENV: process.env.NODE_ENV || '(not set)',
      },
    });
  } catch (error) {
    console.error('Debug database error:', error);
    return NextResponse.json(
      { success: false, error: `Debug failed: ${error}` },
      { status: 500 }
    );
  }
}
