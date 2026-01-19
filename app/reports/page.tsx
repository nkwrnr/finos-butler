'use client';

import { useState, useEffect } from 'react';
import SpendingCharts from './SpendingCharts';
import MonthOverMonth from './MonthOverMonth';
import TransactionModal from '@/app/components/TransactionModal';

// Duplicated types (client component can't import from server-side lib)
type MonthlyClose = {
  month: string;
  income: {
    total: number;
    transactions: { id: number; date: string; description: string; amount: number }[];
    paycheckCount: number;
    isComplete: boolean;
  };
  fixed: {
    rent: number;
  };
  spending: {
    total: number;
    byAccount: {
      checking: number;
      chase: number;
      gemini: number;
      bilt: number;
    };
    topMerchants: { name: string; total: number; count: number }[];
    largeExpenses: { id: number; date: string; description: string; amount: number }[];
  };
  allocations: {
    savings: number;
    zcash: number;
    creditPayments: number;
  };
  cashFlow: {
    startingBalance: number | null;
    totalInflows: number;
    totalOutflows: number;
    netChange: number;
    endingBalance: number | null;
  };
  nonOperating: {
    taxRefunds: number;
    creditRewards: number;
    refunds: number;
    transfersIn: number;
  };
  flags: string[];
  summary: {
    surplus: number;
    savingsRate: number;
    expenseRatio: number;
  };
};

type FinancialTrends = {
  months: MonthlyClose[];
  averages: {
    income: number;
    spending: number;
    surplus: number;
    savingsRate: number;
  };
  trends: {
    incomeDirection: 'increasing' | 'stable' | 'decreasing';
    spendingDirection: 'increasing' | 'stable' | 'decreasing';
    surplusDirection: 'increasing' | 'stable' | 'decreasing';
  };
  insights: string[];
};

export default function ReportsPage() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthlyReport, setMonthlyReport] = useState<MonthlyClose | null>(null);
  const [trends, setTrends] = useState<FinancialTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'monthly' | 'trends' | 'charts' | 'mom'>('monthly');
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);

  // Load available months on mount
  useEffect(() => {
    async function loadMonths() {
      try {
        const res = await fetch('/api/reports/available-months');
        const data = await res.json();
        setAvailableMonths(data.months);
        setSelectedMonth(data.currentMonth);
      } catch (err) {
        setError('Failed to load available months');
      }
    }
    loadMonths();
  }, []);

  // Load monthly report when month changes
  useEffect(() => {
    if (!selectedMonth) return;

    async function loadReport() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/reports/monthly?month=${selectedMonth}`);
        const data = await res.json();
        setMonthlyReport(data);
      } catch (err) {
        setError('Failed to load monthly report');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [selectedMonth]);

  // Load trends
  useEffect(() => {
    async function loadTrends() {
      try {
        const res = await fetch('/api/reports/trends?months=6');
        const data = await res.json();
        setTrends(data);
      } catch (err) {
        console.error('Failed to load trends:', err);
      }
    }
    loadTrends();
  }, []);

  if (loading && !monthlyReport) {
    return (
      <div className="space-y-6 md:space-y-8">
        <h1 className="text-2xl md:text-3xl font-bold">Financial Reports</h1>
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold">Financial Reports</h1>

      {/* View Toggle */}
      <div className="flex overflow-x-auto gap-2 md:gap-3 pb-2">
        <button
          onClick={() => setView('monthly')}
          className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition ${
            view === 'monthly'
              ? 'bg-primary text-base'
              : 'bg-surface border border-border text-secondary hover:text-primary'
          }`}
        >
          Monthly Statement
        </button>
        <button
          onClick={() => setView('trends')}
          className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition ${
            view === 'trends'
              ? 'bg-primary text-base'
              : 'bg-surface border border-border text-secondary hover:text-primary'
          }`}
        >
          Trends (6 Months)
        </button>
        <button
          onClick={() => setView('charts')}
          className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition ${
            view === 'charts'
              ? 'bg-primary text-base'
              : 'bg-surface border border-border text-secondary hover:text-primary'
          }`}
        >
          Charts
        </button>
        <button
          onClick={() => setView('mom')}
          className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium transition ${
            view === 'mom'
              ? 'bg-primary text-base'
              : 'bg-surface border border-border text-secondary hover:text-primary'
          }`}
        >
          Month over Month
        </button>
      </div>

      {/* Month Selector */}
      {view === 'monthly' && (
        <div>
          <label className="block text-sm text-secondary uppercase tracking-wide mb-2">
            Select Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-primary w-full md:w-64 focus:outline-none focus:ring-1 focus:ring-border"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonthDisplay(month)}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="bg-negative/10 border border-negative/20 text-negative px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Monthly Statement View */}
      {view === 'monthly' && monthlyReport && (
        <MonthlyStatementView report={monthlyReport} onTransactionClick={setSelectedTransactionId} />
      )}

      {/* Trends View */}
      {view === 'trends' && trends && <TrendsView trends={trends} />}

      {/* Charts View */}
      {view === 'charts' && <SpendingCharts />}

      {/* Month over Month View */}
      {view === 'mom' && <MonthOverMonth />}

      {/* Transaction Modal */}
      {selectedTransactionId && (
        <TransactionModal
          transactionId={selectedTransactionId}
          onClose={() => setSelectedTransactionId(null)}
          onSave={() => {
            setSelectedTransactionId(null);
            // Reload the current month's data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function MonthlyStatementView({ report, onTransactionClick }: { report: MonthlyClose; onTransactionClick?: (id: number) => void }) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Flags */}
      {report.flags.length > 0 && (
        <div className="bg-zcash/10 border border-zcash/20 rounded-xl p-3 md:p-4">
          <h3 className="font-semibold text-zcash mb-2 text-sm md:text-base">Alerts</h3>
          <ul className="list-disc list-inside space-y-1">
            {report.flags.map((flag, i) => (
              <li key={i} className="text-secondary text-sm">
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <MetricCard
          title="Surplus"
          value={formatCurrency(report.summary.surplus)}
          positive={report.summary.surplus > 0}
        />
        <MetricCard
          title="Savings Rate"
          value={`${report.summary.savingsRate.toFixed(1)}%`}
          positive={report.summary.savingsRate > 20}
        />
        <MetricCard
          title="Expense Ratio"
          value={`${report.summary.expenseRatio.toFixed(1)}%`}
          positive={report.summary.expenseRatio < 50}
        />
      </div>

      {/* Income Statement */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">Income Statement - {formatMonthDisplay(report.month)}</h2>

        {/* Income */}
        <Section title="Income">
          <LineItem
            label={`Payroll Income (${report.income.paycheckCount} paychecks)`}
            amount={report.income.total}
            bold
          />
          <LineItem label="Total Income" amount={report.income.total} total />
        </Section>

        {/* Fixed Expenses */}
        <Section title="Fixed Expenses">
          <LineItem label="Rent" amount={report.fixed.rent} />
          <LineItem label="Total Fixed Expenses" amount={report.fixed.rent} total />
        </Section>

        {/* Variable Spending */}
        <Section title="Variable Spending">
          <LineItem label="Checking Expenses" amount={report.spending.byAccount.checking} />
          <LineItem label="Chase Credit Card" amount={report.spending.byAccount.chase} />
          <LineItem label="Bilt Credit Card" amount={report.spending.byAccount.bilt} />
          <LineItem label="Gemini Card" amount={report.spending.byAccount.gemini} />
          <LineItem label="Total Variable Spending" amount={report.spending.total} total />
        </Section>

        {/* Allocations */}
        <Section title="Allocations (Savings & Investments)">
          <LineItem label="Zcash Purchases" amount={report.allocations.zcash} />
          <LineItem label="Savings Transfers" amount={report.allocations.savings} />
          <LineItem label="Credit Card Payments" amount={report.allocations.creditPayments} />
          <LineItem
            label="Total Allocations"
            amount={report.allocations.savings + report.allocations.zcash + report.allocations.creditPayments}
            total
          />
        </Section>

        {/* Net Surplus */}
        <div className="mt-6 pt-4 border-t-2 border-border">
          <LineItem
            label="Net Surplus / (Deficit)"
            amount={report.summary.surplus}
            bold
            className={report.summary.surplus > 0 ? 'text-positive' : 'text-negative'}
          />
        </div>
      </div>

      {/* Top Merchants */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold mb-4">Top Merchants</h3>
        <div className="space-y-2">
          {report.spending.topMerchants.map((merchant, i) => (
            <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
              <span className="text-sm text-secondary truncate">{merchant.name}</span>
              <div className="text-right">
                <span className="font-medium tabular-nums text-sm md:text-base">{formatCurrency(merchant.total)}</span>
                <span className="text-tertiary text-xs ml-2">({merchant.count} txns)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Large Expenses */}
      {report.spending.largeExpenses.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold mb-4">Large Expenses (&gt; $200)</h3>
          <div className="space-y-3 md:space-y-2">
            {report.spending.largeExpenses.map((expense, i) => (
              <div
                key={i}
                onClick={() => onTransactionClick?.(expense.id)}
                className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 cursor-pointer hover:bg-surface-hover p-2 rounded transition"
              >
                <div>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(expense.amount)}</span>
                  <span className="text-tertiary text-xs ml-2">{expense.date}</span>
                </div>
                <span className="text-xs sm:text-sm text-secondary truncate">{expense.description.substring(0, 40)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Operating Items */}
      {(report.nonOperating.taxRefunds > 0 ||
        report.nonOperating.creditRewards > 0 ||
        report.nonOperating.refunds > 0) && (
        <div className="bg-elevated border border-border rounded-xl p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold mb-4">Non-Operating Items (Excluded from Budget)</h3>
          <div className="space-y-2">
            {report.nonOperating.taxRefunds > 0 && (
              <LineItem label="Tax Refunds" amount={report.nonOperating.taxRefunds} />
            )}
            {report.nonOperating.creditRewards > 0 && (
              <LineItem label="Credit Card Rewards" amount={report.nonOperating.creditRewards} />
            )}
            {report.nonOperating.refunds > 0 && (
              <LineItem label="Refunds & Reversals" amount={report.nonOperating.refunds} />
            )}
            {report.nonOperating.transfersIn > 0 && (
              <LineItem label="Transfers From Savings" amount={report.nonOperating.transfersIn} />
            )}
          </div>
        </div>
      )}

      {/* Cash Flow */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold mb-4">Cash Flow (Checking Account)</h3>
        <div className="space-y-2">
          <LineItem label="Total Inflows" amount={report.cashFlow.totalInflows} />
          <LineItem label="Total Outflows" amount={report.cashFlow.totalOutflows} />
          <LineItem
            label="Net Change"
            amount={report.cashFlow.netChange}
            bold
            className={report.cashFlow.netChange > 0 ? 'text-positive' : 'text-negative'}
          />
        </div>
      </div>
    </div>
  );
}

function TrendsView({ trends }: { trends: FinancialTrends }) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Insights */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-4">
        <h3 className="font-semibold text-secondary uppercase tracking-wide text-xs md:text-sm mb-3">Key Insights</h3>
        <ul className="list-disc list-inside space-y-1">
          {trends.insights.map((insight, i) => (
            <li key={i} className="text-secondary text-sm">
              {insight}
            </li>
          ))}
        </ul>
      </div>

      {/* Averages */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard title="Avg Income" value={formatCurrency(trends.averages.income)} />
        <MetricCard title="Avg Spending" value={formatCurrency(trends.averages.spending)} />
        <MetricCard
          title="Avg Surplus"
          value={formatCurrency(trends.averages.surplus)}
          positive={trends.averages.surplus > 0}
        />
        <MetricCard
          title="Avg Savings Rate"
          value={`${trends.averages.savingsRate.toFixed(1)}%`}
          positive={trends.averages.savingsRate > 20}
        />
      </div>

      {/* Trends */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold mb-4">Trends</h3>
        <div className="space-y-2">
          <TrendItem label="Income" direction={trends.trends.incomeDirection} />
          <TrendItem label="Spending" direction={trends.trends.spendingDirection} />
          <TrendItem label="Surplus" direction={trends.trends.surplusDirection} />
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold mb-4">Monthly Breakdown</h3>
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <table className="w-full text-xs md:text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-secondary font-medium">Month</th>
                <th className="text-right py-2 text-secondary font-medium">Income</th>
                <th className="text-right py-2 text-secondary font-medium">Spending</th>
                <th className="text-right py-2 text-secondary font-medium">Surplus</th>
                <th className="text-right py-2 text-secondary font-medium">Savings</th>
              </tr>
            </thead>
            <tbody>
              {trends.months.map((month) => (
                <tr key={month.month} className="border-b border-border">
                  <td className="py-2">{formatMonthDisplay(month.month)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(month.income.total)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(month.spending.total)}</td>
                  <td
                    className={`text-right tabular-nums ${
                      month.summary.surplus > 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatCurrency(month.summary.surplus)}
                  </td>
                  <td className="text-right tabular-nums">{month.summary.savingsRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wide">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LineItem({
  label,
  amount,
  bold = false,
  total = false,
  className = '',
}: {
  label: string;
  amount: number;
  bold?: boolean;
  total?: boolean;
  className?: string;
}) {
  const baseClass = 'flex justify-between items-center py-1';
  const textClass = bold || total ? 'font-semibold' : '';
  const borderClass = total ? 'border-t border-border pt-2 mt-2' : '';

  return (
    <div className={`${baseClass} ${borderClass} ${className}`}>
      <span className={textClass}>{label}</span>
      <span className={`${textClass} tabular-nums`}>{formatCurrency(amount)}</span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  positive,
}: {
  title: string;
  value: string;
  positive?: boolean;
}) {
  const colorClass =
    positive === undefined ? 'text-primary' : positive ? 'text-positive' : 'text-negative';

  return (
    <div className="bg-surface border border-border rounded-xl p-3 md:p-4">
      <div className="text-xs md:text-sm text-secondary uppercase tracking-wide mb-1">{title}</div>
      <div className={`text-lg md:text-2xl font-bold tabular-nums ${colorClass}`}>{value}</div>
    </div>
  );
}

function TrendItem({
  label,
  direction,
}: {
  label: string;
  direction: 'increasing' | 'stable' | 'decreasing';
}) {
  const icon =
    direction === 'increasing' ? '↑' : direction === 'decreasing' ? '↓' : '→';
  const colorClass =
    direction === 'increasing'
      ? 'text-positive'
      : direction === 'decreasing'
      ? 'text-negative'
      : 'text-secondary';

  return (
    <div className="flex justify-between items-center">
      <span className="text-secondary">{label}</span>
      <span className={`font-semibold ${colorClass}`}>
        {icon} {direction}
      </span>
    </div>
  );
}

// Helper Functions

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatMonthDisplay(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
