import { NextRequest, NextResponse } from 'next/server';
import { detectRecurringExpenses } from '@/lib/recurring-expenses/detector';
import { applyPredictions } from '@/lib/recurring-expenses/predictor';
import { detectAndStoreAnomalies } from '@/lib/recurring-expenses/anomaly-detector';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      expense_type: searchParams.get('type') as any,
      priority: searchParams.get('priority') as any,
      confidence: searchParams.get('confidence') as any,
      include_predictions: searchParams.get('predictions') === 'true',
      include_anomalies: searchParams.get('anomalies') === 'true',
    };

    // Run detection
    const result = await detectRecurringExpenses(filters);

    // Apply predictions and anomalies to each expense
    for (const expense of result.recurring_expenses) {
      // Get transaction amounts for trend detection
      const transactionIds = expense.sample_transactions || [];
      const amounts: number[] = [];

      for (const id of transactionIds) {
        const txn = db.prepare('SELECT amount FROM transactions WHERE id = ?').get(id) as { amount: number } | undefined;
        if (txn) {
          amounts.push(Math.abs(txn.amount));
        }
      }

      // Apply predictions
      applyPredictions(expense, amounts);

      // Detect anomalies if requested
      if (filters.include_anomalies) {
        const anomalies = detectAndStoreAnomalies(expense);
        expense.anomalies = anomalies;
      }

      // Update database with predictions
      db.prepare(
        `
        UPDATE recurring_expenses
        SET next_predicted_date = ?,
            next_predicted_amount = ?,
            prediction_confidence = ?,
            trend = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE merchant_normalized = ?
      `
      ).run(
        expense.next_predicted_date,
        expense.next_predicted_amount,
        expense.prediction_confidence,
        expense.trend,
        expense.merchant_normalized
      );
    }

    // Filter by confidence level if specified
    if (filters.confidence) {
      result.recurring_expenses = result.recurring_expenses.filter((e) => e.confidence === filters.confidence);
      result.summary.total_recurring = result.recurring_expenses.length;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json({ error: `Failed to fetch recurring expenses: ${error}` }, { status: 500 });
  }
}
