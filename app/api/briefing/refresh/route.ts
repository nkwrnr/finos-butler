import { NextResponse } from 'next/server';
import { refreshDailyBriefing } from '@/lib/accounting/daily-briefing';

export async function POST() {
  try {
    const briefing = await refreshDailyBriefing();

    return NextResponse.json({
      success: true,
      briefing,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing daily briefing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh daily briefing' },
      { status: 500 }
    );
  }
}
