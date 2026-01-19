import { NextResponse } from 'next/server';
import { closeMonth } from '@/lib/accounting/monthly-close';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Default to current month if not specified
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM (e.g., 2025-12)' },
        { status: 400 }
      );
    }

    const monthlyClose = await closeMonth(targetMonth);

    return NextResponse.json(monthlyClose);
  } catch (error) {
    console.error('Error generating monthly close:', error);
    return NextResponse.json(
      { error: `Failed to generate monthly close: ${error}` },
      { status: 500 }
    );
  }
}
