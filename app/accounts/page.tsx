'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Account = {
  id: number;
  name: string;
  institution: string;
  type: string;
  balance: number;
  goal_id: number | null;
  goal_name: string | null;
  transaction_count: number;
  sum_of_transactions: number;
  min_transaction: number;
  max_transaction: number;
  last_updated: string;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/accounts-debug');
      const data = await response.json();
      setAccounts(data.accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-secondary">Loading accounts...</div>;
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalTransactions = accounts.reduce((sum, acc) => sum + acc.transaction_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">All Accounts</h1>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="px-4 py-2 bg-surface border border-border text-secondary rounded-lg hover:text-primary transition"
        >
          {showDebug ? 'Hide' : 'Show'} Debug Info
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Summary</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-tertiary mb-1">Total Accounts</p>
            <p className="text-2xl font-bold tabular-nums">{accounts.length}</p>
          </div>
          <div>
            <p className="text-sm text-tertiary mb-1">Total Balance</p>
            <p className="text-2xl font-bold tabular-nums">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-sm text-tertiary mb-1">Total Transactions</p>
            <p className="text-2xl font-bold tabular-nums">{totalTransactions.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {accounts.map((account) => {
          const balanceMismatch = Math.abs(account.balance - account.sum_of_transactions) > 0.01;

          return (
            <div
              key={account.id}
              className={`bg-surface border rounded-xl p-6 ${
                balanceMismatch ? 'border-negative' : 'border-border'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{account.name}</h3>
                  <p className="text-sm text-secondary">
                    {account.institution} • {account.type}
                    {account.goal_name && <span className="ml-2 text-zcash">→ {account.goal_name} goal</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-tertiary mb-1">Balance</p>
                  <p className={`text-2xl font-bold tabular-nums ${balanceMismatch ? 'text-negative' : ''}`}>
                    ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {balanceMismatch && (
                    <p className="text-xs text-negative mt-1">Balance mismatch</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-tertiary mb-1">Transactions</p>
                  <p className="font-semibold tabular-nums">{account.transaction_count.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-tertiary mb-1">Last Updated</p>
                  <p className="font-semibold text-sm">{new Date(account.last_updated).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-tertiary mb-1">Min Transaction</p>
                  <p className="font-semibold tabular-nums">${account.min_transaction.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-tertiary mb-1">Max Transaction</p>
                  <p className="font-semibold tabular-nums">${account.max_transaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {showDebug && (
                <div className="bg-elevated border border-border rounded-lg p-4 mt-4">
                  <p className="text-xs font-mono mb-2 text-secondary">Debug Information:</p>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <p className="text-tertiary">Account ID:</p>
                      <p>{account.id}</p>
                    </div>
                    <div>
                      <p className="text-tertiary">Stored Balance:</p>
                      <p className={balanceMismatch ? 'text-negative' : ''}>${account.balance.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-tertiary">Sum of Transactions:</p>
                      <p className={balanceMismatch ? 'text-negative' : ''}>${account.sum_of_transactions.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-tertiary">Difference:</p>
                      <p className={balanceMismatch ? 'text-negative font-bold' : ''}>
                        ${(account.balance - account.sum_of_transactions).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {balanceMismatch && (
                    <div className="mt-3 p-3 bg-negative/10 border border-negative/20 rounded-lg">
                      <p className="text-negative text-sm font-semibold">
                        ISSUE: Stored balance doesn&apos;t match sum of transactions!
                      </p>
                      <p className="text-negative/80 text-xs mt-1">
                        This usually indicates incorrect transaction parsing or balance calculation.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <Link
                  href={`/transactions?account=${account.id}`}
                  className="text-secondary hover:text-primary text-sm transition"
                >
                  View all transactions →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
