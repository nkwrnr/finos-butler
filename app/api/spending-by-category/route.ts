import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { getSpendingByCategory, CATEGORY_DISPLAY_NAMES } from '@/lib/categorization';

// Initialize database
initDatabase();

// GET /api/spending-by-category?months=1
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const months = parseInt(url.searchParams.get('months') || '1');

    const results = getSpendingByCategory(months);

    // Add display names
    const enrichedResults = results.map(r => ({
      ...r,
      displayName: CATEGORY_DISPLAY_NAMES[r.category] || r.category
    }));

    return NextResponse.json(enrichedResults);
  } catch (e) {
    console.error('Error getting spending by category:', e);
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
