'use client';

import { useState, useEffect } from 'react';

interface Insight {
  id: number;
  agentType: string;
  insightType: string;
  title: string;
  body: string;
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
        // Refresh insights after analysis
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
  }, []);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'action_needed':
        return 'border-l-4 border-red-500 bg-red-50 dark:bg-red-950';
      case 'warning':
        return 'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

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
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Financial Insights</h2>
        </div>
        <div className="text-center text-secondary py-8">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Financial Insights</h2>
          <p className="text-sm text-secondary">AI-powered analysis of your spending patterns</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 text-sm font-medium"
        >
          {running ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {insights.length === 0 && !loading && (
        <div className="text-center text-secondary py-8">
          <p className="mb-2">No insights available yet.</p>
          <p className="text-sm">Click "Run Analysis" to generate insights from your spending data.</p>
        </div>
      )}

      {insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div key={insight.id} className={`rounded-lg p-4 ${getSeverityStyles(insight.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getSeverityIcon(insight.severity)}</span>
                    <h3 className="font-semibold text-primary">{insight.title}</h3>
                  </div>
                  <p className="text-sm text-secondary mb-2">{insight.body}</p>
                  {insight.actionable && insight.actionText && (
                    <div className="bg-white/50 dark:bg-black/20 rounded px-3 py-2 mt-3">
                      <p className="text-sm font-medium">
                        <span className="text-primary">→</span> {insight.actionText}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-tertiary">
                    <span>{insight.category || insight.merchant || 'General'}</span>
                    <span>•</span>
                    <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => dismissInsight(insight.id)}
                  className="ml-4 text-tertiary hover:text-primary transition p-1"
                  aria-label="Dismiss"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
