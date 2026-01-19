import { runAnalystAgent } from '@/lib/agents/analyst';

async function main() {
  console.log('='.repeat(70));
  console.log('FINANCIAL ANALYST AGENT TEST');
  console.log('='.repeat(70));
  console.log('\nAnalyzing your financial data...\n');

  try {
    const result = await runAnalystAgent();

    console.log('✓ Analysis complete!\n');

    console.log('SUMMARY');
    console.log('-'.repeat(70));
    console.log(`Analysis Month: ${result.analysisMonth}`);
    console.log(`Run ID: ${result.runId}`);
    console.log(`Categories Analyzed: ${result.summary.totalCategoriesAnalyzed}`);
    console.log(`Spending Anomalies Found: ${result.summary.anomaliesFound}`);
    console.log(`Merchant Patterns Found: ${result.summary.merchantPatternsFound}`);
    console.log(`Insights Generated: ${result.summary.insightsGenerated}`);
    console.log('');

    if (result.generatedInsights.length > 0) {
      console.log('GENERATED INSIGHTS');
      console.log('='.repeat(70));

      for (const insight of result.generatedInsights) {
        const severityIcon = insight.severity === 'warning' ? '⚠️ ' : insight.severity === 'action_needed' ? '🔴 ' : '💡 ';
        console.log(`\n${severityIcon}${insight.title}`);
        console.log(`Category: ${insight.category || insight.merchant || 'General'}`);
        console.log(`${insight.body}`);
        if (insight.actionable && insight.actionText) {
          console.log(`→ Action: ${insight.actionText}`);
        }
        console.log('-'.repeat(70));
      }
    } else {
      console.log('\nNo significant insights generated. Your spending patterns look normal!');
    }

    // Show top spending anomalies
    if (result.spendingAnomalies.length > 0) {
      console.log('\nTOP SPENDING ANOMALIES');
      console.log('='.repeat(70));
      for (const anomaly of result.spendingAnomalies.slice(0, 5)) {
        const direction = anomaly.direction === 'increase' ? '↑' : '↓';
        console.log(
          `${direction} ${anomaly.category}: ${anomaly.percentChange > 0 ? '+' : ''}${anomaly.percentChange.toFixed(0)}% ($${anomaly.comparisonAmount.toFixed(0)} → $${anomaly.currentAmount.toFixed(0)})`
        );
        if (anomaly.topContributors.length > 0) {
          console.log(`   Top: ${anomaly.topContributors[0].merchant} ($${anomaly.topContributors[0].amount.toFixed(0)})`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('Analysis saved to database. View at /insights');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ Error running analyst agent:');
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
