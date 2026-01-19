'use client';

import { useEffect, useState } from 'react';

type IncomeProfile = {
  averageMonthlyIncome: number;
  lastPaycheckDate: string | null;
  estimatedNextPaycheckDate: string | null;
  payFrequency: string;
  daysSinceLastPaycheck: number;
  daysUntilNextPaycheck: number;
  confidence: string;
};

type ExpenseProfile = {
  averageMonthlyExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  dailyBurnRate: number;
  recurringBills: Array<{ description: string; amount: number; frequency: string }>;
};

type CashFlowPosition = {
  currentBalance: number;
  daysSincePaycheck: number;
  daysUntilPaycheck: number;
  payCyclePosition: number;
  balanceHealthScore: number;
  upcomingBills: number;
};

type ZcashGoalStatus = {
  targetZec: number;
  currentZec: number;
  zcashNeeded: number;
  deadline: string;
  monthsRemaining: number;
  currentPrice: number;
  usdNeeded: number;
  monthlyUsdRequired: number;
  dailyUsdTarget: number;
  status: string;
};

type RecommendationDetails = {
  incomeProfile: IncomeProfile;
  expenseProfile: ExpenseProfile;
  cashFlowPosition: CashFlowPosition;
  zcashGoal: ZcashGoalStatus;
  calculations: {
    monthlyDiscretionary: number;
    availableForZcash: number;
    dailySustainableBudget: number;
    payCycleAdjustment: number;
    adjustedDailyBudget: number;
    zcashSpentThisWeek: number;
    weeklyBudget: number;
    remainingWeekly: number;
    finalRecommendation: number;
  };
  constraints: {
    safetyBuffer: number;
    maxDailyPurchase: number;
    discretionaryAllocation: number;
  };
  blockingReasons: string[];
  warnings: string[];
};

type RecommendationResult = {
  recommendation: 'buy' | 'wait' | 'blocked';
  amount: number;
  reasoning: string;
  details: RecommendationDetails;
};

type RecommendationResponse = {
  success: boolean;
  currentPrice: number;
  recommendation: RecommendationResult;
};

export default function ZcashGuidance() {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendation();
  }, []);

  const fetchRecommendation = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/zcash-recommendation');
      if (!response.ok) throw new Error('Failed to fetch recommendation');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-surface border border-border rounded-xl p-8">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Today&apos;s Recommendation</h2>
        <p className="text-tertiary">Loading...</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="bg-surface border border-border rounded-xl p-8">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Today&apos;s Recommendation</h2>
        <p className="text-negative">{error || 'Failed to load recommendation'}</p>
      </section>
    );
  }

  const { recommendation, currentPrice } = data;
  const { recommendation: type, amount, reasoning, details } = recommendation;

  const formatCurrency = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="bg-surface border border-border rounded-xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide">Today&apos;s Recommendation</h2>
        <span className="text-sm text-tertiary tabular-nums">
          ZEC ${currentPrice.toFixed(2)}
        </span>
      </div>

      {/* Main Recommendation */}
      <div className="mb-6">
        {type === 'buy' && (
          <div>
            <p className="text-4xl font-semibold tabular-nums text-positive mb-2">
              Buy ${amount}
            </p>
            <p className="text-secondary">{reasoning}</p>
          </div>
        )}

        {type === 'wait' && (
          <div>
            <p className="text-2xl font-semibold text-secondary mb-2">
              Hold off today
            </p>
            <p className="text-secondary">{reasoning}</p>
          </div>
        )}

        {type === 'blocked' && (
          <div>
            <p className="text-2xl font-semibold text-tertiary mb-2">
              Prioritize savings first
            </p>
            <p className="text-secondary">{reasoning}</p>
          </div>
        )}
      </div>

      {/* Warnings */}
      {details.warnings.length > 0 && (
        <div className="mb-6 p-4 bg-elevated rounded-lg border border-border">
          {details.warnings.map((warning, idx) => (
            <p key={idx} className="text-sm text-secondary">
              {warning}
            </p>
          ))}
        </div>
      )}

      {/* Toggle Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-sm text-tertiary hover:text-secondary transition"
      >
        {showDetails ? 'Hide details' : 'Show details'}
      </button>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-border space-y-6">
          {/* Blocking Reasons */}
          {details.blockingReasons.length > 0 && (
            <div className="p-4 bg-elevated rounded-lg">
              <h4 className="text-sm text-secondary uppercase tracking-wide mb-3">
                Blocking Reasons
              </h4>
              <ul className="space-y-2">
                {details.blockingReasons.map((reason, idx) => (
                  <li key={idx} className="text-sm text-negative">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Income Profile */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-tertiary mb-1">Monthly Income</p>
              <p className="text-lg font-medium tabular-nums">
                ${formatCurrency(details.incomeProfile.averageMonthlyIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Pay Frequency</p>
              <p className="text-lg font-medium">{details.incomeProfile.payFrequency}</p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Days Since Paycheck</p>
              <p className="text-lg font-medium tabular-nums">
                {details.incomeProfile.daysSinceLastPaycheck}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Days Until Paycheck</p>
              <p className="text-lg font-medium tabular-nums">
                {details.incomeProfile.daysUntilNextPaycheck}
              </p>
            </div>
          </div>

          {/* Expense Profile */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-tertiary mb-1">Monthly Expenses</p>
              <p className="text-lg font-medium tabular-nums">
                ${formatCurrency(details.expenseProfile.averageMonthlyExpenses)}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Daily Burn Rate</p>
              <p className="text-lg font-medium tabular-nums">
                ${formatCurrency(details.expenseProfile.dailyBurnRate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Current Balance</p>
              <p className="text-lg font-medium tabular-nums">
                ${formatCurrency(details.cashFlowPosition.currentBalance)}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Upcoming Bills</p>
              <p className="text-lg font-medium tabular-nums">
                ${formatCurrency(details.cashFlowPosition.upcomingBills)}
              </p>
            </div>
          </div>

          {/* Zcash Goal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-tertiary mb-1">ZEC Target</p>
              <p className="text-lg font-medium tabular-nums text-zcash">
                {details.zcashGoal.targetZec} ZEC
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Current Holdings</p>
              <p className="text-lg font-medium tabular-nums">
                {details.zcashGoal.currentZec.toFixed(2)} ZEC
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Daily Target</p>
              <p className="text-lg font-medium tabular-nums">
                ${formatCurrency(details.zcashGoal.dailyUsdTarget)}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary mb-1">Months Remaining</p>
              <p className="text-lg font-medium tabular-nums">
                {details.zcashGoal.monthsRemaining}
              </p>
            </div>
          </div>

          {/* Calculations */}
          <div className="p-4 bg-elevated rounded-lg">
            <h4 className="text-sm text-secondary uppercase tracking-wide mb-4">
              Calculations
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Monthly Discretionary</span>
                <span className="tabular-nums">${formatCurrency(details.calculations.monthlyDiscretionary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Available for Zcash</span>
                <span className="tabular-nums">${formatCurrency(details.calculations.availableForZcash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Daily Sustainable Budget</span>
                <span className="tabular-nums">${formatCurrency(details.calculations.dailySustainableBudget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Pay Cycle Adjustment</span>
                <span className="tabular-nums">{details.calculations.payCycleAdjustment.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Weekly Budget</span>
                <span className="tabular-nums">${formatCurrency(details.calculations.weeklyBudget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Spent This Week</span>
                <span className="tabular-nums">${formatCurrency(details.calculations.zcashSpentThisWeek)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Remaining Weekly</span>
                <span className="tabular-nums">${formatCurrency(details.calculations.remainingWeekly)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="font-medium">Final Recommendation</span>
                <span className="font-medium tabular-nums text-positive">
                  ${formatCurrency(details.calculations.finalRecommendation)}
                </span>
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-tertiary mb-1">Safety Buffer</p>
              <p className="tabular-nums">${formatCurrency(details.constraints.safetyBuffer)}</p>
            </div>
            <div>
              <p className="text-tertiary mb-1">Max Daily Purchase</p>
              <p className="tabular-nums">${formatCurrency(details.constraints.maxDailyPurchase)}</p>
            </div>
            <div>
              <p className="text-tertiary mb-1">Discretionary Allocation</p>
              <p className="tabular-nums">{(details.constraints.discretionaryAllocation * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
