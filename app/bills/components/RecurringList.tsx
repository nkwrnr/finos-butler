import { useState } from 'react';
import ExpenseCard from './ExpenseCard';

interface RecurringListProps {
  expenses: any[];
  summary: any;
  onToggleTracked: (id: number, currentTracked: number) => void;
}

export default function RecurringList({ expenses, summary, onToggleTracked }: RecurringListProps) {
  const [filter, setFilter] = useState<'all' | 'tracked' | 'untracked'>('all');

  // Filter expenses based on selected filter
  const filteredExpenses = expenses.filter((expense) => {
    if (filter === 'tracked') return expense.tracked !== 0;
    if (filter === 'untracked') return expense.tracked === 0;
    return true;
  });

  // Group expenses by type and priority
  const subscriptions = filteredExpenses.filter((e) => e.expense_type === 'subscription');
  const utilities = filteredExpenses.filter((e) => e.priority === 'essential' && e.expense_type !== 'subscription');
  const seasonal = filteredExpenses.filter((e) => e.expense_type === 'seasonal');
  const variable = filteredExpenses.filter(
    (e) => e.expense_type === 'variable_recurring' && e.priority === 'important' && !utilities.includes(e)
  );
  const other = filteredExpenses.filter(
    (e) => !subscriptions.includes(e) && !utilities.includes(e) && !seasonal.includes(e) && !variable.includes(e)
  );

  // Calculate monthly totals
  const calculateMonthlyTotal = (items: any[]) => {
    return items.reduce((sum, item) => {
      if (item.frequency_days >= 25 && item.frequency_days <= 35) {
        return sum + item.typical_amount;
      } else if (item.frequency_days > 35 && item.frequency_days < 100) {
        // Seasonal/quarterly - estimate monthly
        return sum + item.typical_amount / (item.frequency_days / 30);
      }
      return sum;
    }, 0);
  };

  const subscriptionTotal = calculateMonthlyTotal(subscriptions);
  const utilitiesTotal = calculateMonthlyTotal(utilities);

  return (
    <div className="space-y-6">
      {/* Header with filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h2 className="text-lg md:text-xl font-semibold">All Recurring Expenses</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base transition ${
              filter === 'all' ? 'bg-primary text-white' : 'bg-surface border border-border hover:bg-surface-hover'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('tracked')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base transition ${
              filter === 'tracked' ? 'bg-primary text-white' : 'bg-surface border border-border hover:bg-surface-hover'
            }`}
          >
            Tracked
          </button>
          <button
            onClick={() => setFilter('untracked')}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base transition ${
              filter === 'untracked'
                ? 'bg-primary text-white'
                : 'bg-surface border border-border hover:bg-surface-hover'
            }`}
          >
            Not Tracked
          </button>
        </div>
      </div>

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 mb-4">
            <h3 className="text-base md:text-lg font-semibold">Subscriptions</h3>
            <span className="text-secondary text-sm">${subscriptionTotal.toFixed(2)}/month</span>
          </div>
          <div className="space-y-2">
            {subscriptions.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} onToggleTracked={onToggleTracked} />
            ))}
          </div>
        </div>
      )}

      {/* Utilities */}
      {utilities.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 mb-4">
            <h3 className="text-base md:text-lg font-semibold">Utilities & Essential</h3>
            <span className="text-secondary text-sm">${utilitiesTotal.toFixed(2)}/month</span>
          </div>
          <div className="space-y-2">
            {utilities.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} onToggleTracked={onToggleTracked} />
            ))}
          </div>
        </div>
      )}

      {/* Seasonal/Quarterly */}
      {seasonal.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base md:text-lg font-semibold">Quarterly / Seasonal</h3>
          </div>
          <div className="space-y-2">
            {seasonal.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} onToggleTracked={onToggleTracked} />
            ))}
          </div>
        </div>
      )}

      {/* Variable/Shopping Patterns */}
      {variable.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 mb-4">
            <h3 className="text-base md:text-lg font-semibold">Variable / Shopping Patterns</h3>
            <span className="text-xs text-secondary">Usually not tracked as bills</span>
          </div>
          <div className="space-y-2">
            {variable.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} onToggleTracked={onToggleTracked} />
            ))}
          </div>
        </div>
      )}

      {/* Other */}
      {other.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base md:text-lg font-semibold">Other</h3>
          </div>
          <div className="space-y-2">
            {other.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} onToggleTracked={onToggleTracked} />
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xl md:text-2xl font-semibold text-green-500">{summary?.by_confidence.high || 0}</div>
            <div className="text-xs md:text-sm text-secondary">High Confidence</div>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-semibold text-yellow-500">{summary?.by_confidence.medium || 0}</div>
            <div className="text-xs md:text-sm text-secondary">Medium Confidence</div>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-semibold">{summary?.total_recurring || 0}</div>
            <div className="text-xs md:text-sm text-secondary">Total Detected</div>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-semibold">${summary?.total_monthly_cost?.toFixed(2) || '0.00'}</div>
            <div className="text-xs md:text-sm text-secondary">Estimated Monthly</div>
          </div>
        </div>
      </div>
    </div>
  );
}
