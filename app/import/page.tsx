'use client';

import { useState, useEffect } from 'react';

type ImportResult = {
  success: boolean;
  transactionCount: number;
  balance?: number;
  warnings: string[];
  accountId: number;
  dateRange?: {
    start: string;
    end: string;
  };
  balanceDetected: boolean;
  accountCreated?: {
    name: string;
    institution: string;
    type: string;
  };
};

type SavingsGoal = {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
};

export default function ImportStatements() {
  const [institution, setInstitution] = useState('');
  const [accountType, setAccountType] = useState('');
  const [goalId, setGoalId] = useState('');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  // Baseline balance modal state
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [baselineBalance, setBaselineBalance] = useState('');
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineSaved, setBaselineSaved] = useState(false);

  // Fetch savings goals
  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const data = await response.json();
      setGoals(data);
    } catch (err) {
      console.error('Error fetching goals:', err);
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoalName || !newGoalTarget) {
      setError('Please enter both goal name and target amount');
      return;
    }

    setCreatingGoal(true);
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGoalName,
          target_amount: parseFloat(newGoalTarget),
        }),
      });

      if (response.ok) {
        const newGoal = await response.json();
        setGoals([...goals, newGoal]);
        setGoalId(newGoal.id.toString());
        setShowNewGoalForm(false);
        setNewGoalName('');
        setNewGoalTarget('');
        setError('');
      } else {
        setError('Failed to create goal');
      }
    } catch (err) {
      console.error('Error creating goal:', err);
      setError('Error creating goal');
    } finally {
      setCreatingGoal(false);
    }
  };

  const showGoalDropdown = institution === 'Ally' && accountType === 'savings';

  const handleSaveBaseline = async () => {
    if (!result || !baselineBalance) return;

    const balance = parseFloat(baselineBalance.replace(/[,$]/g, ''));
    if (isNaN(balance) || balance < 0) {
      setError('Please enter a valid balance');
      return;
    }

    setSavingBaseline(true);
    try {
      const response = await fetch(`/api/accounts/${result.accountId}/baseline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance,
          date: result.dateRange?.end || new Date().toISOString().split('T')[0],
        }),
      });

      if (response.ok) {
        setBaselineSaved(true);
        setShowBaselineModal(false);
        setBaselineBalance('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save baseline');
      }
    } catch (err) {
      console.error('Error saving baseline:', err);
      setError('Error saving baseline balance');
    } finally {
      setSavingBaseline(false);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!institution || !accountType || !file) {
      setError('Please fill in all fields and select a file.');
      return;
    }

    if (showGoalDropdown && !goalId) {
      setError('Please select a savings goal for Ally savings accounts.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('institution', institution);
      formData.append('accountType', accountType);
      if (goalId) {
        formData.append('goalId', goalId);
      }

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setFile(null);
        setBaselineSaved(false);
        // Reset file input
        const fileInput = document.getElementById('file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // Show baseline modal for checking accounts without detected balance
        if (accountType === 'checking' && !data.balanceDetected && data.dateRange) {
          setShowBaselineModal(true);
        }
      } else {
        setError(data.error || 'Failed to import statement');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError('An error occurred while importing the statement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold">Import Statements</h1>

      <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="institution" className="block text-sm text-secondary mb-2">
              Financial Institution
            </label>
            <select
              id="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
              required
            >
              <option value="">Select institution...</option>
              <option value="Ally">Ally</option>
              <option value="Chase">Chase</option>
              <option value="Gemini">Gemini</option>
              <option value="WellsFargo">Wells Fargo</option>
              <option value="Bilt">Bilt</option>
            </select>
          </div>

          <div>
            <label htmlFor="accountType" className="block text-sm text-secondary mb-2">
              Account Type
            </label>
            <select
              id="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
              required
            >
              <option value="">Select account type...</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>

          {showGoalDropdown && (
            <div>
              <label htmlFor="goalId" className="block text-sm text-secondary mb-2">
                Savings Goal
              </label>
              <select
                id="goalId"
                value={goalId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'new') {
                    setShowNewGoalForm(true);
                    setGoalId('');
                  } else {
                    setGoalId(value);
                    setShowNewGoalForm(false);
                  }
                }}
                className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                required
              >
                <option value="">Select savings goal...</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} (${goal.target_amount.toLocaleString()})
                  </option>
                ))}
                <option value="new">+ Create New Goal</option>
              </select>

              {showNewGoalForm && (
                <div className="mt-4 p-4 bg-elevated border border-border rounded-lg space-y-3">
                  <div>
                    <label htmlFor="newGoalName" className="block text-sm text-secondary mb-1">
                      Goal Name
                    </label>
                    <input
                      type="text"
                      id="newGoalName"
                      value={newGoalName}
                      onChange={(e) => setNewGoalName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                      placeholder="e.g., Vacation"
                    />
                  </div>
                  <div>
                    <label htmlFor="newGoalTarget" className="block text-sm text-secondary mb-1">
                      Target Amount ($)
                    </label>
                    <input
                      type="number"
                      id="newGoalTarget"
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                      placeholder="50000"
                      step="0.01"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateGoal}
                      disabled={creatingGoal}
                      className="px-4 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                    >
                      {creatingGoal ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewGoalForm(false);
                        setNewGoalName('');
                        setNewGoalTarget('');
                      }}
                      className="px-4 py-2 bg-surface border border-border text-secondary rounded-lg hover:text-primary transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="file" className="block text-sm text-secondary mb-2">
              Statement File (PDF or CSV)
            </label>
            <input
              type="file"
              id="file"
              accept=".pdf,.csv"
              onChange={handleFileChange}
              className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface file:text-secondary hover:file:bg-border"
              required
            />
            {file && (
              <p className="text-sm text-secondary mt-2">
                Selected: {file.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing...' : 'Import Statement'}
          </button>

          {error && (
            <div className="p-4 bg-negative/10 border border-negative/20 rounded-lg">
              <p className="text-negative">{error}</p>
            </div>
          )}
        </form>
      </section>

      {result && (
        <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold mb-4 text-positive">
            Import Successful!
          </h2>

          <div className="space-y-3">
            {result.accountCreated && (
              <div className="p-3 bg-elevated border border-border rounded-lg">
                <p className="font-medium text-sm md:text-base">Account Created:</p>
                <p className="text-sm text-secondary">
                  {result.accountCreated.institution} - {result.accountCreated.type}
                </p>
              </div>
            )}

            <div className="p-3 bg-elevated border border-border rounded-lg">
              <p className="font-medium text-sm md:text-base">Transactions Found:</p>
              <p className="text-xl md:text-2xl font-bold tabular-nums">{result.transactionCount}</p>
            </div>

            {result.dateRange && (
              <div className="p-3 bg-elevated border border-border rounded-lg">
                <p className="font-medium text-sm md:text-base">Statement Period:</p>
                <p className="text-secondary">{formatDateRange(result.dateRange.start, result.dateRange.end)}</p>
              </div>
            )}

            {result.balance !== undefined && result.balanceDetected && (
              <div className="p-3 bg-elevated border border-border rounded-lg">
                <p className="font-medium text-sm md:text-base">Statement Balance Detected:</p>
                <p className="text-xl md:text-2xl font-bold tabular-nums">
                  ${result.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {baselineSaved && (
              <div className="p-3 bg-positive/10 border border-positive/20 rounded-lg">
                <p className="text-positive font-medium">Baseline balance saved successfully!</p>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="p-3 bg-zcash/10 border border-zcash/20 rounded-lg">
                <p className="font-medium text-zcash mb-2 text-sm md:text-base">
                  Warnings:
                </p>
                <ul className="list-disc list-inside text-sm text-secondary space-y-1">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Baseline Balance Modal */}
      {showBaselineModal && result && result.dateRange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Import Complete: {result.transactionCount} transactions</h3>

            <p className="text-secondary mb-4">
              Statement period: {formatDateRange(result.dateRange.start, result.dateRange.end)}
            </p>

            <div className="mb-4">
              <label htmlFor="baselineBalance" className="block text-sm text-secondary mb-2">
                What is the ending balance shown on this statement?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">$</span>
                <input
                  type="text"
                  id="baselineBalance"
                  value={baselineBalance}
                  onChange={(e) => setBaselineBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  autoFocus
                />
              </div>
              <p className="text-xs text-secondary mt-2">
                This sets the baseline for accurate balance tracking.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowBaselineModal(false);
                  setBaselineBalance('');
                }}
                className="px-4 py-2 text-secondary hover:text-primary transition"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSaveBaseline}
                disabled={savingBaseline || !baselineBalance}
                className="px-4 py-2 bg-primary text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingBaseline ? 'Saving...' : 'Save Balance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
