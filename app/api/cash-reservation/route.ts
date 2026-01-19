import { NextRequest, NextResponse } from 'next/server';
import { calculateCashReservation } from '@/lib/recurring-expenses/cash-reservation';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysAhead = parseInt(searchParams.get('days') || '14');
    const balanceOverride = searchParams.get('balance');

    // Get current checking balance
    let checkingBalance = 0;

    if (balanceOverride) {
      checkingBalance = parseFloat(balanceOverride);
    } else {
      const account = db
        .prepare(
          `
        SELECT balance FROM accounts
        WHERE name LIKE '%Wells%' OR name LIKE '%Checking%'
        LIMIT 1
      `
        )
        .get() as { balance: number } | undefined;

      checkingBalance = account?.balance || 0;
    }

    const reservation = calculateCashReservation(checkingBalance, daysAhead);

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error calculating cash reservation:', error);
    return NextResponse.json({ error: `Failed to calculate cash reservation: ${error}` }, { status: 500 });
  }
}
