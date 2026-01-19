import db from '@/lib/db';
import { buildFinancialContext } from '../context-builder';
import { askClaudeForJson } from '../claude-client';
import { analyzeSpending, formatSpendingForAnalysis } from './spending-analyzer';
import { analyzeMerchants, formatMerchantsForAnalysis } from './merchant-analyzer';
import {
  ANALYST_SYSTEM_PROMPT,
  buildSpendingAnalysisPrompt,
  buildMerchantAnalysisPrompt,
} from './prompts';
import type { Insight, AgentRun, AnalystRunConfig, AnalystResult, FinancialContext } from '../types';

const DEFAULT_CONFIG: AnalystRunConfig = {
  lookbackMonths: 6,
  minAnomalyThreshold: 25,
  minAmountThreshold: 50,
};

/**
 * Main entry point for the Financial Analyst Agent.
 * Runs comprehensive analysis and generates insights.
 */
export async function runAnalystAgent(config: AnalystRunConfig = {}): Promise<AnalystResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Start agent run
  const runId = startAgentRun('analyst', mergedConfig);

  try {
    // Build financial context
    const asOfDate = config.analysisMonth ? new Date(`${config.analysisMonth}-15`) : new Date();

    const context = await buildFinancialContext(asOfDate, mergedConfig.lookbackMonths!);

    // Run spending analysis
    const spendingAnomalies = analyzeSpending(context, {
      minPercentChange: mergedConfig.minAnomalyThreshold!,
      minAbsoluteChange: mergedConfig.minAmountThreshold!,
      includeCategories: mergedConfig.includeCategories,
      excludeCategories: mergedConfig.excludeCategories,
    });

    // Run merchant analysis
    const merchantInsights = analyzeMerchants(context);

    // Generate natural language insights using Claude
    const generatedInsights = await generateInsightsWithClaude(context, spendingAnomalies, merchantInsights);

    // Save insights to database
    const savedInsights = saveInsights(generatedInsights);

    // Complete agent run
    completeAgentRun(runId, savedInsights.length, {
      spendingAnomaliesFound: spendingAnomalies.length,
      merchantPatternsFound: merchantInsights.length,
    });

    return {
      runId,
      analysisMonth: context.currentMonth.month,
      spendingAnomalies,
      merchantPatterns: context.merchantPatterns.slice(0, 20),
      generatedInsights: savedInsights,
      summary: {
        totalCategoriesAnalyzed: context.categoryAnalysis.length,
        anomaliesFound: spendingAnomalies.length,
        merchantPatternsFound: merchantInsights.length,
        insightsGenerated: savedInsights.length,
      },
    };
  } catch (error) {
    failAgentRun(runId, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Uses Claude to generate natural language insights from analyzed data.
 */
async function generateInsightsWithClaude(
  context: FinancialContext,
  spendingAnomalies: any[],
  merchantInsights: any[]
): Promise<Insight[]> {
  const allInsights: Insight[] = [];

  // Generate spending insights
  if (
    spendingAnomalies.length > 0 ||
    context.categoryAnalysis.some((c) => Math.abs(c.percentChangeFromPrev) > 15)
  ) {
    const { categoryData, topChanges } = formatSpendingForAnalysis(context);

    const spendingPrompt = buildSpendingAnalysisPrompt(
      context.currentMonth.month,
      context.previousMonth.month,
      categoryData,
      topChanges
    );

    const spendingInsights = await askClaudeForJson<Array<Partial<Insight>>>(
      ANALYST_SYSTEM_PROMPT,
      spendingPrompt,
      { maxTokens: 1500 }
    );

    if (spendingInsights) {
      for (const insight of spendingInsights) {
        // Get transactions for this category
        const categoryTransactions = insight.category
          ? Object.values(context.currentMonth.byMerchant)
              .filter((m: any) => m.category === insight.category)
              .flatMap((m: any) => m.transactions)
              .sort((a: any, b: any) => b.amount - a.amount)
              .slice(0, 10) // Top 10 transactions
          : [];

        allInsights.push({
          agentType: 'analyst',
          insightType: 'spending_spike',
          title: insight.title || 'Spending Pattern',
          body: insight.body || '',
          dataJson: {
            transactions: categoryTransactions,
          },
          severity: (insight.severity as any) || 'info',
          category: insight.category,
          periodType: 'monthly',
          referenceDate: context.currentMonth.month,
          comparisonPeriod: context.previousMonth.month,
          actionable: insight.actionable || false,
          actionText: insight.actionText,
          dismissed: false,
          viewed: false,
        });
      }
    }
  }

  // Generate merchant insights
  if (merchantInsights.length > 0) {
    const merchantData = formatMerchantsForAnalysis(context);

    const merchantPrompt = buildMerchantAnalysisPrompt(
      context.currentMonth.month,
      context.previousMonth.month,
      merchantData
    );

    const merchantClaudeInsights = await askClaudeForJson<Array<Partial<Insight>>>(
      ANALYST_SYSTEM_PROMPT,
      merchantPrompt,
      { maxTokens: 1500 }
    );

    if (merchantClaudeInsights) {
      for (const insight of merchantClaudeInsights) {
        // Get transactions for this merchant
        const merchantName = (insight as any).merchant;
        const merchantTransactions = merchantName
          ? context.currentMonth.byMerchant[merchantName]?.transactions || []
          : [];

        allInsights.push({
          agentType: 'analyst',
          insightType: (insight as any).insightType || 'merchant_frequency',
          title: insight.title || 'Merchant Pattern',
          body: insight.body || '',
          dataJson: {
            transactions: merchantTransactions,
          },
          severity: (insight.severity as any) || 'info',
          merchant: (insight as any).merchant,
          category: insight.category,
          periodType: 'monthly',
          referenceDate: context.currentMonth.month,
          comparisonPeriod: context.previousMonth.month,
          actionable: insight.actionable || false,
          actionText: insight.actionText,
          dismissed: false,
          viewed: false,
        });
      }
    }
  }

  return allInsights;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

function startAgentRun(agentType: string, config: any): number {
  const result = db
    .prepare(
      `
    INSERT INTO agent_runs (agent_type, run_type, started_at, status, run_metadata)
    VALUES (?, 'manual', datetime('now'), 'running', ?)
  `
    )
    .run(agentType, JSON.stringify(config));

  return result.lastInsertRowid as number;
}

function completeAgentRun(runId: number, insightsCount: number, data: any): void {
  db.prepare(
    `
    UPDATE agent_runs
    SET completed_at = datetime('now'),
        status = 'completed',
        insights_generated = ?,
        insights_data = ?
    WHERE id = ?
  `
  ).run(insightsCount, JSON.stringify(data), runId);
}

function failAgentRun(runId: number, error: string): void {
  db.prepare(
    `
    UPDATE agent_runs
    SET completed_at = datetime('now'),
        status = 'failed',
        error_message = ?
    WHERE id = ?
  `
  ).run(error, runId);
}

function saveInsights(insights: Insight[]): Insight[] {
  const saved: Insight[] = [];

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO agent_insights (
      agent_type, insight_type, title, body, data_json,
      severity, category, merchant, period_type, reference_date,
      comparison_period, amount_current, amount_previous, percent_change,
      actionable, action_text, dismissed, viewed, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'), ?)
  `);

  for (const insight of insights) {
    // Calculate expiry (insights expire after 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
      const result = insertStmt.run(
        insight.agentType,
        insight.insightType,
        insight.title,
        insight.body,
        insight.dataJson ? JSON.stringify(insight.dataJson) : null,
        insight.severity,
        insight.category || null,
        insight.merchant || null,
        insight.periodType,
        insight.referenceDate,
        insight.comparisonPeriod || null,
        insight.amountCurrent || null,
        insight.amountPrevious || null,
        insight.percentChange || null,
        insight.actionable ? 1 : 0,
        insight.actionText || null,
        expiresAt.toISOString()
      );

      saved.push({ ...insight, id: result.lastInsertRowid as number });
    } catch (e) {
      // Duplicate insight, skip
      console.warn('Duplicate insight, skipping:', insight.title);
    }
  }

  return saved;
}

/**
 * Retrieve recent insights from the database.
 */
export function getRecentInsights(limit: number = 10, agentType?: string): Insight[] {
  let query = `
    SELECT * FROM agent_insights
    WHERE dismissed = 0
      AND datetime(expires_at) > datetime('now')
  `;

  const params: any[] = [];

  if (agentType) {
    query += ' AND agent_type = ?';
    params.push(agentType);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params) as Array<any>;

  return rows.map((row) => ({
    id: row.id,
    agentType: row.agent_type,
    insightType: row.insight_type,
    title: row.title,
    body: row.body,
    dataJson: row.data_json ? JSON.parse(row.data_json) : undefined,
    severity: row.severity,
    category: row.category,
    merchant: row.merchant,
    periodType: row.period_type,
    referenceDate: row.reference_date,
    comparisonPeriod: row.comparison_period,
    amountCurrent: row.amount_current,
    amountPrevious: row.amount_previous,
    percentChange: row.percent_change,
    actionable: row.actionable === 1,
    actionText: row.action_text,
    dismissed: row.dismissed === 1,
    viewed: row.viewed === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Mark an insight as dismissed.
 */
export function dismissInsight(insightId: number): void {
  db.prepare('UPDATE agent_insights SET dismissed = 1 WHERE id = ?').run(insightId);
}

/**
 * Mark an insight as viewed.
 */
export function markInsightViewed(insightId: number): void {
  db.prepare('UPDATE agent_insights SET viewed = 1 WHERE id = ?').run(insightId);
}
