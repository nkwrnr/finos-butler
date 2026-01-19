import { NextResponse } from 'next/server';
import { categorizeAllTransactions } from '@/lib/categorize-transactions';
import { logDataChange, getCurrentMonth } from '@/lib/data-pipeline/events';
import { invalidateDependentCaches } from '@/lib/data-pipeline/cache';
import db from '@/lib/db';

export async function POST() {
  try {
    const result = categorizeAllTransactions();

    // Get affected months from all transactions
    const months = db.prepare(`
      SELECT DISTINCT substr(normalized_date, 1, 7) as month
      FROM transactions
      WHERE normalized_date IS NOT NULL
    `).all() as { month: string }[];
    const affectedMonths = months.map(m => m.month).filter(Boolean);

    // Log data change and invalidate caches
    logDataChange({
      event: 'transactions_categorized',
      timestamp: new Date().toISOString(),
      affectedMonths,
      metadata: {
        total: result.total,
        categorized: result.categorized,
      },
    });

    // Invalidate caches for all affected months
    if (affectedMonths.length > 0) {
      invalidateDependentCaches(affectedMonths);
    } else {
      // Fallback: invalidate current month
      invalidateDependentCaches([getCurrentMonth()]);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error categorizing transactions:', error);
    return NextResponse.json(
      { error: `Failed to categorize transactions: ${error}` },
      { status: 500 }
    );
  }
}
