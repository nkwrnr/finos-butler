import db from '../db';

/**
 * Transaction categories based on accounting rules
 */
export type Category =
  | 'income'              // Payroll deposits
  | 'expense'             // Real spending (purchases, bills)
  | 'rent'                // Fixed housing expense (bank checks, landlord payments)
  | 'zcash_purchase'      // Coinbase/Gemini crypto buys
  | 'savings_transfer'    // Money moved TO savings (outflow from checking)
  | 'credit_payment'      // Paying off credit card (outflow from checking)
  | 'transfer_in'         // Money coming back from savings, refunds, transfers in
  | 'transfer_internal'   // Moving between own accounts (net zero)
  | 'tax_refund'          // IRS, state tax refunds
  | 'credit_reward'       // Cashback, statement credits on credit cards
  | 'fee'                 // Interest charges, bank fees
  | 'refund'              // Purchase refunds
  | 'uncategorized';      // Needs manual review

export type AccountType = 'checking' | 'credit_card' | 'savings';

export type CategorizationResult = {
  category: Category;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

/**
 * Categorize a transaction based on description, amount, and account type
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  accountType: AccountType,
  accountName: string
): CategorizationResult {
  const desc = description.toLowerCase();

  // CHECKING ACCOUNT RULES
  if (accountType === 'checking') {
    if (amount > 0) {
      // Positive amounts = money coming IN

      // Payroll income (including reimbursements)
      if (desc.includes('heygen') && (desc.includes('payroll') || desc.includes('reimb') || amount > 1000)) {
        return { category: 'income', confidence: 'high', reason: 'Payroll deposit from HEYGEN' };
      }

      // Tax refunds
      if (desc.includes('irs treas') || desc.includes('tax ref') || desc.includes('franchise tax')) {
        return { category: 'tax_refund', confidence: 'high', reason: 'Tax refund from IRS/state' };
      }

      // Transfers from savings
      if (desc.includes('ally bank') && (desc.includes('transfer') || desc.includes('acct fund'))) {
        return { category: 'transfer_in', confidence: 'high', reason: 'Transfer from Ally savings' };
      }
      if (desc.includes('online transfer to warner')) {
        return { category: 'transfer_in', confidence: 'high', reason: 'Internal transfer' };
      }

      // Crypto refunds/reversals
      if (desc.includes('coinbase') || desc.includes('gemini')) {
        return { category: 'refund', confidence: 'medium', reason: 'Crypto purchase refund/reversal' };
      }

      // P2P transfers
      if (desc.includes('zelle') || desc.includes('venmo')) {
        return { category: 'transfer_in', confidence: 'medium', reason: 'P2P transfer received' };
      }

      // Purchase refunds/reversals (positive "Purchase authorized" = refund)
      if (desc.includes('purchase authorized') || desc.includes('purchase with cash back') ||
          desc.includes('purchase return') || desc.includes('purchase intl')) {
        return { category: 'refund', confidence: 'high', reason: 'Purchase refund/reversal' };
      }

      // International transaction fee refunds
      if (desc.includes('international') && desc.includes('fee')) {
        return { category: 'refund', confidence: 'high', reason: 'International fee refund' };
      }

      // ATM withdrawal refunds
      if (desc.includes('atm withdrawal') || desc.includes('atm transaction')) {
        return { category: 'refund', confidence: 'high', reason: 'ATM fee refund/reversal' };
      }

      // Generic refunds
      if (desc.includes('refund') || desc.includes('credit') || desc.includes('reversal')) {
        return { category: 'refund', confidence: 'medium', reason: 'Purchase refund/credit' };
      }

      // Credit card payment reversals (positive = payment being returned)
      if (desc.includes('chase credit') || desc.includes('payment thank you')) {
        return { category: 'refund', confidence: 'medium', reason: 'Credit card payment reversal' };
      }

      // Autopay and recurring payment refunds/reversals
      if (desc.includes('autopay') || desc.includes('directpay') || desc.includes('recurring payment')) {
        return { category: 'refund', confidence: 'medium', reason: 'Bill payment refund/reversal' };
      }

      // PayPal transfers
      if (desc.includes('paypal')) {
        // Large PayPal from eBay = income (selling items)
        if (desc.includes('ebay') && amount > 100) {
          return { category: 'income', confidence: 'medium', reason: 'eBay sale proceeds' };
        }
        // Small amounts are transfers
        return { category: 'transfer_in', confidence: 'medium', reason: 'PayPal transfer' };
      }

      // Bank check purchases/refunds
      if (desc.includes('bank check') || desc.includes('check deposit')) {
        return { category: 'refund', confidence: 'low', reason: 'Check transaction refund' };
      }

      // Online transfer (internal)
      if (desc.includes('online transfer')) {
        return { category: 'transfer_in', confidence: 'medium', reason: 'Internal transfer' };
      }

      // Instant payments from employer systems
      if (desc.includes('instant pmt') || desc.includes('people center')) {
        return { category: 'income', confidence: 'medium', reason: 'Instant payment from employer' };
      }

      // Check deposits (likely income or transfers)
      if (desc.includes('check') && !desc.includes('check card')) {
        return { category: 'transfer_in', confidence: 'low', reason: 'Check deposit' };
      }

      return { category: 'uncategorized', confidence: 'low', reason: 'Unknown positive transaction on checking' };
    } else {
      // Negative amounts = money going OUT

      // Rent payments (must check BEFORE general expenses)
      if ((desc.includes('bank check') || desc.includes('draft')) && Math.abs(amount) > 2500) {
        return { category: 'rent', confidence: 'high', reason: 'Rent payment via bank check' };
      }
      if (desc.includes('way2save')) {
        return { category: 'rent', confidence: 'high', reason: 'Rent payment via Way2Save transfer' };
      }
      if (desc.includes('shelby')) {
        return { category: 'rent', confidence: 'high', reason: 'Rent payment to landlord' };
      }

      // Crypto purchases
      if (desc.includes('coinbase') || desc.includes('gemini')) {
        return { category: 'zcash_purchase', confidence: 'high', reason: 'Cryptocurrency purchase' };
      }

      // Savings transfers
      if (desc.includes('ally bank') && desc.includes('transfer')) {
        return { category: 'savings_transfer', confidence: 'high', reason: 'Transfer to Ally savings' };
      }

      // Credit card payments
      if (desc.includes('chase card') || desc.includes('wf credit card') || desc.includes('autopay') ||
          desc.includes('credit crd') || desc.includes('epay') || desc.includes('crd epay')) {
        return { category: 'credit_payment', confidence: 'high', reason: 'Credit card auto-payment' };
      }
      if (desc.includes('bilt') && desc.includes('transfer')) {
        return { category: 'credit_payment', confidence: 'high', reason: 'Bilt credit card payment' };
      }

      // All other negative amounts are expenses
      return { category: 'expense', confidence: 'high', reason: 'Purchase/expense' };
    }
  }

  // CREDIT CARD RULES
  if (accountType === 'credit_card') {
    if (amount > 0) {
      // Positive amounts = CREDITS to the card (reduce balance)

      // Interest charges (treated as fee, not income)
      if (desc.includes('interest charge')) {
        return { category: 'fee', confidence: 'high', reason: 'Credit card interest charge' };
      }

      // Refunds
      if (desc.includes('refund') || desc.includes('return') || desc.includes('credit')) {
        return { category: 'refund', confidence: 'high', reason: 'Purchase return/refund' };
      }

      // Everything else positive on credit card = rewards/credits
      return { category: 'credit_reward', confidence: 'medium', reason: 'Cashback/statement credit' };
    } else {
      // Negative amounts = CHARGES or PAYMENTS

      // Payments from checking (Chase records as negative)
      if (desc.includes('payment thank you') || desc.includes('automatic payment')) {
        return { category: 'credit_payment', confidence: 'high', reason: 'Credit card payment posted' };
      }

      // All other negative amounts are expenses (purchases)
      return { category: 'expense', confidence: 'high', reason: 'Credit card purchase' };
    }
  }

  // SAVINGS ACCOUNT RULES
  if (accountType === 'savings') {
    if (amount > 0) {
      // Positive amounts = deposits INTO savings

      // Transfers from checking
      if (desc.includes('requested transfer') || desc.includes('transfer from')) {
        return { category: 'savings_transfer', confidence: 'high', reason: 'Deposit to savings' };
      }

      // Interest earned
      if (desc.includes('interest')) {
        return { category: 'credit_reward', confidence: 'low', reason: 'Savings interest earned' };
      }

      return { category: 'transfer_in', confidence: 'medium', reason: 'Deposit to savings' };
    } else {
      // Negative amounts = withdrawals FROM savings back to checking
      return { category: 'transfer_in', confidence: 'high', reason: 'Withdrawal from savings' };
    }
  }

  return { category: 'uncategorized', confidence: 'low', reason: 'Unknown transaction type' };
}

/**
 * Helper: Is this category a real expense for budgeting?
 */
export function isRealExpense(category: Category): boolean {
  return category === 'expense'; // NOT rent (fixed expense)
}

/**
 * Helper: Is this a fixed expense (not variable)?
 */
export function isFixedExpense(category: Category): boolean {
  return category === 'rent';
}

/**
 * Helper: Is this category real income (not transfers/refunds)?
 */
export function isRealIncome(category: Category): boolean {
  return category === 'income'; // NOT tax_refund, NOT transfer_in
}

/**
 * Helper: Is this a cash outflow from checking?
 */
export function isCashOutflow(category: Category): boolean {
  return ['expense', 'rent', 'zcash_purchase', 'savings_transfer', 'credit_payment'].includes(category);
}

/**
 * Get account type from account ID
 */
export function getAccountType(accountId: number): AccountType | null {
  const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(accountId) as { name: string } | undefined;

  if (!account) return null;

  const name = account.name.toLowerCase();

  if (name.includes('checking') || name.includes('wellsfargo')) return 'checking';
  if (name.includes('credit') || name.includes('chase') || name.includes('bilt')) return 'credit_card';
  if (name.includes('savings') || name.includes('ally')) return 'savings';

  return null;
}

/**
 * Validation result
 */
export type ValidationResult = {
  totalTransactions: number;
  uncategorized: number;
  errors: string[];
  warnings: string[];
  breakdown: Record<Category, { count: number; total: number }>;
};

/**
 * Validate categorization results
 */
export function validateCategorization(): ValidationResult {
  const transactions = db.prepare(`
    SELECT id, account_id, date, amount, description, category, normalized_date
    FROM transactions
  `).all() as Array<{
    id: number;
    account_id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
    normalized_date: string;
  }>;

  const errors: string[] = [];
  const warnings: string[] = [];
  const breakdown: Record<string, { count: number; total: number }> = {};

  // Count by category
  for (const txn of transactions) {
    if (!breakdown[txn.category]) {
      breakdown[txn.category] = { count: 0, total: 0 };
    }
    breakdown[txn.category].count++;
    breakdown[txn.category].total += txn.amount;
  }

  const uncategorized = breakdown['uncategorized']?.count || 0;

  // Check for logical errors
  for (const txn of transactions) {
    // Positive amounts should never be expense
    if (txn.amount > 0 && txn.category === 'expense') {
      errors.push(`Transaction ${txn.id}: Positive amount categorized as expense`);
    }

    // Negative amounts should never be income
    if (txn.amount < 0 && txn.category === 'income') {
      errors.push(`Transaction ${txn.id}: Negative amount categorized as income`);
    }
  }

  // Check income frequency (expect ~2 per month for last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString().split('T')[0];

  const recentIncome = transactions.filter(t =>
    t.category === 'income' &&
    t.normalized_date &&
    t.normalized_date >= cutoff &&
    t.amount > 1000 // Real paychecks only
  );

  const monthsWithIncome = new Set(recentIncome.map(t => t.normalized_date.substring(0, 7)));
  const avgIncomePerMonth = recentIncome.length / Math.max(1, monthsWithIncome.size);

  if (avgIncomePerMonth < 1.5) {
    warnings.push(`Low income frequency: ${avgIncomePerMonth.toFixed(1)} paychecks/month (expected ~2)`);
  }
  if (avgIncomePerMonth > 3) {
    warnings.push(`High income frequency: ${avgIncomePerMonth.toFixed(1)} paychecks/month (expected ~2)`);
  }

  return {
    totalTransactions: transactions.length,
    uncategorized,
    errors,
    warnings,
    breakdown: breakdown as Record<Category, { count: number; total: number }>,
  };
}
