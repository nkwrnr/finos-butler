'use client';

import { useState, useEffect } from 'react';

type SavingsGoal = {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
};

type Account = {
  id: number;
  name: string;
  institution: string;
  type: string;
  balance: number;
  goal_id: number | null;
  goal_name: string | null;
  last_updated: string;
};

type ZcashStrategy = {
  id: number;
  target_zec: number;
  goal_deadline: string;
  max_daily_purchase: number;
  safety_buffer: number;
  discretionary_allocation: number;
};

type DataHealth = {
  categoryBreakdown: Array<{ category: string; count: number; total: number }>;
  qualityChecks: {
    duplicates: { count: number; status: 'pass' | 'fail' };
    uncategorized: { count: number; status: 'pass' | 'warn' };
    incomePattern: { avgPaychecksPerMonth: number; status: 'pass' | 'warn'; message: string };
  };
  importHealth: Array<{
    month: string;
    transaction_count: number;
    income_total: number;
    income_count: number;
    expense_total: number;
    expense_count: number;
    flags: string[];
    status: 'complete' | 'warning' | 'incomplete';
  }>;
  overview: {
    totalTransactions: number;
    dateRange: { first: string; last: string };
  };
};

export default function Settings() {
  const [loading, setLoading] = useState(true);

  // Goals management
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [goalMessage, setGoalMessage] = useState('');

  // Accounts management
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMessage, setAccountMessage] = useState('');

  // Zcash Strategy management
  const [zcashStrategy, setZcashStrategy] = useState<ZcashStrategy | null>(null);
  const [strategyMessage, setStrategyMessage] = useState('');
  const [targetZec, setTargetZec] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [maxDailyPurchase, setMaxDailyPurchase] = useState('');
  const [safetyBuffer, setSafetyBuffer] = useState('');
  const [discretionaryAllocation, setDiscretionaryAllocation] = useState('');

  // Data Health management
  const [dataHealth, setDataHealth] = useState<DataHealth | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load goals, accounts, strategy, and data health
  useEffect(() => {
    Promise.all([
      fetch('/api/goals').then((res) => res.json()),
      fetch('/api/accounts').then((res) => res.json()),
      fetch('/api/zcash-strategy').then((res) => res.json()),
      fetch('/api/data-health').then((res) => res.json()),
    ])
      .then(([goalsData, accountsData, strategyData, healthData]) => {
        setGoals(goalsData);
        setAccounts(accountsData);
        setZcashStrategy(strategyData);
        setDataHealth(healthData);

        // Initialize strategy form fields
        setTargetZec(strategyData.target_zec.toString());
        setGoalDeadline(strategyData.goal_deadline);
        setMaxDailyPurchase(strategyData.max_daily_purchase.toString());
        setSafetyBuffer(strategyData.safety_buffer.toString());
        setDiscretionaryAllocation((strategyData.discretionary_allocation * 100).toString());

        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading data:', error);
        setLoading(false);
      });
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalMessage('');

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
        setNewGoalName('');
        setNewGoalTarget('');
        setGoalMessage('Goal created successfully!');
      } else {
        setGoalMessage('Error creating goal');
      }
    } catch (error) {
      console.error('Error:', error);
      setGoalMessage('Error creating goal');
    }
  };

  const handleEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal.id);
    setEditName(goal.name);
    setEditTarget(goal.target_amount.toString());
    setGoalMessage('');
  };

  const handleUpdateGoal = async (goalId: number) => {
    setGoalMessage('');

    try {
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goalId,
          name: editName,
          target_amount: parseFloat(editTarget),
        }),
      });

      if (response.ok) {
        const updatedGoal = await response.json();
        setGoals(goals.map((g) => (g.id === goalId ? updatedGoal : g)));
        setEditingGoal(null);
        setGoalMessage('Goal updated successfully!');
      } else {
        setGoalMessage('Error updating goal');
      }
    } catch (error) {
      console.error('Error:', error);
      setGoalMessage('Error updating goal');
    }
  };

  const handleDeleteGoal = async (goalId: number, goalName: string) => {
    if (!confirm(`Are you sure you want to delete "${goalName}"? This will unlink any associated accounts.`)) {
      return;
    }

    setGoalMessage('');

    try {
      const response = await fetch(`/api/goals?id=${goalId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setGoals(goals.filter((g) => g.id !== goalId));
        setGoalMessage('Goal deleted successfully!');
      } else {
        setGoalMessage('Error deleting goal');
      }
    } catch (error) {
      console.error('Error:', error);
      setGoalMessage('Error deleting goal');
    }
  };

  const handleAccountGoalChange = async (accountId: number, newGoalId: number | null) => {
    setAccountMessage('');

    try {
      const response = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          goal_id: newGoalId,
        }),
      });

      if (response.ok) {
        const updatedAccount = await response.json();
        setAccounts(accounts.map((a) => (a.id === accountId ? updatedAccount : a)));
        setAccountMessage('Account goal assignment updated successfully!');
      } else {
        setAccountMessage('Error updating account goal assignment');
      }
    } catch (error) {
      console.error('Error:', error);
      setAccountMessage('Error updating account goal assignment');
    }
  };

  const handleUpdateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setStrategyMessage('');

    try {
      const response = await fetch('/api/zcash-strategy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_zec: parseFloat(targetZec),
          goal_deadline: goalDeadline,
          max_daily_purchase: parseFloat(maxDailyPurchase),
          safety_buffer: parseFloat(safetyBuffer),
          discretionary_allocation: parseFloat(discretionaryAllocation) / 100,
        }),
      });

      if (response.ok) {
        const updatedStrategy = await response.json();
        setZcashStrategy(updatedStrategy);
        setStrategyMessage('Zcash strategy updated successfully!');
      } else {
        const errorData = await response.json();
        setStrategyMessage(errorData.error || 'Error updating strategy');
      }
    } catch (error) {
      console.error('Error:', error);
      setStrategyMessage('Error updating strategy');
    }
  };

  const handleRefreshHealth = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/data-health');
      const healthData = await response.json();
      setDataHealth(healthData);
    } catch (error) {
      console.error('Error refreshing data health:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>

      {/* Manage Goals Section */}
      <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4 md:mb-6">Manage Savings Goals</h2>

        {goalMessage && (
          <p
            className={`text-sm mb-4 ${
              goalMessage.includes('successfully') ? 'text-positive' : 'text-negative'
            }`}
          >
            {goalMessage}
          </p>
        )}

        {/* Existing Goals */}
        <div className="space-y-3 mb-6">
          {goals.length === 0 ? (
            <p className="text-secondary">
              No goals yet. Create one below or during import.
            </p>
          ) : (
            goals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 bg-elevated border border-border rounded-lg"
              >
                {editingGoal === goal.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-secondary mb-1">Goal Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-secondary mb-1">
                        Target Amount ($)
                      </label>
                      <input
                        type="number"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                        step="0.01"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleUpdateGoal(goal.id)}
                        className="px-4 py-2 bg-primary text-base rounded-lg font-medium hover:opacity-90 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingGoal(null)}
                        className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                    <div>
                      <h3 className="font-medium">{goal.name}</h3>
                      <p className="text-sm text-secondary">
                        Target: ${goal.target_amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditGoal(goal)}
                        className="px-3 py-1.5 bg-surface border border-border text-secondary text-sm rounded-lg hover:text-primary transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id, goal.name)}
                        className="px-3 py-1.5 bg-negative/10 border border-negative/20 text-negative text-sm rounded-lg hover:bg-negative/20 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create New Goal */}
        <div className="border-t border-border pt-6">
          <h3 className="text-lg font-semibold mb-4">Create New Goal</h3>
          <form onSubmit={handleCreateGoal} className="space-y-4">
            <div>
              <label htmlFor="newGoalName" className="block text-sm text-secondary mb-1">
                Goal Name
              </label>
              <input
                type="text"
                id="newGoalName"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                placeholder="e.g., Vacation"
                required
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
                className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                placeholder="50000"
                step="0.01"
                required
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition"
            >
              Create Goal
            </button>
          </form>
        </div>
      </section>

      {/* Manage Accounts Section */}
      <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4 md:mb-6">Manage Accounts</h2>

        {accountMessage && (
          <p
            className={`text-sm mb-4 ${
              accountMessage.includes('successfully') ? 'text-positive' : 'text-negative'
            }`}
          >
            {accountMessage}
          </p>
        )}

        {accounts.length === 0 ? (
          <p className="text-secondary">
            No accounts found. Import a statement to create accounts.
          </p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="p-4 bg-elevated border border-border rounded-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium">{account.name}</h3>
                    <p className="text-sm text-secondary">
                      {account.institution} • {account.type}
                    </p>
                    <p className="text-sm font-semibold tabular-nums mt-1">
                      Balance: ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor={`account-goal-${account.id}`} className="text-sm text-secondary">
                    Assigned Goal:
                  </label>
                  <select
                    id={`account-goal-${account.id}`}
                    value={account.goal_id || ''}
                    onChange={(e) => {
                      const newGoalId = e.target.value ? parseInt(e.target.value) : null;
                      handleAccountGoalChange(account.id, newGoalId);
                    }}
                    className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  >
                    <option value="">None</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                </div>

                {account.goal_name && (
                  <p className="text-xs text-tertiary mt-2">
                    Currently linked to: {account.goal_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zcash Strategy Section */}
      <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4 md:mb-6">Zcash Strategy</h2>

        {strategyMessage && (
          <p
            className={`text-sm mb-4 ${
              strategyMessage.includes('successfully') ? 'text-positive' : 'text-negative'
            }`}
          >
            {strategyMessage}
          </p>
        )}

        {zcashStrategy && (
          <form onSubmit={handleUpdateStrategy} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="targetZec" className="block text-sm text-secondary mb-1">
                  Target ZEC
                </label>
                <input
                  type="number"
                  id="targetZec"
                  value={targetZec}
                  onChange={(e) => setTargetZec(e.target.value)}
                  className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  step="0.01"
                  min="0.01"
                  required
                />
                <p className="text-xs text-tertiary mt-1">
                  Your total Zcash accumulation goal
                </p>
              </div>

              <div>
                <label htmlFor="goalDeadline" className="block text-sm text-secondary mb-1">
                  Goal Deadline
                </label>
                <input
                  type="date"
                  id="goalDeadline"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  required
                />
                <p className="text-xs text-tertiary mt-1">
                  Target date to reach your goal
                </p>
              </div>

              <div>
                <label htmlFor="maxDailyPurchase" className="block text-sm text-secondary mb-1">
                  Max Daily Purchase ($)
                </label>
                <input
                  type="number"
                  id="maxDailyPurchase"
                  value={maxDailyPurchase}
                  onChange={(e) => setMaxDailyPurchase(e.target.value)}
                  className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  step="0.01"
                  min="0.01"
                  required
                />
                <p className="text-xs text-tertiary mt-1">
                  Hard limit on single-day purchases
                </p>
              </div>

              <div>
                <label htmlFor="safetyBuffer" className="block text-sm text-secondary mb-1">
                  Checking Safety Buffer ($)
                </label>
                <input
                  type="number"
                  id="safetyBuffer"
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(e.target.value)}
                  className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  step="0.01"
                  min="0"
                  required
                />
                <p className="text-xs text-tertiary mt-1">
                  Minimum checking account balance to maintain
                </p>
              </div>

              <div>
                <label htmlFor="discretionaryAllocation" className="block text-sm text-secondary mb-1">
                  Discretionary Allocation (%)
                </label>
                <input
                  type="number"
                  id="discretionaryAllocation"
                  value={discretionaryAllocation}
                  onChange={(e) => setDiscretionaryAllocation(e.target.value)}
                  className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  step="1"
                  min="0"
                  max="100"
                  required
                />
                <p className="text-xs text-tertiary mt-1">
                  % of discretionary income allocated to Zcash
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-base rounded-lg font-medium hover:opacity-90 transition"
              >
                Update Strategy
              </button>
            </div>

            {/* Current Settings Summary */}
            <div className="mt-6 p-3 md:p-4 bg-elevated border border-border rounded-lg">
              <h3 className="text-sm text-secondary uppercase tracking-wide mb-3">Current Strategy Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 text-sm">
                <div>
                  <span className="text-tertiary">Target:</span>
                  <span className="ml-2 font-medium tabular-nums">{zcashStrategy.target_zec} ZEC</span>
                </div>
                <div>
                  <span className="text-tertiary">Deadline:</span>
                  <span className="ml-2 font-medium">{zcashStrategy.goal_deadline}</span>
                </div>
                <div>
                  <span className="text-tertiary">Max Daily:</span>
                  <span className="ml-2 font-medium tabular-nums">${zcashStrategy.max_daily_purchase.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-tertiary">Safety Buffer:</span>
                  <span className="ml-2 font-medium tabular-nums">${zcashStrategy.safety_buffer.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-tertiary">Allocation:</span>
                  <span className="ml-2 font-medium tabular-nums">
                    {(zcashStrategy.discretionary_allocation * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Data Health Section */}
      <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 md:mb-6">
          <h2 className="text-sm text-secondary uppercase tracking-wide">Data Health</h2>
          <button
            onClick={handleRefreshHealth}
            disabled={refreshing}
            className="px-4 py-2 bg-elevated border border-border text-secondary text-sm rounded-lg hover:text-primary hover:border-primary transition disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>

        {dataHealth ? (
          <div className="space-y-6">
            {/* Overview */}
            <div className="p-3 md:p-4 bg-elevated border border-border rounded-lg">
              <h3 className="text-sm font-semibold text-secondary mb-3">Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-sm">
                <div>
                  <span className="text-tertiary">Total Transactions:</span>
                  <span className="ml-2 font-semibold tabular-nums">{dataHealth.overview.totalTransactions}</span>
                </div>
                <div>
                  <span className="text-tertiary">First Transaction:</span>
                  <span className="ml-2 font-medium">{dataHealth.overview.dateRange.first}</span>
                </div>
                <div>
                  <span className="text-tertiary">Last Transaction:</span>
                  <span className="ml-2 font-medium">{dataHealth.overview.dateRange.last}</span>
                </div>
              </div>
            </div>

            {/* Quality Checks */}
            <div className="p-3 md:p-4 bg-elevated border border-border rounded-lg">
              <h3 className="text-sm font-semibold text-secondary mb-3">Data Quality Checks</h3>
              <div className="space-y-3 md:space-y-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-sm">Duplicates:</span>
                  <span className={`text-sm font-medium ${
                    dataHealth.qualityChecks.duplicates.status === 'pass' ? 'text-positive' : 'text-negative'
                  }`}>
                    {dataHealth.qualityChecks.duplicates.status === 'pass' ? '✅' : '❌'} {dataHealth.qualityChecks.duplicates.count} found
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-sm">Uncategorized:</span>
                  <span className={`text-sm font-medium ${
                    dataHealth.qualityChecks.uncategorized.status === 'pass' ? 'text-positive' : 'text-zcash'
                  }`}>
                    {dataHealth.qualityChecks.uncategorized.status === 'pass' ? '✅' : '⚠️'} {dataHealth.qualityChecks.uncategorized.count} transactions
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-sm">Income Pattern:</span>
                  <span className={`text-sm font-medium ${
                    dataHealth.qualityChecks.incomePattern.status === 'pass' ? 'text-positive' : 'text-zcash'
                  }`}>
                    {dataHealth.qualityChecks.incomePattern.status === 'pass' ? '✅' : '⚠️'} {dataHealth.qualityChecks.incomePattern.message}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="p-3 md:p-4 bg-elevated border border-border rounded-lg">
              <h3 className="text-sm font-semibold text-secondary mb-3">Category Breakdown</h3>
              <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                <table className="w-full text-xs md:text-sm min-w-[300px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-secondary font-medium">Category</th>
                      <th className="text-right py-2 text-secondary font-medium">Count</th>
                      <th className="text-right py-2 text-secondary font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataHealth.categoryBreakdown.map((cat) => (
                      <tr key={cat.category} className="border-b border-border">
                        <td className="py-2">{cat.category}</td>
                        <td className="text-right tabular-nums">{cat.count}</td>
                        <td className="text-right tabular-nums">${cat.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import Health */}
            <div className="p-3 md:p-4 bg-elevated border border-border rounded-lg">
              <h3 className="text-sm font-semibold text-secondary mb-3">Import Health by Month</h3>
              <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                <table className="w-full text-xs md:text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-secondary font-medium">Month</th>
                      <th className="text-right py-2 text-secondary font-medium">Txns</th>
                      <th className="text-right py-2 text-secondary font-medium">Income</th>
                      <th className="text-right py-2 text-secondary font-medium">Expenses</th>
                      <th className="text-right py-2 text-secondary font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataHealth.importHealth.map((month) => (
                      <tr key={month.month} className="border-b border-border">
                        <td className="py-2">{month.month}</td>
                        <td className="text-right tabular-nums">{month.transaction_count}</td>
                        <td className="text-right tabular-nums">${month.income_total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="text-right tabular-nums">${month.expense_total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="text-right">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                            month.status === 'complete' ? 'text-positive' :
                            month.status === 'warning' ? 'text-zcash' : 'text-negative'
                          }`}>
                            {month.status === 'complete' ? '✅ Complete' :
                             month.status === 'warning' ? '⚠️ Warning' : '❌ Incomplete'}
                          </span>
                          {month.flags.length > 0 && (
                            <div className="text-xs text-tertiary mt-1">
                              {month.flags.join(', ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-secondary">Loading data health...</p>
        )}
      </section>
    </div>
  );
}
