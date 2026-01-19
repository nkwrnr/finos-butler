'use client';

import { useEffect, useState } from 'react';
import UpcomingBills from './components/UpcomingBills';
import RecurringList from './components/RecurringList';

export default function BillsPage() {
  const [recurringExpenses, setRecurringExpenses] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/recurring-expenses?predictions=true&anomalies=false');
      const data = await response.json();
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleToggleTracked = async (id: number, currentTracked: number) => {
    try {
      await fetch(`/api/recurring-expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: currentTracked ? 0 : 1 }),
      });
      await fetchData();
    } catch (error) {
      console.error('Error toggling tracked status:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <h1 className="text-2xl md:text-3xl font-semibold">Bills & Subscriptions</h1>
        </div>
        <div className="text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl md:text-3xl font-semibold">Bills & Subscriptions</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Upcoming Bills This Week */}
      <UpcomingBills expenses={recurringExpenses?.recurring_expenses || []} />

      {/* All Recurring Expenses */}
      <RecurringList
        expenses={recurringExpenses?.recurring_expenses || []}
        summary={recurringExpenses?.summary}
        onToggleTracked={handleToggleTracked}
      />
    </div>
  );
}
