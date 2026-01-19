'use client';

import { useState, useEffect } from 'react';

type ZcashSource = {
  id: number;
  source_name: string;
  zec_amount: number;
  cost_basis_usd: number | null;
  last_updated: string;
};

type ZcashPrice = {
  price: number;
  change_24h: number | null;
  cached: boolean;
  timestamp: string;
};

type ZcashStrategy = {
  target_zec: number;
  goal_deadline: string;
};

export default function ZcashPage() {
  const [sources, setSources] = useState<ZcashSource[]>([]);
  const [price, setPrice] = useState<ZcashPrice | null>(null);
  const [strategy, setStrategy] = useState<ZcashStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editZec, setEditZec] = useState('');
  const [editCostBasis, setEditCostBasis] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [showNewSourceForm, setShowNewSourceForm] = useState(false);

  // Log Purchase form state
  const [showLogPurchaseForm, setShowLogPurchaseForm] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseAmountUsd, setPurchaseAmountUsd] = useState('');
  const [purchaseAmountZec, setPurchaseAmountZec] = useState('');
  const [purchaseSource, setPurchaseSource] = useState('Manual');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sourcesRes, priceRes, strategyRes] = await Promise.all([
        fetch('/api/zcash-sources').then((r) => r.json()),
        fetch('/api/zcash-price').then((r) => r.json()),
        fetch('/api/zcash-strategy').then((r) => r.json()),
      ]);

      setSources(sourcesRes.sources || []);
      setPrice(priceRes);
      setStrategy(strategyRes);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleEdit = (source: ZcashSource) => {
    setEditingId(source.id);
    setEditZec(source.zec_amount.toString());
    setEditCostBasis(source.cost_basis_usd ? source.cost_basis_usd.toString() : '');
    setMessage('');
  };

  const handleSave = async (sourceId: number) => {
    setMessage('');

    try {
      const response = await fetch('/api/zcash-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sourceId,
          zec_amount: parseFloat(editZec) || 0,
          cost_basis_usd: editCostBasis ? parseFloat(editCostBasis) : null,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setSources(sources.map((s) => (s.id === sourceId ? updated : s)));
        setEditingId(null);
        setMessage('Source updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error updating source');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error updating source');
    }
  };

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) {
      setMessage('Please enter a source name');
      return;
    }

    setMessage('');

    try {
      const response = await fetch('/api/zcash-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_name: newSourceName }),
      });

      if (response.ok) {
        const newSource = await response.json();
        setSources([...sources, newSource]);
        setNewSourceName('');
        setShowNewSourceForm(false);
        setMessage('Source created successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error creating source');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error creating source');
    }
  };

  const handleDeleteSource = async (sourceId: number, sourceName: string) => {
    if (!confirm(`Delete source "${sourceName}"? This will permanently remove this Zcash holding.`)) {
      return;
    }

    setMessage('');

    try {
      const response = await fetch(`/api/zcash-sources?id=${sourceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSources(sources.filter((s) => s.id !== sourceId));
        setMessage('Source deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error deleting source');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error deleting source');
    }
  };

  const handleLogPurchase = async () => {
    if (!purchaseAmountUsd || !purchaseAmountZec) {
      setMessage('Please enter both USD and ZEC amounts');
      return;
    }

    setMessage('');

    try {
      const priceAtPurchase = parseFloat(purchaseAmountUsd) / parseFloat(purchaseAmountZec);

      const response = await fetch('/api/zcash-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: purchaseDate,
          amount_usd: parseFloat(purchaseAmountUsd),
          amount_zec: parseFloat(purchaseAmountZec),
          price_at_purchase: priceAtPurchase,
          source: purchaseSource,
          notes: purchaseNotes || null,
        }),
      });

      if (response.ok) {
        setMessage('Purchase logged successfully!');
        setTimeout(() => setMessage(''), 3000);

        // Reset form
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        setPurchaseAmountUsd('');
        setPurchaseAmountZec('');
        setPurchaseSource('Manual');
        setPurchaseNotes('');
        setShowLogPurchaseForm(false);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Error logging purchase');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error logging purchase');
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Zcash Holdings</h1>
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  const totalZec = sources.reduce((sum, s) => sum + s.zec_amount, 0);
  const totalCostBasis = sources.reduce((sum, s) => sum + (s.cost_basis_usd || 0), 0);
  const totalValue = totalZec * (price?.price || 0);
  const totalGainLoss = totalCostBasis > 0 ? totalValue - totalCostBasis : null;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Zcash Holdings</h1>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes('successfully')
              ? 'bg-positive/10 border border-positive/20 text-positive'
              : 'bg-negative/10 border border-negative/20 text-negative'
          }`}
        >
          {message}
        </div>
      )}

      {/* Price Info */}
      {price && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-secondary uppercase tracking-wide">Current ZEC Price</p>
              <p className="text-3xl font-bold tabular-nums text-zcash">${price.price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              {price.change_24h !== null && (
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    price.change_24h >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {price.change_24h >= 0 ? '+' : ''}
                  {price.change_24h.toFixed(2)}% (24h)
                </p>
              )}
              <p className="text-xs text-tertiary mt-1">
                {price.cached ? 'Cached' : 'Live'} - {new Date(price.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Total Summary */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Total Holdings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-tertiary mb-1">Total ZEC</p>
            <p className="text-2xl font-bold tabular-nums">{totalZec.toFixed(8)}</p>
          </div>
          <div>
            <p className="text-sm text-tertiary mb-1">Total USD Value</p>
            <p className="text-2xl font-bold tabular-nums">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          {totalCostBasis > 0 && (
            <>
              <div>
                <p className="text-sm text-tertiary mb-1">Total Cost Basis</p>
                <p className="text-2xl font-bold tabular-nums">${totalCostBasis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-sm text-tertiary mb-1">Total Gain/Loss</p>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    totalGainLoss !== null && totalGainLoss >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {totalGainLoss !== null
                    ? `${totalGainLoss >= 0 ? '+' : ''}$${totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'N/A'}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Goal Progress */}
      {strategy && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm text-secondary uppercase tracking-wide">Goal Progress</h2>
            <button
              onClick={() => setShowLogPurchaseForm(!showLogPurchaseForm)}
              className="px-4 py-2 bg-positive text-base text-sm rounded-lg font-medium hover:opacity-90 transition"
            >
              Log Purchase
            </button>
          </div>

          {showLogPurchaseForm && (
            <div className="mb-6 p-4 bg-elevated border border-border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Log Zcash Purchase</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Source</label>
                  <input
                    type="text"
                    value={purchaseSource}
                    onChange={(e) => setPurchaseSource(e.target.value)}
                    placeholder="e.g., Coinbase, Gemini"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Amount (USD)</label>
                  <input
                    type="number"
                    value={purchaseAmountUsd}
                    onChange={(e) => setPurchaseAmountUsd(e.target.value)}
                    step="0.01"
                    placeholder="100.00"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Amount (ZEC)</label>
                  <input
                    type="number"
                    value={purchaseAmountZec}
                    onChange={(e) => setPurchaseAmountZec(e.target.value)}
                    step="0.00000001"
                    placeholder="1.23456789"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="Any notes about this purchase..."
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleLogPurchase}
                  className="px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition"
                >
                  Save Purchase
                </button>
                <button
                  onClick={() => {
                    setShowLogPurchaseForm(false);
                    setPurchaseDate(new Date().toISOString().split('T')[0]);
                    setPurchaseAmountUsd('');
                    setPurchaseAmountZec('');
                    setPurchaseSource('Manual');
                    setPurchaseNotes('');
                  }}
                  className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-lg font-semibold">
                  Goal: {strategy.target_zec} ZEC by {new Date(strategy.goal_deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex justify-between text-sm text-secondary mb-2">
                <span>Progress: {totalZec.toFixed(2)} ZEC / {strategy.target_zec} ZEC</span>
                <span className="tabular-nums">{((totalZec / strategy.target_zec) * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalZec >= strategy.target_zec
                      ? 'bg-positive'
                      : totalZec / strategy.target_zec >= 0.5
                      ? 'bg-zcash'
                      : 'bg-tertiary'
                  }`}
                  style={{
                    width: `${Math.min((totalZec / strategy.target_zec) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="pt-4 border-t border-border">
              <p className="text-secondary">
                {totalZec >= strategy.target_zec
                  ? 'Goal Complete!'
                  : totalZec / strategy.target_zec >= 0.8
                  ? `Almost there - Only ${(strategy.target_zec - totalZec).toFixed(2)} ZEC to go!`
                  : totalZec / strategy.target_zec >= 0.5
                  ? `On track - Keep building your position`
                  : `Need ${(strategy.target_zec - totalZec).toFixed(2)} ZEC to reach goal`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Sources */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm text-secondary uppercase tracking-wide">Sources</h2>
          <button
            onClick={() => setShowNewSourceForm(!showNewSourceForm)}
            className="px-4 py-2 bg-primary text-base text-sm rounded-lg font-medium hover:opacity-90 transition"
          >
            + Add Source
          </button>
        </div>

        {showNewSourceForm && (
          <div className="mb-6 p-4 bg-elevated border border-border rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Create New Source</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="Source name (e.g., Gemini, Kraken)"
                className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
              />
              <button
                onClick={handleCreateSource}
                className="px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewSourceForm(false);
                  setNewSourceName('');
                }}
                className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {sources.map((source) => {
            const value = source.zec_amount * (price?.price || 0);
            const gainLoss =
              source.cost_basis_usd && source.cost_basis_usd > 0
                ? value - source.cost_basis_usd
                : null;

            return (
              <div
                key={source.id}
                className="p-4 bg-elevated border border-border rounded-lg"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold">{source.source_name}</h3>
                  {editingId !== source.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(source)}
                        className="px-3 py-1 bg-surface border border-border text-secondary text-sm rounded-lg hover:text-primary transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSource(source.id, source.source_name)}
                        className="px-3 py-1 bg-negative/10 border border-negative/20 text-negative text-sm rounded-lg hover:bg-negative/20 transition"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {editingId === source.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-secondary mb-1">ZEC Amount</label>
                      <input
                        type="number"
                        value={editZec}
                        onChange={(e) => setEditZec(e.target.value)}
                        step="0.00000001"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-secondary mb-1">
                        Cost Basis (USD) - Optional
                      </label>
                      <input
                        type="number"
                        value={editCostBasis}
                        onChange={(e) => setEditCostBasis(e.target.value)}
                        step="0.01"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                        placeholder="Leave empty if unknown"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSave(source.id)}
                        className="px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-tertiary mb-1">ZEC Amount</p>
                      <p className="font-semibold tabular-nums">{source.zec_amount.toFixed(8)} ZEC</p>
                    </div>
                    <div>
                      <p className="text-sm text-tertiary mb-1">USD Value</p>
                      <p className="font-semibold tabular-nums">
                        ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-tertiary mb-1">
                        {gainLoss !== null ? 'Gain/Loss' : 'Cost Basis'}
                      </p>
                      {gainLoss !== null ? (
                        <p
                          className={`font-semibold tabular-nums ${
                            gainLoss >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {gainLoss >= 0 ? '+' : ''}$
                          {gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      ) : (
                        <p className="font-semibold text-tertiary">Not set</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
