import { NextRequest, NextResponse } from 'next/server';
import { runAnalystAgent } from '@/lib/agents/analyst';
import type { AnalystRunConfig } from '@/lib/agents/types';

/**
 * POST /api/agents/analyst/run
 * Triggers the Financial Analyst Agent to analyze spending patterns.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const config: AnalystRunConfig = {
      analysisMonth: body.analysisMonth,
      lookbackMonths: body.lookbackMonths || 6,
      includeCategories: body.includeCategories,
      excludeCategories: body.excludeCategories,
      minAnomalyThreshold: body.minAnomalyThreshold || 25,
      minAmountThreshold: body.minAmountThreshold || 50,
    };

    const result = await runAnalystAgent(config);

    return NextResponse.json({
      success: true,
      runId: result.runId,
      analysisMonth: result.analysisMonth,
      summary: result.summary,
      insights: result.generatedInsights,
    });
  } catch (error) {
    console.error('Error running analyst agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run analyst agent',
      },
      { status: 500 }
    );
  }
}
