import { NextRequest, NextResponse } from 'next/server';
import { dismissInsight, markInsightViewed } from '@/lib/agents/analyst';

/**
 * PATCH /api/agents/insights/[id]
 * Updates an insight (dismiss or mark as viewed).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const insightId = parseInt(idStr);

    if (isNaN(insightId)) {
      return NextResponse.json({ success: false, error: 'Invalid insight ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'dismiss') {
      dismissInsight(insightId);
      return NextResponse.json({ success: true, message: 'Insight dismissed' });
    } else if (action === 'mark_viewed') {
      markInsightViewed(insightId);
      return NextResponse.json({ success: true, message: 'Insight marked as viewed' });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating insight:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update insight',
      },
      { status: 500 }
    );
  }
}
