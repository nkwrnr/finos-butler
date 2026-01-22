import { NextResponse } from 'next/server';
import { refreshDailyBriefing } from '@/lib/accounting/daily-briefing';
import db from '@/lib/db';

export async function POST() {
  try {
    // Clear ALL Zcash price cache to force fresh fetch from CoinGecko
    db.prepare('DELETE FROM zcash_price_cache').run();

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
