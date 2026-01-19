import db from './db';

/**
 * Parse dates that may be in MM/DD or MM/DD/YYYY or YYYY-MM-DD format
 * Returns normalized YYYY-MM-DD format
 */
function normalizeDate(dateStr: string): string {
  // Already in YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  // Handle MM/DD/YYYY format
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }

  // Handle MM/DD format (no year)
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const now = new Date();
    const currentYear = now.getFullYear();

    // Try current year first
    let date = new Date(currentYear, month - 1, day);

    // If the date is in the future, it's probably from last year
    if (date > now) {
      date = new Date(currentYear - 1, month - 1, day);
    }

    return date.toISOString().split('T')[0];
  }

  // Fallback
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

/**
 * Categorize a transaction based on description and amount
 */
export function categorizeTransaction(description: string, amount: number): string {
  const desc = description.toLowerCase();

  // INCOME - positive amounts from payroll
  if (amount > 0) {
    if (desc.includes('heygen') || desc.includes('payroll') || desc.includes('salary') || desc.includes('direct dep')) {
      return 'income';
    }
    return 'other_income';
  }

  // NEGATIVE amounts - need to distinguish between expenses and transfers

  // ZCASH_PURCHASE - Coinbase or Gemini purchases
  if (desc.includes('coinbase') || desc.includes('gemini')) {
    return 'zcash_purchase';
  }

  // SAVINGS_TRANSFER - Ally Bank transfers
  if (desc.includes('ally bank') && desc.includes('transfer')) {
    return 'savings_transfer';
  }

  // CREDIT_PAYMENT - payments to credit cards
  if (desc.includes('bilt') && desc.includes('transfer')) {
    return 'credit_payment';
  }
  if (desc.includes('chase credit crd epay')) {
    return 'credit_payment';
  }

  // Everything else negative is an EXPENSE
  return 'expense';
}

/**
 * Categorize all transactions in the database
 */
export function categorizeAllTransactions(): {
  total: number;
  categorized: number;
  breakdown: Record<string, { count: number; total: number }>;
} {
  const transactions = db.prepare('SELECT id, date, amount, description, category FROM transactions').all() as Array<{
    id: number;
    date: string;
    amount: number;
    description: string;
    category: string | null;
  }>;

  const breakdown: Record<string, { count: number; total: number }> = {};
  let categorized = 0;

  const updateStmt = db.prepare('UPDATE transactions SET category = ?, normalized_date = ? WHERE id = ?');
  const updateMany = db.transaction((txns: Array<{ id: number; category: string; normalized_date: string }>) => {
    for (const txn of txns) {
      updateStmt.run(txn.category, txn.normalized_date, txn.id);
    }
  });

  const updates: Array<{ id: number; category: string; normalized_date: string }> = [];

  for (const txn of transactions) {
    const category = categorizeTransaction(txn.description, txn.amount);
    const normalized_date = normalizeDate(txn.date);

    updates.push({ id: txn.id, category, normalized_date });

    // Track breakdown
    if (!breakdown[category]) {
      breakdown[category] = { count: 0, total: 0 };
    }
    breakdown[category].count++;
    breakdown[category].total += txn.amount;

    categorized++;
  }

  updateMany(updates);

  return {
    total: transactions.length,
    categorized,
    breakdown,
  };
}

/**
 * Get categorization statistics
 */
export function getCategorizationStats(): {
  total: number;
  categorized: number;
  uncategorized: number;
  breakdown: Record<string, { count: number; total: number }>;
} {
  const total = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
  const categorized = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE category IS NOT NULL AND category != 'uncategorized'").get() as { count: number };

  const categories = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total
    FROM transactions
    WHERE category IS NOT NULL AND category != 'uncategorized'
    GROUP BY category
  `).all() as Array<{ category: string; count: number; total: number }>;

  const breakdown: Record<string, { count: number; total: number }> = {};
  for (const cat of categories) {
    breakdown[cat.category] = { count: cat.count, total: cat.total };
  }

  return {
    total: total.count,
    categorized: categorized.count,
    uncategorized: total.count - categorized.count,
    breakdown,
  };
}
