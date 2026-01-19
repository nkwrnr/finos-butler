import { calculateCashReservation } from '../lib/recurring-expenses/cash-reservation';
import db from '../lib/db';

async function main() {
  // Get current checking balance from accounts table
  const account = db
    .prepare(
      `
    SELECT balance FROM accounts
    WHERE name LIKE '%Wells%' OR name LIKE '%Checking%'
    LIMIT 1
  `
    )
    .get() as { balance: number } | undefined;

  const checkingBalance = account?.balance || 5000; // Default to $5000 if not found

  console.log('\n' + '='.repeat(70));
  console.log('CASH RESERVATION ANALYSIS');
  console.log('='.repeat(70));
  console.log('');

  // Calculate 14-day cash reservation
  const reservation = calculateCashReservation(checkingBalance, 14);

  console.log(`Checking Account Balance: $${reservation.checking_balance.toFixed(2)}`);
  console.log(`Analysis Period: Next ${reservation.days_ahead} days`);
  console.log('');

  console.log('='.repeat(70));
  console.log('UPCOMING BILLS (Next 14 Days)');
  console.log('='.repeat(70));
  console.log('');

  if (reservation.upcoming_bills.length === 0) {
    console.log('  No bills due in the next 14 days.');
    console.log('');
  } else {
    // Group by priority
    const essential = reservation.upcoming_bills.filter((b) => b.priority === 'essential');
    const important = reservation.upcoming_bills.filter((b) => b.priority === 'important');
    const discretionary = reservation.upcoming_bills.filter((b) => b.priority === 'discretionary');

    if (essential.length > 0) {
      console.log('ESSENTIAL:');
      for (const bill of essential) {
        const daysStr = bill.days_until_due === 0 ? 'TODAY' : bill.days_until_due === 1 ? 'TOMORROW' : `in ${bill.days_until_due} days`;
        console.log(`  ${bill.due_date} (${daysStr}): ${bill.merchant.padEnd(30)} $${bill.predicted_amount.toFixed(2)} [${bill.confidence}]`);
      }
      console.log('');
    }

    if (important.length > 0) {
      console.log('IMPORTANT:');
      for (const bill of important) {
        const daysStr = bill.days_until_due === 0 ? 'TODAY' : bill.days_until_due === 1 ? 'TOMORROW' : `in ${bill.days_until_due} days`;
        console.log(`  ${bill.due_date} (${daysStr}): ${bill.merchant.padEnd(30)} $${bill.predicted_amount.toFixed(2)} [${bill.confidence}]`);
      }
      console.log('');
    }

    if (discretionary.length > 0) {
      console.log('DISCRETIONARY:');
      for (const bill of discretionary) {
        const daysStr = bill.days_until_due === 0 ? 'TODAY' : bill.days_until_due === 1 ? 'TOMORROW' : `in ${bill.days_until_due} days`;
        console.log(`  ${bill.due_date} (${daysStr}): ${bill.merchant.padEnd(30)} $${bill.predicted_amount.toFixed(2)} [${bill.confidence}]`);
      }
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('CASH RESERVATION SUMMARY');
  console.log('='.repeat(70));
  console.log('');

  console.log(`Total Bills Due: ${reservation.total_bills_count}`);
  console.log(`Total Reserved: $${reservation.total_reserved.toFixed(2)}`);
  console.log('');

  console.log('Reserved by Priority:');
  console.log(`  Essential:     $${reservation.reserved_by_priority.essential.toFixed(2)}`);
  console.log(`  Important:     $${reservation.reserved_by_priority.important.toFixed(2)}`);
  console.log(`  Discretionary: $${reservation.reserved_by_priority.discretionary.toFixed(2)}`);
  console.log('');

  console.log('='.repeat(70));
  console.log('AVAILABLE CASH');
  console.log('='.repeat(70));
  console.log('');

  console.log(`Checking Balance:            $${reservation.checking_balance.toFixed(2)}`);
  console.log(`Less: All Upcoming Bills:    -$${reservation.total_reserved.toFixed(2)}`);
  console.log(`─`.repeat(40));
  console.log(`True Available Cash:         $${reservation.true_available_cash.toFixed(2)}`);
  console.log('');

  console.log(`Conservative Available:      $${reservation.conservative_available_cash.toFixed(2)}`);
  console.log(`  (Excludes discretionary bills)`);
  console.log('');

  // Health status with emoji
  const statusEmoji = {
    healthy: '✓',
    tight: '⚠',
    overdrawn: '✗',
  };

  const statusMessage = {
    healthy: 'Healthy - Sufficient funds for all bills',
    tight: 'Tight - Low buffer after bills',
    overdrawn: 'Overdrawn - Insufficient funds for upcoming bills',
  };

  console.log(`Cash Flow Health: ${statusEmoji[reservation.health_status]} ${reservation.health_status.toUpperCase()}`);
  console.log(`  ${statusMessage[reservation.health_status]}`);
  console.log('');

  console.log('='.repeat(70));
  console.log('');
}

main().catch((error) => {
  console.error('Error calculating cash reservation:', error);
  process.exit(1);
});
