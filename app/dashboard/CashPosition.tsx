interface CashPositionProps {
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
  dailyBudget: {
    discretionaryRemaining: number;
    suggestedDailyLimit: number;
    spentToday: number;
  };
}

export default function CashPosition({ cash, payCycle, dailyBudget }: CashPositionProps) {
  const positionLabel = {
    early: 'Early in cycle',
    mid: 'Mid-cycle',
    late: 'Late in cycle',
  }[payCycle.position];

  const positionColor = {
    early: 'text-positive',
    mid: 'text-primary',
    late: 'text-zcash',
  }[payCycle.position];

  return (
    <section className="bg-surface border border-border rounded-xl p-4 md:p-6">
      <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Cash Position</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {/* Checking Balance */}
        <div>
          <p className="text-xs md:text-sm text-tertiary mb-1">Checking Balance</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums text-primary">
            ${cash.checkingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Available (after safety buffer) */}
        <div>
          <p className="text-xs md:text-sm text-tertiary mb-1">Available</p>
          <p className={`text-xl md:text-2xl font-bold tabular-nums ${cash.available < 1000 ? 'text-negative' : cash.available < 2000 ? 'text-zcash' : 'text-positive'}`}>
            ${cash.available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-tertiary mt-1 hidden sm:block">After ${cash.safetyBuffer.toLocaleString()} buffer</p>
        </div>

        {/* Pay Cycle */}
        <div>
          <p className="text-xs md:text-sm text-tertiary mb-1">Pay Cycle</p>
          <p className={`text-base md:text-lg font-semibold ${positionColor}`}>{positionLabel}</p>
          <p className="text-xs text-tertiary mt-1">
            {payCycle.daysUntilPay > 0
              ? `${payCycle.daysUntilPay} day${payCycle.daysUntilPay !== 1 ? 's' : ''} until payday`
              : 'Payday today!'}
          </p>
        </div>

        {/* Daily Budget */}
        <div>
          <p className="text-xs md:text-sm text-tertiary mb-1">Daily Budget</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums text-primary">
            ${dailyBudget.suggestedDailyLimit.toLocaleString()}
          </p>
          {dailyBudget.spentToday > 0 && (
            <p className="text-xs text-tertiary mt-1">
              ${dailyBudget.spentToday.toLocaleString()} spent today
            </p>
          )}
        </div>
      </div>

      {/* Discretionary remaining bar */}
      <div className="mt-4 md:mt-6 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mb-2">
          <span className="text-xs md:text-sm text-secondary">Monthly Discretionary Remaining</span>
          <span className="text-sm font-semibold tabular-nums text-primary">
            ${dailyBudget.discretionaryRemaining.toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              dailyBudget.discretionaryRemaining < 500
                ? 'bg-negative'
                : dailyBudget.discretionaryRemaining < 1500
                ? 'bg-zcash'
                : 'bg-positive'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, (dailyBudget.discretionaryRemaining / 3000) * 100))}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}
