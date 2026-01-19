import { NextResponse } from 'next/server';
import { getDailyBriefing } from '@/lib/accounting/daily-briefing';

export async function GET() {
  try {
    const briefing = await getDailyBriefing();

    return NextResponse.json({
      success: true,
      actions: briefing.todayActions,
      alerts: briefing.alerts,
      payCycle: briefing.payCycle,
      cash: briefing.cash,
    });
  } catch (error) {
    console.error('Error getting today actions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get today actions' },
      { status: 500 }
    );
  }
}
