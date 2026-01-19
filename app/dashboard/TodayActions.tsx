'use client';

import { useState } from 'react';

interface TodayActionsProps {
  actions: {
    zcash: {
      action: 'buy' | 'skip' | 'wait';
      amount: number;
      reason: string;
    };
    houseSavings: {
      action: 'transfer' | 'none';
      amount: number;
      reason: string;
    };
    lifeSavings: {
      action: 'transfer' | 'none';
      amount: number;
      reason: string;
    };
    other: string[];
  };
  onPurchaseLogged?: () => void;
}

export default function TodayActions({ actions, onPurchaseLogged }: TodayActionsProps) {
  const [showModal, setShowModal] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logResult, setLogResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [amountUsd, setAmountUsd] = useState(actions.zcash.amount.toString());
  const [amountZec, setAmountZec] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState('Coinbase');

  const hasZcashAction = actions.zcash.action === 'buy' && actions.zcash.amount > 0;
  const hasHouseAction = actions.houseSavings.action === 'transfer' && actions.houseSavings.amount > 0;
  const hasLifeAction = actions.lifeSavings.action === 'transfer' && actions.lifeSavings.amount > 0;
  const hasOtherActions = actions.other.length > 0;

  const noActions = !hasZcashAction && !hasHouseAction && !hasLifeAction && !hasOtherActions;

  const handleOpenModal = () => {
    setAmountUsd(actions.zcash.amount.toString());
    setAmountZec('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSource('Coinbase');
    setLogResult(null);
    setShowModal(true);
  };

  const handleLogPurchase = async () => {
    setLogging(true);
    setLogResult(null);

    try {
      const response = await fetch('/api/zcash/log-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: parseFloat(amountUsd),
          amountZec: amountZec ? parseFloat(amountZec) : undefined,
          date: purchaseDate,
          source,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLogResult({ success: true, message: data.message });
        // Close modal after short delay and refresh
        setTimeout(() => {
          setShowModal(false);
          onPurchaseLogged?.();
        }, 1500);
      } else {
        setLogResult({ success: false, message: data.error || 'Failed to log purchase' });
      }
    } catch (error) {
      setLogResult({ success: false, message: 'Network error' });
    } finally {
      setLogging(false);
    }
  };

  return (
    <>
      <section className="bg-surface border-2 border-positive/50 rounded-xl p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Today&apos;s Actions</h2>

        {noActions ? (
          <div className="p-4 bg-elevated border border-border rounded-lg">
            <p className="text-positive font-medium">All caught up!</p>
            <p className="text-secondary text-sm mt-1">No actions needed today. You&apos;re on track with all goals.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Zcash Action */}
            {hasZcashAction && (
              <div className="p-4 bg-positive/10 border border-positive/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-secondary">Zcash Purchase</span>
                    <p className="text-2xl font-bold text-positive tabular-nums">
                      ${actions.zcash.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenModal}
                      className="px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition"
                    >
                      Log Purchase
                    </button>
                  </div>
                </div>
                <p className="text-sm text-secondary mt-2">{actions.zcash.reason}</p>
              </div>
            )}

            {/* Zcash Wait/Skip */}
            {!hasZcashAction && actions.zcash.action !== 'buy' && (
              <div className="p-4 bg-elevated border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-secondary">Zcash Purchase</span>
                    <p className="text-lg font-medium text-tertiary">
                      {actions.zcash.action === 'wait' ? 'Wait' : 'Skip today'}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-surface text-secondary text-sm font-medium rounded-full border border-border">
                    {actions.zcash.action === 'wait' ? 'Wait' : 'Skip'}
                  </span>
                </div>
                <p className="text-sm text-tertiary mt-2">{actions.zcash.reason}</p>
              </div>
            )}

            {/* House Savings Action */}
            {hasHouseAction && (
              <div className="p-4 bg-zcash/10 border border-zcash/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-secondary">House Savings</span>
                    <p className="text-2xl font-bold text-zcash tabular-nums">
                      ${actions.houseSavings.amount.toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-zcash/20 text-zcash text-sm font-medium rounded-full">
                    Transfer
                  </span>
                </div>
                <p className="text-sm text-secondary mt-2">{actions.houseSavings.reason}</p>
              </div>
            )}

            {/* Life Savings Action */}
            {hasLifeAction && (
              <div className="p-4 bg-zcash/10 border border-zcash/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-secondary">Life Savings</span>
                    <p className="text-2xl font-bold text-zcash tabular-nums">
                      ${actions.lifeSavings.amount.toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-zcash/20 text-zcash text-sm font-medium rounded-full">
                    Transfer
                  </span>
                </div>
                <p className="text-sm text-secondary mt-2">{actions.lifeSavings.reason}</p>
              </div>
            )}

            {/* Other Actions */}
            {hasOtherActions && (
              <div className="p-4 bg-elevated border border-border rounded-lg">
                <span className="text-sm text-secondary">Also consider:</span>
                <ul className="mt-2 space-y-1">
                  {actions.other.map((item, idx) => (
                    <li key={idx} className="text-sm text-primary flex items-start gap-2">
                      <span className="text-tertiary">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Log Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Log Zcash Purchase</h3>

            <div className="space-y-4">
              {/* Amount USD */}
              <div>
                <label htmlFor="amountUsd" className="block text-sm text-secondary mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  id="amountUsd"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-positive"
                  placeholder="300"
                  step="0.01"
                />
              </div>

              {/* Date */}
              <div>
                <label htmlFor="purchaseDate" className="block text-sm text-secondary mb-1">
                  Date
                </label>
                <input
                  type="date"
                  id="purchaseDate"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-positive"
                />
              </div>

              {/* Source */}
              <div>
                <label htmlFor="source" className="block text-sm text-secondary mb-1">
                  Source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-positive"
                >
                  <option value="Coinbase">Coinbase</option>
                  <option value="Gemini">Gemini</option>
                  <option value="Wallet">Wallet</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Amount ZEC (optional) */}
              <div>
                <label htmlFor="amountZec" className="block text-sm text-secondary mb-1">
                  ZEC Received <span className="text-tertiary">(optional)</span>
                </label>
                <input
                  type="number"
                  id="amountZec"
                  value={amountZec}
                  onChange={(e) => setAmountZec(e.target.value)}
                  className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-positive"
                  placeholder="Auto-calculated from current price"
                  step="0.0001"
                />
                <p className="text-xs text-tertiary mt-1">
                  Leave blank to auto-calculate based on current price
                </p>
              </div>

              {/* Result message */}
              {logResult && (
                <div
                  className={`p-3 rounded-lg ${
                    logResult.success
                      ? 'bg-positive/10 border border-positive/30 text-positive'
                      : 'bg-negative/10 border border-negative/30 text-negative'
                  }`}
                >
                  {logResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleLogPurchase}
                  disabled={logging || !amountUsd || parseFloat(amountUsd) <= 0}
                  className="flex-1 px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {logging ? 'Logging...' : 'Log Purchase'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={logging}
                  className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
