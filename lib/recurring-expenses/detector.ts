import db from '../db';
import {
  ExpenseType,
  Priority,
  ConfidenceLevel,
  Trend,
  MerchantStats,
  DetectionResult,
  DetectionFilters,
  RecurringExpenseWithAnomalies,
  DetectionSummary,
} from './types';

/**
 * Normalize merchant name for recurring expense detection
 * Extends logic from monthly-close.ts normalizeMerchantName()
 */
export function normalizeMerchantForRecurring(description: string): { key: string; display: string } {
  let normalized = description.toLowerCase();

  // Remove transaction prefixes
  normalized = normalized.replace(/^(purchase authorized on|recurring payment authorized on|purchase|paypal inst xfer)\s+/i, '');

  // Remove dates (MM/DD format)
  normalized = normalized.replace(/\d{2}\/\d{2}(\/\d{4})?\s*/g, '');

  // Remove transaction IDs (long numbers, reference codes)
  normalized = normalized.replace(/\s+\d{10,}\s*/g, ' ');
  normalized = normalized.replace(/\s+[a-z]\d+\w*\s*/gi, ' ');
  normalized = normalized.replace(/\s+s\d{12,}\s*/gi, ' ');

  // Remove card numbers
  normalized = normalized.replace(/card\s+\d{4}/i, '');

  // Extract core merchant name
  const parts = normalized.trim().split(/\s{2,}/);
  let merchant = parts[0].trim();

  // Special handling for known merchants
  const merchantLower = merchant.toLowerCase();

  if (merchantLower.includes('amazon')) return { key: 'amazon', display: 'Amazon' };
  if (merchantLower.includes('so cal edison') || merchantLower.includes('socal edison') || merchantLower.includes('sce')) {
    return { key: 'socal_edison', display: 'SoCal Edison' };
  }
  if (merchantLower.includes('hbomax') || merchantLower.includes('hbo')) return { key: 'hbo_max', display: 'HBO Max' };
  if (merchantLower.includes('openai') || merchantLower.includes('chatgpt')) return { key: 'openai', display: 'OpenAI' };
  if (merchantLower.includes('godaddy')) return { key: 'godaddy', display: 'GoDaddy' };
  if (merchantLower.includes('monarch money')) return { key: 'monarch_money', display: 'Monarch Money' };
  if (merchantLower.includes('x corp') || merchantLower.includes('twitter')) return { key: 'x_corp', display: 'X (Twitter)' };
  if (merchantLower.includes('chipotle')) return { key: 'chipotle', display: 'Chipotle' };
  if (merchantLower.includes('sprouts')) return { key: 'sprouts', display: 'Sprouts Farmers Market' };
  if (merchantLower.includes('ralphs')) return { key: 'ralphs', display: 'Ralphs' };
  if (merchantLower.includes('trader joe')) return { key: 'trader_joes', display: 'Trader Joes' };
  if (merchantLower.includes('costco')) return { key: 'costco', display: 'Costco' };
  if (merchantLower.includes('whole foods')) return { key: 'whole_foods', display: 'Whole Foods' };
  if (merchantLower.includes('netflix')) return { key: 'netflix', display: 'Netflix' };
  if (merchantLower.includes('spotify')) return { key: 'spotify', display: 'Spotify' };
  if (merchantLower.includes('apple.com') || merchantLower.includes('apple bill')) return { key: 'apple', display: 'Apple' };
  if (merchantLower.includes('google storage') || merchantLower.includes('google one')) return { key: 'google_one', display: 'Google One' };

  // Truncate to reasonable length
  const truncated = merchant.substring(0, 50);

  return {
    key: truncated.replace(/[^a-z0-9]/g, '_'),
    display: truncated.charAt(0).toUpperCase() + truncated.slice(1),
  };
}

/**
 * Classify expense type based on pattern statistics
 */
function classifyExpenseType(stats: MerchantStats): ExpenseType {
  const { avg_interval_days, interval_std_dev, avg_amount, amount_std_dev, occurrence_count } = stats;

  if (!avg_interval_days) {
    return 'variable_recurring';
  }

  // Calculate coefficient of variation for amounts and intervals
  const amount_cv = amount_std_dev && amount_std_dev > 0 ? (amount_std_dev / avg_amount) * 100 : 0;
  const interval_cv = interval_std_dev && interval_std_dev > 0 ? (interval_std_dev / avg_interval_days) * 100 : 0;

  // SUBSCRIPTION: Monthly (25-35 days), consistent amount (<10% variance)
  if (avg_interval_days >= 25 && avg_interval_days <= 35 && amount_cv < 10 && occurrence_count >= 3) {
    return 'subscription';
  }

  // FIXED: Regular interval (<15% variance), consistent amount (<10% variance)
  if (interval_cv < 15 && amount_cv < 10) {
    return 'fixed';
  }

  // SEASONAL: Long intervals (>60 days) or quarterly/annual patterns
  if (
    avg_interval_days > 60 ||
    Math.abs(avg_interval_days - 90) < 5 || // Quarterly
    Math.abs(avg_interval_days - 365) < 10 // Annual
  ) {
    return 'seasonal';
  }

  // VARIABLE_RECURRING: Regular timing but variable amounts
  if (interval_cv < 25 && amount_cv >= 10) {
    return 'variable_recurring';
  }

  return 'variable_recurring'; // Default
}

/**
 * Classify priority based on merchant and expense type
 */
function classifyPriority(merchant: string, expenseType: ExpenseType): Priority {
  const merchantLower = merchant.toLowerCase();

  // Essential: utilities, rent-related, insurance
  if (
    merchantLower.includes('edison') ||
    merchantLower.includes('gas') ||
    merchantLower.includes('water') ||
    merchantLower.includes('insurance') ||
    merchantLower.includes('electric') ||
    merchantLower.includes('utility')
  ) {
    return 'essential';
  }

  // Discretionary: entertainment, subscriptions
  if (
    expenseType === 'subscription' ||
    merchantLower.includes('hbo') ||
    merchantLower.includes('netflix') ||
    merchantLower.includes('spotify') ||
    merchantLower.includes('disney') ||
    merchantLower.includes('gaming') ||
    merchantLower.includes('entertainment')
  ) {
    return 'discretionary';
  }

  // Important: groceries, professional services
  if (
    merchantLower.includes('market') ||
    merchantLower.includes('groceries') ||
    merchantLower.includes('sprouts') ||
    merchantLower.includes('ralphs') ||
    merchantLower.includes('trader joe') ||
    merchantLower.includes('costco') ||
    merchantLower.includes('whole foods') ||
    merchantLower.includes('godaddy') ||
    merchantLower.includes('openai') ||
    merchantLower.includes('google') ||
    merchantLower.includes('apple') ||
    merchantLower.includes('storage')
  ) {
    return 'important';
  }

  return 'important'; // Default
}

/**
 * Calculate confidence score for recurring expense detection
 */
function calculateConfidence(stats: MerchantStats): ConfidenceLevel {
  const { occurrence_count, interval_std_dev, avg_interval_days, amount_std_dev, avg_amount, last_date } = stats;

  let score = 0;

  // Occurrence count (0-25 points)
  if (occurrence_count >= 6) score += 25;
  else if (occurrence_count >= 4) score += 20;
  else if (occurrence_count >= 3) score += 15;
  else if (occurrence_count >= 2) score += 10;

  // Interval consistency (0-30 points)
  if (avg_interval_days) {
    const interval_cv = interval_std_dev && interval_std_dev > 0 ? (interval_std_dev / avg_interval_days) * 100 : 0;
    if (interval_cv < 5) score += 30;
    else if (interval_cv < 10) score += 25;
    else if (interval_cv < 20) score += 20;
    else if (interval_cv < 30) score += 10;
  }

  // Amount consistency (0-30 points) - increased weight for subscriptions
  const amount_cv = amount_std_dev && amount_std_dev > 0 ? (amount_std_dev / avg_amount) * 100 : 0;
  if (amount_cv < 1) score += 30; // Perfectly fixed amount (subscriptions)
  else if (amount_cv < 5) score += 25;
  else if (amount_cv < 10) score += 20;
  else if (amount_cv < 25) score += 10;

  // Recent activity (0-15 points)
  if (avg_interval_days) {
    const lastDate = new Date(last_date);
    const today = new Date();
    const daysSinceLast = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLast < avg_interval_days * 1.5) score += 15;
    else if (daysSinceLast < avg_interval_days * 2) score += 8;
  }

  // Total: 100 points possible
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

/**
 * Main detection function - analyzes transactions and identifies recurring expenses
 */
export async function detectRecurringExpenses(filters?: DetectionFilters): Promise<DetectionResult> {
  // Get all expense transactions
  const allTransactions = db
    .prepare(
      `
    SELECT id, description, normalized_date, ABS(amount) as amount
    FROM transactions
    WHERE category = 'expense'
      AND normalized_date IS NOT NULL
    ORDER BY normalized_date
  `
    )
    .all() as Array<{ id: number; description: string; normalized_date: string; amount: number }>;

  // Group transactions by normalized merchant
  const merchantGroups = new Map<
    string,
    Array<{ id: number; description: string; normalized_date: string; amount: number }>
  >();

  for (const txn of allTransactions) {
    const { key } = normalizeMerchantForRecurring(txn.description);
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(txn);
  }

  // Calculate statistics for each merchant group
  const merchantStats: MerchantStats[] = [];

  for (const [merchant_key, transactions] of merchantGroups.entries()) {
    if (transactions.length < 2) continue; // Need at least 2 occurrences

    // Sort by date
    transactions.sort((a, b) => new Date(a.normalized_date).getTime() - new Date(b.normalized_date).getTime());

    // Calculate intervals
    const intervals: number[] = [];
    for (let i = 1; i < transactions.length; i++) {
      const prevDate = new Date(transactions[i - 1].normalized_date);
      const currDate = new Date(transactions[i].normalized_date);
      const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(daysDiff);
    }

    if (intervals.length === 0) continue; // Need at least one interval

    // Calculate interval statistics
    const avg_interval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    let interval_std_dev: number | null = null;
    if (intervals.length > 1) {
      const variance =
        intervals.reduce((sum, val) => sum + Math.pow(val - avg_interval, 2), 0) / (intervals.length - 1);
      interval_std_dev = Math.sqrt(variance);
    }

    // Calculate amount statistics
    const amounts = transactions.map((t) => t.amount);
    const avg_amount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    let amount_std_dev: number | null = null;
    if (amounts.length > 1) {
      const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg_amount, 2), 0) / (amounts.length - 1);
      amount_std_dev = Math.sqrt(variance);
      // Handle fixed amounts (std dev very close to 0)
      if (amount_std_dev < 0.01) amount_std_dev = 0;
    } else {
      amount_std_dev = 0; // Single occurrence, treat as fixed
    }

    merchantStats.push({
      merchant_key,
      sample_description: transactions[0].description,
      occurrence_count: transactions.length,
      interval_count: intervals.length,
      avg_interval_days: avg_interval,
      interval_std_dev,
      avg_amount,
      amount_std_dev,
      min_amount: Math.min(...amounts),
      max_amount: Math.max(...amounts),
      first_date: transactions[0].normalized_date,
      last_date: transactions[transactions.length - 1].normalized_date,
      transaction_ids: transactions.map((t) => t.id).join(','),
      transaction_amounts: amounts.join(','),
    });
  }

  // Sort by occurrence count (descending) then interval (ascending)
  merchantStats.sort((a, b) => {
    if (b.occurrence_count !== a.occurrence_count) {
      return b.occurrence_count - a.occurrence_count;
    }
    return (a.avg_interval_days || 0) - (b.avg_interval_days || 0);
  });

  // Process each merchant group
  const recurringExpenses: RecurringExpenseWithAnomalies[] = [];
  const corrections = new Map<string, boolean>();

  // Load user corrections
  const userCorrections = db.prepare('SELECT merchant_normalized, is_recurring FROM expense_corrections').all() as Array<{
    merchant_normalized: string;
    is_recurring: number;
  }>;

  for (const correction of userCorrections) {
    corrections.set(correction.merchant_normalized, correction.is_recurring === 1);
  }

  for (const stats of merchantStats) {
    const { key: merchant_key, display: merchant_display } = normalizeMerchantForRecurring(stats.sample_description);

    // Check user corrections
    const userOverride = corrections.get(merchant_key);
    if (userOverride === false) {
      // User marked as not recurring - skip
      continue;
    }

    // Classify
    const expense_type = classifyExpenseType(stats);
    const priority = classifyPriority(merchant_display, expense_type);
    let confidence = calculateConfidence(stats);

    // Boost confidence if user confirmed
    if (userOverride === true) {
      confidence = 'high';
    }

    // Calculate typical day of month for monthly expenses
    let typical_day_of_month: number | null = null;
    if (stats.avg_interval_days && stats.avg_interval_days >= 25 && stats.avg_interval_days <= 35) {
      // Parse transaction dates to find most common day
      const transactionDates = stats.transaction_ids.split(',').map((id, idx) => {
        const dateStr = db
          .prepare('SELECT normalized_date FROM transactions WHERE id = ?')
          .get(parseInt(id)) as { normalized_date: string };
        return new Date(dateStr.normalized_date).getDate();
      });

      // Find most common day
      const dayCounts = new Map<number, number>();
      for (const day of transactionDates) {
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      }

      let maxCount = 0;
      for (const [day, count] of dayCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          typical_day_of_month = day;
        }
      }
    }

    // Get last transaction details
    const lastTransactionId = parseInt(stats.transaction_ids.split(',').slice(-1)[0]);
    const lastTransaction = db.prepare('SELECT amount FROM transactions WHERE id = ?').get(lastTransactionId) as {
      amount: number;
    };

    // Calculate amount variance percentage
    const amount_variance_pct = stats.amount_std_dev ? (stats.amount_std_dev / stats.avg_amount) * 100 : 0;

    // Create recurring expense object
    const recurringExpense: RecurringExpenseWithAnomalies = {
      id: 0, // Will be set after insert
      merchant_normalized: merchant_key,
      merchant_display_name: merchant_display,
      category: 'expense',
      expense_type,
      priority,
      frequency_days: stats.avg_interval_days || 30,
      frequency_variance_days: stats.interval_std_dev,
      typical_day_of_month,
      typical_amount: stats.avg_amount,
      amount_variance_pct,
      min_amount: stats.min_amount,
      max_amount: stats.max_amount,
      trend: null, // Will be calculated later
      occurrence_count: stats.occurrence_count,
      first_occurrence_date: stats.first_date,
      last_occurrence_date: stats.last_date,
      last_amount: Math.abs(lastTransaction.amount),
      next_predicted_date: null, // Will be calculated later
      next_predicted_amount: null, // Will be calculated later
      prediction_confidence: null,
      confidence,
      sample_transaction_ids: null,
      detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_confirmed: userOverride === true ? 1 : 0,
      user_excluded: 0,
      tracked: 1, // Default to tracked
      amount_range: [stats.min_amount, stats.max_amount],
      sample_transactions: stats.transaction_ids.split(',').map((id) => parseInt(id)),
    };

    // Insert/update in database
    db.prepare(
      `
      INSERT INTO recurring_expenses (
        merchant_normalized, merchant_display_name, category,
        expense_type, priority,
        frequency_days, frequency_variance_days, typical_day_of_month,
        typical_amount, amount_variance_pct, min_amount, max_amount,
        occurrence_count, first_occurrence_date, last_occurrence_date, last_amount,
        confidence, sample_transaction_ids, user_confirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(merchant_normalized) DO UPDATE SET
        occurrence_count = excluded.occurrence_count,
        last_occurrence_date = excluded.last_occurrence_date,
        last_amount = excluded.last_amount,
        typical_amount = excluded.typical_amount,
        min_amount = excluded.min_amount,
        max_amount = excluded.max_amount,
        frequency_days = excluded.frequency_days,
        frequency_variance_days = excluded.frequency_variance_days,
        amount_variance_pct = excluded.amount_variance_pct,
        confidence = excluded.confidence,
        updated_at = CURRENT_TIMESTAMP
    `
    ).run(
      merchant_key,
      merchant_display,
      'expense',
      expense_type,
      priority,
      recurringExpense.frequency_days,
      recurringExpense.frequency_variance_days,
      typical_day_of_month,
      stats.avg_amount,
      amount_variance_pct,
      stats.min_amount,
      stats.max_amount,
      stats.occurrence_count,
      stats.first_date,
      stats.last_date,
      recurringExpense.last_amount,
      confidence,
      stats.transaction_ids,
      userOverride === true ? 1 : 0
    );

    // Fetch the actual ID and tracked status from database
    const dbRecord = db
      .prepare('SELECT id, tracked FROM recurring_expenses WHERE merchant_normalized = ?')
      .get(merchant_key) as { id: number; tracked: number } | undefined;

    if (dbRecord) {
      recurringExpense.id = dbRecord.id;
      recurringExpense.tracked = dbRecord.tracked;
    }

    recurringExpenses.push(recurringExpense);
  }

  // Generate summary
  const summary: DetectionSummary = {
    total_recurring: recurringExpenses.length,
    transactions_analyzed: db.prepare("SELECT COUNT(*) as count FROM transactions WHERE category = 'expense'").get() as {
      count: number;
    },
    by_type: {
      fixed: recurringExpenses.filter((e) => e.expense_type === 'fixed').length,
      variable_recurring: recurringExpenses.filter((e) => e.expense_type === 'variable_recurring').length,
      seasonal: recurringExpenses.filter((e) => e.expense_type === 'seasonal').length,
      subscription: recurringExpenses.filter((e) => e.expense_type === 'subscription').length,
    },
    by_confidence: {
      high: recurringExpenses.filter((e) => e.confidence === 'high').length,
      medium: recurringExpenses.filter((e) => e.confidence === 'medium').length,
      low: recurringExpenses.filter((e) => e.confidence === 'low').length,
    },
    by_priority: {
      essential: recurringExpenses.filter((e) => e.priority === 'essential').length,
      important: recurringExpenses.filter((e) => e.priority === 'important').length,
      discretionary: recurringExpenses.filter((e) => e.priority === 'discretionary').length,
    },
    total_monthly_cost: recurringExpenses
      .filter((e) => e.frequency_days >= 25 && e.frequency_days <= 35)
      .reduce((sum, e) => sum + e.typical_amount, 0),
    detection_run_at: new Date().toISOString(),
  };

  return {
    summary,
    recurring_expenses: recurringExpenses,
  };
}
