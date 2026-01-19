import type { FinancialContext, MerchantPattern } from '../types';

export interface MerchantAnalyzerConfig {
  minTransactionCount: number; // Minimum transactions to analyze (default 3)
  minSpendAmount: number; // Minimum total spend to analyze (default 50)
  minFrequencyChange: number; // Min % frequency change to flag (default 50)
  minSpendChange: number; // Min % spend change to flag (default 30)
}

const DEFAULT_CONFIG: MerchantAnalyzerConfig = {
  minTransactionCount: 3,
  minSpendAmount: 50,
  minFrequencyChange: 50,
  minSpendChange: 30,
};

export interface MerchantInsight {
  merchant: string;
  category: string;
  insightType: 'frequency_change' | 'spend_change' | 'avg_order_change' | 'new_merchant' | 'stopped_merchant';
  currentPeriod: MerchantPattern['currentPeriod'];
  previousPeriod: MerchantPattern['previousPeriod'];
  change: number;
  description: string;
}

/**
 * Analyzes merchant patterns and identifies behavioral changes.
 */
export function analyzeMerchants(
  context: FinancialContext,
  config: MerchantAnalyzerConfig = DEFAULT_CONFIG
): MerchantInsight[] {
  const insights: MerchantInsight[] = [];

  for (const pattern of context.merchantPatterns) {
    // Skip small merchants
    if (
      pattern.currentPeriod.total < config.minSpendAmount &&
      pattern.previousPeriod.total < config.minSpendAmount
    ) {
      continue;
    }

    // Check for new merchant (wasn't in previous month)
    if (pattern.previousPeriod.count === 0 && pattern.currentPeriod.count >= 2) {
      insights.push({
        merchant: pattern.merchant,
        category: pattern.category,
        insightType: 'new_merchant',
        currentPeriod: pattern.currentPeriod,
        previousPeriod: pattern.previousPeriod,
        change: 100,
        description: `New merchant: ${pattern.currentPeriod.count} transactions totaling $${pattern.currentPeriod.total.toFixed(0)}`,
      });
      continue;
    }

    // Check for stopped merchant (was in previous, not in current)
    if (pattern.currentPeriod.count === 0 && pattern.previousPeriod.count >= 3) {
      insights.push({
        merchant: pattern.merchant,
        category: pattern.category,
        insightType: 'stopped_merchant',
        currentPeriod: pattern.currentPeriod,
        previousPeriod: pattern.previousPeriod,
        change: -100,
        description: `Stopped using: was ${pattern.previousPeriod.count} transactions ($${pattern.previousPeriod.total.toFixed(0)}) last month`,
      });
      continue;
    }

    // Need minimum transactions to analyze patterns
    if (
      pattern.currentPeriod.count < config.minTransactionCount &&
      pattern.previousPeriod.count < config.minTransactionCount
    ) {
      continue;
    }

    // Check frequency change
    if (Math.abs(pattern.frequencyChange) >= config.minFrequencyChange) {
      const direction = pattern.frequencyChange > 0 ? 'more' : 'less';
      insights.push({
        merchant: pattern.merchant,
        category: pattern.category,
        insightType: 'frequency_change',
        currentPeriod: pattern.currentPeriod,
        previousPeriod: pattern.previousPeriod,
        change: pattern.frequencyChange,
        description: `Ordering ${direction} often: ${pattern.previousPeriod.count}→${pattern.currentPeriod.count} times (${pattern.frequencyChange > 0 ? '+' : ''}${pattern.frequencyChange.toFixed(0)}%)`,
      });
    }

    // Check average order change (interesting for behavioral insights)
    if (
      Math.abs(pattern.avgOrderChange) >= 25 &&
      pattern.currentPeriod.count >= 3 &&
      pattern.previousPeriod.count >= 3
    ) {
      const direction = pattern.avgOrderChange > 0 ? 'larger' : 'smaller';
      insights.push({
        merchant: pattern.merchant,
        category: pattern.category,
        insightType: 'avg_order_change',
        currentPeriod: pattern.currentPeriod,
        previousPeriod: pattern.previousPeriod,
        change: pattern.avgOrderChange,
        description: `${direction} orders: avg $${pattern.previousPeriod.avgTransaction.toFixed(0)}→$${pattern.currentPeriod.avgTransaction.toFixed(0)} (${pattern.avgOrderChange > 0 ? '+' : ''}${pattern.avgOrderChange.toFixed(0)}%)`,
      });
    }

    // Check total spend change (if significant)
    if (
      Math.abs(pattern.spendChange) >= config.minSpendChange &&
      Math.abs(pattern.currentPeriod.total - pattern.previousPeriod.total) >= 50
    ) {
      const direction = pattern.spendChange > 0 ? 'increased' : 'decreased';
      insights.push({
        merchant: pattern.merchant,
        category: pattern.category,
        insightType: 'spend_change',
        currentPeriod: pattern.currentPeriod,
        previousPeriod: pattern.previousPeriod,
        change: pattern.spendChange,
        description: `Spending ${direction}: $${pattern.previousPeriod.total.toFixed(0)}→$${pattern.currentPeriod.total.toFixed(0)} (${pattern.spendChange > 0 ? '+' : ''}${pattern.spendChange.toFixed(0)}%)`,
      });
    }
  }

  // Sort by absolute change magnitude
  return insights.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/**
 * Formats merchant data for Claude analysis.
 */
export function formatMerchantsForAnalysis(context: FinancialContext, maxMerchants: number = 15): string {
  const significantPatterns = context.merchantPatterns
    .filter((p) => p.currentPeriod.total >= 30 || p.previousPeriod.total >= 30)
    .slice(0, maxMerchants);

  return significantPatterns
    .map((p) => {
      const lines = [
        `MERCHANT: ${p.merchant} (${p.category})`,
        `  Current: ${p.currentPeriod.count} orders, $${p.currentPeriod.total.toFixed(0)} total, $${p.currentPeriod.avgTransaction.toFixed(0)} avg`,
        `  Previous: ${p.previousPeriod.count} orders, $${p.previousPeriod.total.toFixed(0)} total, $${p.previousPeriod.avgTransaction.toFixed(0)} avg`,
        `  Changes: frequency ${p.frequencyChange > 0 ? '+' : ''}${p.frequencyChange.toFixed(0)}%, spend ${p.spendChange > 0 ? '+' : ''}${p.spendChange.toFixed(0)}%, avg order ${p.avgOrderChange > 0 ? '+' : ''}${p.avgOrderChange.toFixed(0)}%`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}
