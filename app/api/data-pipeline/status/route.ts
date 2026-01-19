import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getLastDataChange, getRecentDataChanges, DataChangeRecord } from '@/lib/data-pipeline/events';
import { briefingNeedsRefresh, getCachedBriefing, getSystemState } from '@/lib/data-pipeline/cache';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get last data change
    const lastDataChange = getLastDataChange();

    // Get briefing cache status
    const briefingCache = getCachedBriefing(today);
    const briefingIsStale = briefingCache ? briefingNeedsRefresh(briefingCache.generated_at) : true;

    // Get recurring expenses stale status
    const recurringExpensesStaleSince = getSystemState('recurring_expenses_stale_since');

    // Get recent data changes
    const recentChanges = getRecentDataChanges(10);

    // Get counts
    const totalChanges = db.prepare('SELECT COUNT(*) as count FROM data_changes').get() as { count: number };
    const unprocessedChanges = db.prepare('SELECT COUNT(*) as count FROM data_changes WHERE processed = 0').get() as { count: number };

    return NextResponse.json({
      success: true,
      status: {
        lastDataChange,
        briefing: {
          date: today,
          cachedAt: briefingCache?.generated_at || null,
          isStale: briefingIsStale,
          hasCachedBriefing: !!briefingCache,
        },
        recurringExpenses: {
          staleSince: recurringExpensesStaleSince,
          isStale: !!recurringExpensesStaleSince,
        },
        counts: {
          totalChanges: totalChanges.count,
          unprocessedChanges: unprocessedChanges.count,
        },
      },
      recentChanges: recentChanges.map((change: DataChangeRecord) => ({
        id: change.id,
        event: change.event,
        timestamp: change.timestamp,
        affectedAccounts: change.affected_accounts ? JSON.parse(change.affected_accounts) : null,
        affectedMonths: change.affected_months ? JSON.parse(change.affected_months) : null,
        metadata: change.metadata ? JSON.parse(change.metadata) : null,
        processed: change.processed === 1,
      })),
    });
  } catch (error) {
    console.error('Error getting data pipeline status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get data pipeline status' },
      { status: 500 }
    );
  }
}
