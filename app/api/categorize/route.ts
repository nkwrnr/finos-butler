import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import {
  categorizeAllSpending,
  getUncategorizedCount,
  getSpendingByCategory
} from '@/lib/categorization';

// Initialize database
initDatabase();

// POST /api/categorize - Run categorization on all uncategorized expenses
export async function POST() {
  try {
    const stats = await categorizeAllSpending();

    // Get spending breakdown after categorization
    const breakdown = getSpendingByCategory(1);

    return NextResponse.json({
      success: true,
      stats,
      breakdown,
      message: `Categorized ${stats.byRule + stats.byLLM} transactions (${stats.byRule} by rules, ${stats.byLLM} by AI)`
    });
  } catch (e) {
    console.error('Categorization error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

// GET /api/categorize - Get uncategorized count and status
export async function GET() {
  try {
    const uncategorized = getUncategorizedCount();
    const breakdown = getSpendingByCategory(1);

    return NextResponse.json({
      uncategorized,
      breakdown,
      needsCategorization: uncategorized > 0
    });
  } catch (e) {
    console.error('Error getting categorization status:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
