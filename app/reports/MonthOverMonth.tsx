'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface MonthData {
  month: string;
  income: number;
  expenses: number;
  rent: number;
  variableExpenses: number;
  zcash: number;
  savings: number;
  netCash: number;
  savingsRate: number;
  accountCount: number;
  isIncomplete: boolean;
}

interface MonthOverMonthData {
  months: MonthData[];
  incompleteMonths: string[];
  averages: {
    income: number;
    expenses: number;
    netCash: number;
    savingsRate: number;
  };
}

export default function MonthOverMonth() {
  const [data, setData] = useState<MonthOverMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/reports/month-over-month?months=6');
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError('Failed to load month-over-month data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center text-secondary py-8">Loading...</div>;
  }

  if (error || !data) {
    return (
      <div className="bg-negative/10 border border-negative/20 text-negative px-4 py-3 rounded-lg">
        {error || 'No data available'}
      </div>
    );
  }

  // Prepare chart data (reverse for chronological order)
  const chartData = [...data.months].reverse().map(m => ({
    month: formatMonthShort(m.month),
    fullMonth: m.month,
    expenses: m.expenses,
    income: m.income,
    netCash: m.netCash,
    savingsRate: m.savingsRate,
    isIncomplete: m.isIncomplete,
  }));

  return (
    <div className="space-y-6">
      {/* Data Completeness Warning */}
      {data.incompleteMonths.length > 0 && (
        <div className="bg-zcash/10 border border-zcash/20 rounded-xl p-4">
          <h3 className="font-semibold text-zcash mb-2">Data Quality Notice</h3>
          <p className="text-secondary text-sm">
            The following months may have incomplete data:{' '}
            {data.incompleteMonths.map(m => formatMonthDisplay(m)).join(', ')}
          </p>
          <p className="text-tertiary text-xs mt-1">
            Check if all account statements have been imported for these periods.
          </p>
        </div>
      )}

      {/* Averages Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Avg Income"
          value={formatCurrency(data.averages.income)}
        />
        <MetricCard
          title="Avg Expenses"
          value={formatCurrency(data.averages.expenses)}
        />
        <MetricCard
          title="Avg Net Cash"
          value={formatCurrency(data.averages.netCash)}
          positive={data.averages.netCash > 0}
        />
        <MetricCard
          title="Avg Savings Rate"
          value={`${data.averages.savingsRate}%`}
          positive={data.averages.savingsRate > 20}
        />
      </div>

      {/* Expenses Chart */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Monthly Expenses</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                stroke="var(--secondary)"
                fontSize={12}
              />
              <YAxis
                stroke="var(--secondary)"
                fontSize={12}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
                formatter={(value) => [formatCurrency(value as number), 'Expenses']}
                labelFormatter={(label) => label}
              />
              <Bar
                dataKey="expenses"
                fill="var(--negative)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Cash Flow Chart */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Net Cash Flow</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                stroke="var(--secondary)"
                fontSize={12}
              />
              <YAxis
                stroke="var(--secondary)"
                fontSize={12}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
                formatter={(value) => [formatCurrency(value as number), 'Net Cash']}
              />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="netCash"
                stroke="var(--positive)"
                strokeWidth={2}
                dot={{ fill: 'var(--positive)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Monthly Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-secondary font-medium">Month</th>
                <th className="text-right py-2 text-secondary font-medium">Income</th>
                <th className="text-right py-2 text-secondary font-medium">Expenses</th>
                <th className="text-right py-2 text-secondary font-medium">Net Cash</th>
                <th className="text-right py-2 text-secondary font-medium">Savings Rate</th>
                <th className="text-center py-2 text-secondary font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <tr
                  key={month.month}
                  className={`border-b border-border ${month.isIncomplete ? 'bg-zcash/5' : ''}`}
                >
                  <td className="py-3">
                    {formatMonthDisplay(month.month)}
                    {month.isIncomplete && (
                      <span className="ml-2 text-zcash text-xs">*</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(month.income)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(month.expenses)}</td>
                  <td
                    className={`text-right tabular-nums font-medium ${
                      month.netCash >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {month.netCash >= 0 ? '+' : ''}{formatCurrency(month.netCash)}
                  </td>
                  <td className="text-right tabular-nums">{month.savingsRate}%</td>
                  <td className="text-center">
                    {month.isIncomplete ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-zcash/20 text-zcash">
                        Incomplete
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-positive/20 text-positive">
                        Complete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.incompleteMonths.length > 0 && (
          <p className="text-xs text-tertiary mt-3">
            * Months marked incomplete may be missing account statements or have fewer transactions than expected.
          </p>
        )}
      </div>

      {/* Breakdown by Category */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Expense Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-secondary font-medium">Month</th>
                <th className="text-right py-2 text-secondary font-medium">Rent</th>
                <th className="text-right py-2 text-secondary font-medium">Variable</th>
                <th className="text-right py-2 text-secondary font-medium">Zcash</th>
                <th className="text-right py-2 text-secondary font-medium">Savings</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <tr key={month.month} className="border-b border-border">
                  <td className="py-3">{formatMonthShort(month.month)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(month.rent)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(month.variableExpenses)}</td>
                  <td className="text-right tabular-nums text-zcash">{formatCurrency(month.zcash)}</td>
                  <td className="text-right tabular-nums text-positive">{formatCurrency(month.savings)}</td>
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
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-sm text-secondary uppercase tracking-wide mb-1">{title}</div>
      <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</div>
    </div>
  );
}

// Helper Functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthDisplay(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatMonthShort(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
