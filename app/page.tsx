import db, { initDatabase } from '@/lib/db';
import ZcashGuidance from './dashboard/ZcashGuidance';
import DailyBriefing from './dashboard/DailyBriefing';

// Initialize database on server side
initDatabase();

export default async function Dashboard() {
  // Fetch savings goals
  const savingsGoals = db.prepare('SELECT * FROM savings_goals').all() as Array<{
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
  }>;

  // Fetch account balances by type
  const accounts = db.prepare('SELECT * FROM accounts').all() as Array<{
    id: number;
    name: string;
    institution: string;
    type: string;
    balance: number;
    goal_id: number | null;
    last_updated: string;
  }>;

  // Fetch Zcash holdings
  const zcashSources = db.prepare('SELECT * FROM zcash_sources').all() as Array<{
    id: number;
    source_name: string;
    zec_amount: number;
    cost_basis_usd: number | null;
  }>;

  const totalZec = zcashSources.reduce((sum, s) => sum + s.zec_amount, 0);
  const totalCostBasis = zcashSources.reduce((sum, s) => sum + (s.cost_basis_usd || 0), 0);

  // Fetch Zcash price (with fallback)
  let zcashPrice = 0;
  let priceChange24h: number | null = null;
  try {
    const priceCache = db.prepare(
      'SELECT price_usd, change_24h FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1'
    ).get() as { price_usd: number; change_24h: number | null } | undefined;

    if (priceCache) {
      zcashPrice = priceCache.price_usd;
      priceChange24h = priceCache.change_24h;
    }
  } catch (e) {
    // Price not available yet
  }

  const totalZecValue = totalZec * zcashPrice;
  const zcashGainLoss = totalCostBasis > 0 ? totalZecValue - totalCostBasis : null;

  // Calculate totals by account type
  const checkingTotal = accounts
    .filter(a => a.type === 'checking')
    .reduce((sum, a) => sum + a.balance, 0);

  const savingsTotal = accounts
    .filter(a => a.type === 'savings')
    .reduce((sum, a) => sum + a.balance, 0);

  const creditCardTotal = accounts
    .filter(a => a.type === 'credit_card')
    .reduce((sum, a) => sum + a.balance, 0);

  // Calculate net worth (savings + checking + zcash - credit card debt)
  const netWorth = checkingTotal + savingsTotal + totalZecValue - creditCardTotal;

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-12">
      {/* Daily Briefing - Actions, Alerts, Cash Position */}
      <DailyBriefing />

      {/* Hero Section - Key Numbers */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div>
          <span className="text-sm text-secondary uppercase tracking-wide">Checking Balance</span>
          <p className="text-3xl md:text-5xl font-semibold tabular-nums mt-2">
            ${formatCurrency(checkingTotal)}
          </p>
        </div>
        <div>
          <span className="text-sm text-secondary uppercase tracking-wide">Net Worth</span>
          <p className="text-3xl md:text-5xl font-semibold tabular-nums mt-2">
            ${formatCurrency(netWorth)}
          </p>
        </div>
      </section>

      {/* Savings Goals */}
      {savingsGoals.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-sm text-secondary uppercase tracking-wide">Savings Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {savingsGoals.map((goal) => {
              const linkedAccounts = accounts.filter(a => a.goal_id === goal.id);
              const currentAmount = linkedAccounts.reduce((sum, a) => sum + a.balance, 0);
              const percentComplete = Math.min((currentAmount / goal.target_amount) * 100, 100);
              const isComplete = currentAmount >= goal.target_amount;

              return (
                <div
                  key={goal.id}
                  className="bg-surface border border-border rounded-xl p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm text-secondary uppercase tracking-wide">
                      {goal.name}
                    </span>
                    <span className="text-sm text-tertiary">
                      {percentComplete.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums mb-4">
                    ${formatCurrency(currentAmount)}
                    <span className="text-tertiary text-lg font-normal">
                      {' '}/ ${(goal.target_amount / 1000).toFixed(0)}k
                    </span>
                  </p>
                  <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isComplete ? 'bg-positive' : 'bg-tertiary'
                      }`}
                      style={{ width: `${percentComplete}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Zcash Holdings */}
      {totalZec > 0 && (
        <section className="bg-surface border border-border rounded-xl p-4 md:p-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-sm text-secondary uppercase tracking-wide">Zcash Holdings</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zcash animate-pulse-dot" />
              <span className="text-sm text-secondary">LIVE</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <div>
              <p className="text-2xl md:text-3xl font-semibold tabular-nums text-zcash">
                {totalZec.toFixed(2)} <span className="text-base md:text-lg font-normal">ZEC</span>
              </p>
              <p className="text-secondary text-sm md:text-base mt-1">
                ${formatCurrency(totalZecValue)} USD
              </p>
            </div>

            <div>
              <p className="text-2xl md:text-3xl font-semibold tabular-nums">
                ${zcashPrice.toFixed(2)}
              </p>
              <p className="text-secondary text-sm md:text-base mt-1">Current Price</p>
            </div>

            {priceChange24h !== null && (
              <div>
                <p className={`text-2xl md:text-3xl font-semibold tabular-nums ${
                  priceChange24h >= 0 ? 'text-positive' : 'text-negative'
                }`}>
                  {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                </p>
                <p className="text-secondary text-sm md:text-base mt-1">24h Change</p>
              </div>
            )}

            {zcashGainLoss !== null && (
              <div>
                <p className={`text-2xl md:text-3xl font-semibold tabular-nums ${
                  zcashGainLoss >= 0 ? 'text-positive' : 'text-negative'
                }`}>
                  {zcashGainLoss >= 0 ? '+' : ''}${formatCurrency(Math.abs(zcashGainLoss))}
                </p>
                <p className="text-secondary text-sm md:text-base mt-1">Total Gain/Loss</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <a
              href="/zcash"
              className="text-sm text-secondary hover:text-primary transition"
            >
              View details →
            </a>
          </div>
        </section>
      )}

      {/* Zcash Guidance / Recommendation */}
      <ZcashGuidance />

      {/* Account Summary - Only show if there are accounts but no goals displayed */}
      {accounts.length > 0 && savingsGoals.length === 0 && (
        <section className="space-y-6">
          <h2 className="text-sm text-secondary uppercase tracking-wide">Account Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <span className="text-sm text-secondary uppercase tracking-wide">Checking</span>
              <p className="text-2xl font-semibold tabular-nums mt-2">
                ${formatCurrency(checkingTotal)}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <span className="text-sm text-secondary uppercase tracking-wide">Savings</span>
              <p className="text-2xl font-semibold tabular-nums mt-2">
                ${formatCurrency(savingsTotal)}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <span className="text-sm text-secondary uppercase tracking-wide">Credit Cards</span>
              <p className="text-2xl font-semibold tabular-nums mt-2 text-negative">
                -${formatCurrency(creditCardTotal)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {accounts.length === 0 && (
        <section className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-secondary mb-4">
            No accounts found. Import your first statement to get started.
          </p>
          <a
            href="/import"
            className="inline-block bg-primary text-base px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
          >
            Import Statement
          </a>
        </section>
      )}
    </div>
  );
}
