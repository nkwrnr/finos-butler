interface UpcomingBillsProps {
  expenses: any[];
}

export default function UpcomingBills({ expenses }: UpcomingBillsProps) {
  // Filter for bills due in next 7 days
  const today = new Date();
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const upcomingBills = expenses
    .filter((expense) => {
      if (!expense.next_predicted_date || expense.tracked === 0) return false;
      const dueDate = new Date(expense.next_predicted_date);
      return dueDate >= today && dueDate <= sevenDaysFromNow;
    })
    .map((expense) => {
      const dueDate = new Date(expense.next_predicted_date);
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...expense, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const totalDue = upcomingBills.reduce((sum, bill) => sum + (bill.next_predicted_amount || 0), 0);

  const getUrgencyColor = (daysUntil: number) => {
    if (daysUntil <= 2) return 'text-red-500';
    if (daysUntil <= 5) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getUrgencyBg = (daysUntil: number) => {
    if (daysUntil <= 2) return 'bg-red-500/10 border-red-500/20';
    if (daysUntil <= 5) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-green-500/10 border-green-500/20';
  };

  const getDaysText = (daysUntil: number) => {
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    return `Due in ${daysUntil} days`;
  };

  if (upcomingBills.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming This Week</h2>
        <p className="text-secondary">No bills due in the next 7 days</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Upcoming This Week</h2>

      <div className="space-y-3 mb-6">
        {upcomingBills.map((bill) => (
          <div
            key={bill.id}
            className={`flex items-center justify-between p-4 rounded-lg border ${getUrgencyBg(bill.daysUntil)}`}
          >
            <div className="flex items-center gap-4">
              <div className={`text-2xl ${getUrgencyColor(bill.daysUntil)}`}>●</div>
              <div>
                <div className="font-medium">{bill.merchant_display_name}</div>
                <div className="text-sm text-secondary">{getDaysText(bill.daysUntil)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">${bill.next_predicted_amount?.toFixed(2)}</div>
              <div className="text-xs text-secondary">{bill.prediction_confidence} confidence</div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-secondary">Total Due This Week</span>
          <span className="text-xl font-semibold">${totalDue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
