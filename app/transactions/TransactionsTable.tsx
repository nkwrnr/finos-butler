'use client';

import { useState } from 'react';
import TransactionModal from '@/app/components/TransactionModal';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  account_name: string;
  institution: string;
  account_type: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
}

export default function TransactionsTable({ transactions }: TransactionsTableProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleRefresh = () => {
    // Reload the page to refresh data
    window.location.reload();
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-secondary font-medium text-sm">Date</th>
              <th className="text-left py-2 px-2 text-secondary font-medium text-sm">Account</th>
              <th className="text-left py-2 px-2 text-secondary font-medium text-sm">Description</th>
              <th className="text-right py-2 px-2 text-secondary font-medium text-sm">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                onClick={() => setSelectedId(transaction.id)}
                className="border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-hover transition"
              >
                <td className="py-3 px-2 text-sm tabular-nums">
                  {new Date(transaction.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-3 px-2 text-sm">
                  <div>
                    <p className="font-medium">{transaction.institution}</p>
                    <p className="text-xs text-tertiary">{transaction.account_type}</p>
                  </div>
                </td>
                <td className="py-3 px-2 text-sm text-secondary">{transaction.description}</td>
                <td
                  className={`py-3 px-2 text-sm text-right font-semibold tabular-nums ${
                    transaction.amount >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {transaction.amount >= 0 ? '+' : ''}$
                  {Math.abs(transaction.amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <TransactionModal transactionId={selectedId} onClose={() => setSelectedId(null)} onSave={handleRefresh} />
      )}
    </>
  );
}
