import { NextResponse } from 'next/server';
import { getDailyBriefing } from '@/lib/accounting/daily-briefing';

export async function GET() {
  try {
    const briefing = await getDailyBriefing();

    return NextResponse.json({
      success: true,
      briefing,
      cached: true, // Will be true if served from cache
    });
  } catch (error) {
    console.error('Error getting daily briefing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get daily briefing' },
      { status: 500 }
    );
  }
}
