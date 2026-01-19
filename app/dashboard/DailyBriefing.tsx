'use client';

import { useState, useEffect } from 'react';
import AlertsBanner from './AlertsBanner';
import TodayActions from './TodayActions';
import CashPosition from './CashPosition';

interface DailyBriefingData {
  date: string;
  cash: {
    checkingBalance: number;
    safetyBuffer: number;
    available: number;
  };
  payCycle: {
    lastPaycheck: string;
    nextPaycheck: string;
    daysSincePay: number;
    daysUntilPay: number;
    position: 'early' | 'mid' | 'late';
  };
  todayActions: {
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
  dailyBudget: {
    discretionaryRemaining: number;
    suggestedDailyLimit: number;
    spentToday: number;
  };
  insights: string[];
  alerts: { level: 'info' | 'warning' | 'critical'; message: string }[];
}

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefing = async (forceRefresh = false) => {
    try {
      const endpoint = forceRefresh ? '/api/briefing/refresh' : '/api/briefing/daily';
      const method = forceRefresh ? 'POST' : 'GET';

      const response = await fetch(endpoint, { method });
      const data = await response.json();

      if (data.success) {
        setBriefing(data.briefing);
        setError(null);
      } else {
        setError(data.error || 'Failed to load briefing');
      }
    } catch (e) {
      console.error('Error fetching briefing:', e);
      setError('Failed to load daily briefing');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBriefing(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6 animate-pulse">
          <div className="h-4 bg-elevated rounded w-1/2 md:w-1/4 mb-4" />
          <div className="h-8 bg-elevated rounded w-3/4 md:w-1/2" />
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6 animate-pulse">
          <div className="h-4 bg-elevated rounded w-1/2 md:w-1/4 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="h-16 bg-elevated rounded" />
            <div className="h-16 bg-elevated rounded" />
            <div className="h-16 bg-elevated rounded" />
            <div className="h-16 bg-elevated rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="bg-surface border border-negative/30 rounded-xl p-6">
        <p className="text-negative">{error || 'Failed to load briefing'}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-elevated border border-border rounded-lg text-secondary hover:text-primary transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <span className="text-sm text-tertiary">
            {new Date(briefing.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-1.5 bg-elevated border border-border rounded-lg text-sm text-secondary hover:text-primary transition disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Briefing'}
        </button>
      </div>

      {/* Alerts Banner */}
      <AlertsBanner alerts={briefing.alerts} />

      {/* Today's Actions */}
      <TodayActions actions={briefing.todayActions} onPurchaseLogged={handleRefresh} />

      {/* Cash Position */}
      <CashPosition
        cash={briefing.cash}
        payCycle={briefing.payCycle}
        dailyBudget={briefing.dailyBudget}
      />

      {/* Insights */}
      {briefing.insights.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Insights</h2>
          <ul className="space-y-2">
            {briefing.insights.map((insight, idx) => (
              <li key={idx} className="text-secondary text-sm md:text-base flex items-start gap-2">
                <span className="text-tertiary mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
