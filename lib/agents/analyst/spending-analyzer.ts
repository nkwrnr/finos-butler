import type { FinancialContext, SpendingAnomaly, CategorySpending } from '../types';

export interface SpendingAnalyzerConfig {
  minPercentChange: number; // Minimum % change to flag (default 25)
  minAbsoluteChange: number; // Minimum $ change to flag (default 50)
  includeCategories?: string[];
  excludeCategories?: string[];
}

const DEFAULT_CONFIG: SpendingAnalyzerConfig = {
  minPercentChange: 25,
  minAbsoluteChange: 50,
};

/**
 * Analyzes spending patterns and identifies anomalies.
 */
export function analyzeSpending(
  context: FinancialContext,
  config: SpendingAnalyzerConfig = DEFAULT_CONFIG
): SpendingAnomaly[] {
  const anomalies: SpendingAnomaly[] = [];

  for (const category of context.categoryAnalysis) {
    // Apply filters
    if (config.includeCategories && !config.includeCategories.includes(category.category)) {
      continue;
    }
    if (config.excludeCategories?.includes(category.category)) {
      continue;
    }

    // Check against previous month
    const vsPrevAnomaly = checkAnomaly(
      category,
      'previous_month',
      category.previousMonth,
      category.percentChangeFromPrev,
      config,
      context
    );
    if (vsPrevAnomaly) anomalies.push(vsPrevAnomaly);

    // Check against 6-month average (if different from previous month check)
    if (Math.abs(category.percentChangeFromAvg - category.percentChangeFromPrev) > 10) {
      const vsAvgAnomaly = checkAnomaly(
        category,
        'six_month_avg',
        category.sixMonthAvg,
        category.percentChangeFromAvg,
        config,
        context
      );
      if (vsAvgAnomaly) anomalies.push(vsAvgAnomaly);
    }
  }

  // Sort by absolute change descending
  return anomalies.sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange));
}

function checkAnomaly(
  category: CategorySpending,
  comparisonType: SpendingAnomaly['comparisonType'],
  comparisonAmount: number,
  percentChange: number,
  config: SpendingAnalyzerConfig,
  context: FinancialContext
): SpendingAnomaly | null {
  const absoluteChange = category.currentMonth - comparisonAmount;

  // Check if significant
  const isSignificant =
    Math.abs(percentChange) >= config.minPercentChange && Math.abs(absoluteChange) >= config.minAbsoluteChange;

  if (!isSignificant) return null;

  // Find top contributors
  const topContributors = findTopContributors(context.currentMonth.byMerchant, category.category);

  // Generate possible reasons
  const possibleReasons = generatePossibleReasons(category, percentChange, topContributors, context);

  return {
    category: category.category,
    currentAmount: category.currentMonth,
    comparisonAmount,
    comparisonType,
    percentChange,
    absoluteChange,
    isSignificant,
    direction: percentChange > 0 ? 'increase' : 'decrease',
    topContributors,
    possibleReasons,
  };
}

function findTopContributors(
  merchantData: Record<string, any>,
  category: string
): SpendingAnomaly['topContributors'] {
  const categoryMerchants = Object.values(merchantData)
    .filter((m: any) => m.category === category)
    .sort((a: any, b: any) => b.totalSpend - a.totalSpend)
    .slice(0, 5);

  const categoryTotal = categoryMerchants.reduce((sum: number, m: any) => sum + m.totalSpend, 0);

  return categoryMerchants.map((m: any) => ({
    merchant: m.merchant,
    amount: m.totalSpend,
    count: m.transactionCount,
    percentOfCategory: categoryTotal > 0 ? (m.totalSpend / categoryTotal) * 100 : 0,
  }));
}

function generatePossibleReasons(
  category: CategorySpending,
  percentChange: number,
  topContributors: SpendingAnomaly['topContributors'],
  context: FinancialContext
): string[] {
  const reasons: string[] = [];

  // Check if one merchant dominates the change
  if (topContributors[0]?.percentOfCategory > 50) {
    reasons.push(
      `${topContributors[0].merchant} accounts for ${Math.round(topContributors[0].percentOfCategory)}% of ${category.category} spending`
    );
  }

  // Check if it's a trending category
  if (category.trend === 'increasing' && percentChange > 0) {
    reasons.push(`${category.category} has been trending upward for 3+ months`);
  }

  return reasons;
}

/**
 * Formats spending data for Claude analysis.
 */
export function formatSpendingForAnalysis(context: FinancialContext): { categoryData: string; topChanges: string } {
  // Format category data as a readable table
  const categoryLines = context.categoryAnalysis
    .filter((c) => c.currentMonth > 0 || c.previousMonth > 0)
    .slice(0, 15) // Top 15 categories
    .map((c) => {
      const changeIcon = c.percentChangeFromPrev > 10 ? '↑' : c.percentChangeFromPrev < -10 ? '↓' : '→';
      return `${c.category}: $${c.currentMonth.toFixed(0)} (prev: $${c.previousMonth.toFixed(0)}, ${changeIcon} ${c.percentChangeFromPrev.toFixed(0)}%, trend: ${c.trend})`;
    });

  // Format top changes
  const topChanges = context.categoryAnalysis
    .filter((c) => Math.abs(c.percentChangeFromPrev) > 20 && Math.abs(c.currentMonth - c.previousMonth) > 30)
    .sort((a, b) => Math.abs(b.percentChangeFromPrev) - Math.abs(a.percentChangeFromPrev))
    .slice(0, 5)
    .map((c) => {
      const direction = c.percentChangeFromPrev > 0 ? 'increased' : 'decreased';
      const topMerchant = Object.values(context.currentMonth.byMerchant)
        .filter((m: any) => m.category === c.category)
        .sort((a: any, b: any) => b.totalSpend - a.totalSpend)[0];

      let detail = `${c.category}: ${direction} ${Math.abs(c.percentChangeFromPrev).toFixed(0)}% ($${c.previousMonth.toFixed(0)} → $${c.currentMonth.toFixed(0)})`;
      if (topMerchant) {
        detail += ` | Top: ${topMerchant.merchant} ($${topMerchant.totalSpend.toFixed(0)}, ${topMerchant.transactionCount}x)`;
      }
      return detail;
    });

  return {
    categoryData: categoryLines.join('\n'),
    topChanges: topChanges.length > 0 ? topChanges.join('\n') : 'No significant changes detected',
  };
}
