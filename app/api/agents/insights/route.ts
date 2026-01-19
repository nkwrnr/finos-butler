import { NextRequest, NextResponse } from 'next/server';
import { getRecentInsights } from '@/lib/agents/analyst';

/**
 * GET /api/agents/insights
 * Retrieves recent insights from all agents.
 * Query params:
 *   - limit: number (default 10)
 *   - agentType: 'analyst' | 'optimizer' | 'predictor' | 'advisor' (optional)
 *   - includeDismissed: boolean (default false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const agentType = searchParams.get('agentType') || undefined;

    const insights = getRecentInsights(limit, agentType);

    return NextResponse.json({
      success: true,
      insights,
      count: insights.length,
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch insights',
      },
      { status: 500 }
    );
  }
}
