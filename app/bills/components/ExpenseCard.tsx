interface ExpenseCardProps {
  expense: any;
  onToggleTracked: (id: number, currentTracked: number) => void;
}

export default function ExpenseCard({ expense, onToggleTracked }: ExpenseCardProps) {
  const getFrequencyText = () => {
    const days = expense.frequency_days;
    if (days >= 25 && days <= 35) return 'Monthly';
    if (days >= 60 && days <= 100) return 'Quarterly';
    if (days >= 350) return 'Annual';
    if (days < 10) return 'Weekly';
    return `Every ${Math.round(days)} days`;
  };

  const getAmountText = () => {
    if (expense.amount_variance_pct < 5) {
      return `$${expense.typical_amount.toFixed(2)}`;
    } else {
      return `~$${expense.typical_amount.toFixed(2)}`;
    }
  };

  const getTypicalDayText = () => {
    if (expense.typical_day_of_month) {
      return `Day ${expense.typical_day_of_month}`;
    }
    if (expense.next_predicted_date) {
      const date = new Date(expense.next_predicted_date);
      return `Next: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return '';
  };

  const getConfidenceBadge = () => {
    const confidence = expense.confidence;
    if (confidence === 'high') {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-500">High</span>;
    }
    if (confidence === 'medium') {
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-500">Medium</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-500">Low</span>;
  };

  const isTracked = expense.tracked !== 0;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition ${
        isTracked
          ? 'bg-surface-hover border-border'
          : 'bg-surface border-border/50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Checkbox */}
        <button
          onClick={() => onToggleTracked(expense.id, expense.tracked)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
            isTracked ? 'bg-primary border-primary' : 'border-border hover:border-primary'
          }`}
        >
          {isTracked && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Merchant name */}
        <div className="flex-1">
          <div className="font-medium">{expense.merchant_display_name}</div>
          <div className="text-sm text-secondary flex items-center gap-2">
            <span>{getFrequencyText()}</span>
            {getTypicalDayText() && (
              <>
                <span>•</span>
                <span>{getTypicalDayText()}</span>
              </>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <div className="font-semibold">{getAmountText()}</div>
          <div className="text-xs text-secondary">{expense.expense_type}</div>
        </div>

        {/* Confidence badge */}
        <div>{getConfidenceBadge()}</div>

        {/* Actions menu (placeholder) */}
        <button className="p-2 hover:bg-surface-hover rounded transition">
          <svg className="w-5 h-5 text-secondary" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
