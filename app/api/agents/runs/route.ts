import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/agents/runs
 * Retrieves agent run history.
 * Query params:
 *   - limit: number (default 20)
 *   - agentType: 'analyst' | 'optimizer' | 'predictor' | 'advisor' (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const agentType = searchParams.get('agentType');

    let query = 'SELECT * FROM agent_runs';
    const params: any[] = [];

    if (agentType) {
      query += ' WHERE agent_type = ?';
      params.push(agentType);
    }

    query += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    const runs = db.prepare(query).all(...params) as Array<{
      id: number;
      agent_type: string;
      run_type: string;
      started_at: string;
      completed_at: string | null;
      status: string;
      insights_generated: number;
      insights_data: string | null;
      error_message: string | null;
      run_metadata: string | null;
    }>;

    const formattedRuns = runs.map((run) => ({
      id: run.id,
      agentType: run.agent_type,
      runType: run.run_type,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      status: run.status,
      insightsGenerated: run.insights_generated,
      insightsData: run.insights_data ? JSON.parse(run.insights_data) : null,
      errorMessage: run.error_message,
      runMetadata: run.run_metadata ? JSON.parse(run.run_metadata) : null,
    }));

    return NextResponse.json({
      success: true,
      runs: formattedRuns,
      count: formattedRuns.length,
    });
  } catch (error) {
    console.error('Error fetching agent runs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch agent runs',
      },
      { status: 500 }
    );
  }
}
