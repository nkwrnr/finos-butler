'use client';

import { useState, useEffect } from 'react';

interface TransactionDetails {
  id: number;
  date: string;
  normalized_date: string;
  description: string;
  amount: number;
  category: string;
  spending_category: string | null;
  account_name: string;
  institution: string;
  account_type: string;
}

interface SimilarTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  spending_category: string | null;
  account_name: string;
}

interface TransactionModalProps {
  transactionId: number;
  onClose: () => void;
  onSave: () => void;
}

const SPENDING_CATEGORIES = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'gas', label: 'Gas' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'dining', label: 'Dining & Food' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'auto', label: 'Auto & Car' },
  { value: 'home', label: 'Home' },
  { value: 'travel', label: 'Travel' },
  { value: 'education', label: 'Education' },
  { value: 'pets', label: 'Pets' },
  { value: 'gifts', label: 'Gifts & Donations' },
  { value: 'fees', label: 'Fees' },
  { value: 'uncategorized', label: 'Uncategorized' },
];

export default function TransactionModal({ transactionId, onClose, onSave }: TransactionModalProps) {
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [similar, setSimilar] = useState<SimilarTransaction[]>([]);
  const [similarCount, setSimilarCount] = useState(0);
  const [category, setCategory] = useState('');
  const [updateSimilar, setUpdateSimilar] = useState(true);
  const [rememberPattern, setRememberPattern] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch transaction details
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch transaction details
        const txRes = await fetch(`/api/transactions/${transactionId}`);
        if (!txRes.ok) throw new Error('Failed to fetch transaction');
        const txData = await txRes.json();
        setTransaction(txData);
        setCategory(txData.spending_category || 'uncategorized');

        // Fetch similar transactions
        const simRes = await fetch(`/api/transactions/${transactionId}/similar`);
        if (simRes.ok) {
          const simData = await simRes.json();
          setSimilar(simData.similar);
          setSimilarCount(simData.count);
        }
      } catch (err) {
        setError('Failed to load transaction details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [transactionId]);

  const handleSave = async () => {
    if (!transaction || !category) return;

    setSaving(true);
    setResult(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spending_category: category,
          update_similar: updateSimilar && similarCount > 0,
          remember_pattern: rememberPattern,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const msg = data.updated > 1
          ? `Updated ${data.updated} transactions${data.patternSaved ? ' and saved pattern' : ''}`
          : `Category updated${data.patternSaved ? ' and pattern saved' : ''}`;
        setResult({ success: true, message: msg });

        setTimeout(() => {
          onSave();
        }, 1000);
      } else {
        setResult({ success: false, message: data.error || 'Failed to update' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const hasChanged = transaction && category !== (transaction.spending_category || 'uncategorized');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-primary transition p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading && (
            <div className="text-center text-secondary py-8">Loading...</div>
          )}

          {error && (
            <div className="bg-negative/10 border border-negative/30 text-negative p-3 rounded-lg">
              {error}
            </div>
          )}

          {!loading && transaction && (
            <>
              {/* Description */}
              <div className="bg-elevated border border-border rounded-lg p-3">
                <p className="text-sm text-secondary mb-1">Description</p>
                <p className="font-medium text-primary break-words">{transaction.description}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-elevated border border-border rounded-lg p-3">
                  <p className="text-sm text-secondary mb-1">Amount</p>
                  <p className={`font-semibold tabular-nums ${transaction.amount < 0 ? 'text-negative' : 'text-positive'}`}>
                    {transaction.amount < 0 ? '-' : '+'}{formatCurrency(transaction.amount)}
                  </p>
                </div>
                <div className="bg-elevated border border-border rounded-lg p-3">
                  <p className="text-sm text-secondary mb-1">Date</p>
                  <p className="font-medium">{formatDate(transaction.date)}</p>
                </div>
                <div className="bg-elevated border border-border rounded-lg p-3">
                  <p className="text-sm text-secondary mb-1">Account</p>
                  <p className="font-medium">{transaction.account_name}</p>
                </div>
                <div className="bg-elevated border border-border rounded-lg p-3">
                  <p className="text-sm text-secondary mb-1">Bank</p>
                  <p className="font-medium">{transaction.institution}</p>
                </div>
              </div>

              {/* Category Selector */}
              <div>
                <label htmlFor="category" className="block text-sm text-secondary mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-positive"
                >
                  {SPENDING_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Similar Transactions */}
              {similar.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-secondary uppercase tracking-wide mb-2">
                    Similar Transactions ({similarCount} found)
                  </p>
                  <div className="bg-elevated border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                    {similar.map((tx) => (
                      <div key={tx.id} className="p-2 flex justify-between items-center text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-tertiary tabular-nums">
                            {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-secondary truncate">{tx.description.substring(0, 35)}...</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-medium tabular-nums text-negative">
                            {formatCurrency(tx.amount)}
                          </p>
                          <p className="text-xs text-tertiary">{tx.spending_category || 'uncategorized'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3 border-t border-border pt-4">
                {similarCount > 0 && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateSimilar}
                      onChange={(e) => setUpdateSimilar(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-elevated text-positive focus:ring-positive"
                    />
                    <span className="text-sm text-secondary">
                      Also recategorize {similarCount} similar transaction{similarCount !== 1 ? 's' : ''}
                    </span>
                  </label>
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberPattern}
                    onChange={(e) => setRememberPattern(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-elevated text-positive focus:ring-positive"
                  />
                  <span className="text-sm text-secondary">
                    Remember this for future transactions
                  </span>
                </label>
              </div>

              {/* Result Message */}
              {result && (
                <div
                  className={`p-3 rounded-lg ${
                    result.success
                      ? 'bg-positive/10 border border-positive/30 text-positive'
                      : 'bg-negative/10 border border-negative/30 text-negative'
                  }`}
                >
                  {result.message}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && transaction && (
          <div className="flex gap-3 p-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanged}
              className="flex-1 px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
