import db, { initDatabase } from '@/lib/db';
import TransactionsTable from './TransactionsTable';

// Initialize database on server side
initDatabase();

export default function Transactions() {
  // Fetch all transactions with account info
  const transactions = db.prepare(`
    SELECT
      t.id,
      t.date,
      t.description,
      t.amount,
      t.category,
      a.name as account_name,
      a.institution,
      a.type as account_type
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    ORDER BY t.date DESC
    LIMIT 100
  `).all() as Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    account_name: string;
    institution: string;
    account_type: string;
  }>;

  // Group by account
  const accounts = db.prepare('SELECT * FROM accounts').all() as Array<{
    id: number;
    name: string;
    institution: string;
    type: string;
    balance: number;
    goal_id: number | null;
    last_updated: string;
  }>;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Transactions</h1>

      {/* Accounts Summary */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-secondary">No accounts found.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex justify-between items-center p-3 bg-elevated border border-border rounded-lg"
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-secondary">
                    {account.institution} • {account.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg tabular-nums">
                    ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-tertiary">
                    {new Date(account.last_updated).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transactions List */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Recent Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-secondary">
            No transactions found. Import a statement to get started.
          </p>
        ) : (
          <>
            <TransactionsTable transactions={transactions} />
            <p className="text-sm text-tertiary mt-4">
              Showing {transactions.length} most recent transactions
            </p>
          </>
        )}
      </section>
    </div>
  );
}
