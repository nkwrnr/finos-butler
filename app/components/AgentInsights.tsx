'use client';

import { useState, useEffect } from 'react';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  spendingCategory?: string;
}

interface Insight {
  id: number;
  agentType: string;
  insightType: string;
  title: string;
  body: string;
  dataJson?: {
    transactions?: Transaction[];
  };
  severity: 'info' | 'warning' | 'action_needed';
  category?: string;
  merchant?: string;
  periodType: string;
  referenceDate: string;
  actionable: boolean;
  actionText?: string;
  dismissed: boolean;
  viewed: boolean;
  createdAt: string;
}

interface AgentInsightsProps {
  limit?: number;
}

export default function AgentInsights({ limit = 5 }: AgentInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/insights?limit=${limit}`);
      const data = await response.json();
      if (data.success) {
        setInsights(data.insights);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch insights');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setRunning(true);
      setError(null);
      const response = await fetch('/api/agents/analyst/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.success) {
        await fetchInsights();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to run analysis');
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const dismissInsight = async (insightId: number) => {
    try {
      const response = await fetch(`/api/agents/insights/${insightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      if (response.ok) {
        setInsights(insights.filter((i) => i.id !== insightId));
      }
    } catch (err) {
      console.error('Failed to dismiss insight:', err);
    }
  };

  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'action_needed':
        return '🔴';
      case 'warning':
        return '⚠️';
      default:
        return '💡';
    }
  };

  if (loading && insights.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm text-secondary uppercase tracking-wide">Insights</h2>
        <p className="text-tertiary text-sm">Loading...</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-secondary uppercase tracking-wide">Insights</h2>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="px-3 py-1.5 bg-[#d4af37] text-black rounded-lg hover:opacity-90 transition disabled:opacity-50 text-xs font-medium"
        >
          {running ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {insights.length === 0 && !loading && (
        <div className="text-center text-secondary py-6">
          <p className="text-sm">Click &quot;Refresh&quot; to generate insights from your spending data.</p>
        </div>
      )}

      {insights.length > 0 && (
        <ul className="space-y-3">
          {insights.map((insight) => {
            const transactions = insight.dataJson?.transactions || [];
            const isExpanded = expandedId === insight.id;
            const hasTransactions = transactions.length > 0;

            return (
              <li key={insight.id} className="group">
                <div className="flex items-start gap-3">
                  <span className="text-base shrink-0 mt-0.5">{getSeverityIcon(insight.severity)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary">
                      <span className="font-medium">{insight.title}</span>
                      <span className="text-secondary"> — {insight.body}</span>
                    </p>
                    {insight.actionable && insight.actionText && (
                      <p className="text-xs text-tertiary mt-1">→ {insight.actionText}</p>
                    )}
                    {hasTransactions && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                        className="text-xs text-tertiary hover:text-secondary mt-2"
                      >
                        {isExpanded ? '▼' : '▶'} {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                      </button>
                    )}
                    {isExpanded && (
                      <div className="mt-3 space-y-1.5 pl-4 border-l-2 border-border">
                        {transactions.map((tx) => (
                          <div key={tx.id} className="flex justify-between items-start text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="text-primary truncate">{tx.description}</p>
                              <p className="text-tertiary">
                                {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <p className="text-primary font-medium tabular-nums ml-3">
                              ${tx.amount.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-tertiary hover:text-primary transition p-1"
                    aria-label="Dismiss"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
