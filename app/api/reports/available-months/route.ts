import { NextResponse } from 'next/server';
import { getAvailableMonths } from '@/lib/accounting/monthly-close';

export async function GET() {
  try {
    const months = getAvailableMonths();

    return NextResponse.json({
      months,
      currentMonth: new Date().toISOString().substring(0, 7),
    });
  } catch (error) {
    console.error('Error getting available months:', error);
    return NextResponse.json(
      { error: `Failed to get available months: ${error}` },
      { status: 500 }
    );
  }
}
