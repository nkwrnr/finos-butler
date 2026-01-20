import db from '../db';
import { Priority, ConfidenceLevel, Severity } from './types';
import { getTodayLA, getNowLA } from '../utils/timezone';

export interface UpcomingBill {
  merchant: string;
  due_date: string;
  predicted_amount: number;
  priority: Priority;
  confidence: ConfidenceLevel;
  days_until_due: number;
}

export interface CashReservation {
  checking_balance: number;
  days_ahead: number;
  upcoming_bills: UpcomingBill[];
  total_bills_count: number;
  total_reserved: number;
  reserved_by_priority: {
    essential: number;
    important: number;
    discretionary: number;
  };
  true_available_cash: number;
  conservative_available_cash: number;
  health_status: 'healthy' | 'tight' | 'overdrawn';
}

/**
 * Calculate cash reservation for upcoming bills
 */
export function calculateCashReservation(checkingBalance: number, daysAhead: number = 14): CashReservation {
  const today = getTodayLA();
  const cutoffDate = getNowLA();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Get all tracked recurring expenses with predicted dates in the next N days
  const upcomingBillsData = db
    .prepare(
      `
    SELECT
      merchant_display_name,
      next_predicted_date,
      next_predicted_amount,
      priority,
      prediction_confidence
    FROM recurring_expenses
    WHERE user_excluded = 0
      AND tracked = 1
      AND next_predicted_date IS NOT NULL
      AND next_predicted_date >= ?
      AND next_predicted_date <= ?
    ORDER BY next_predicted_date ASC
  `
    )
    .all(today, cutoffDateStr) as Array<{
    merchant_display_name: string;
    next_predicted_date: string;
    next_predicted_amount: number;
    priority: string;
    prediction_confidence: string;
  }>;

  // Calculate days until due for each bill
  const upcomingBills: UpcomingBill[] = upcomingBillsData.map((bill) => {
    const dueDate = new Date(bill.next_predicted_date);
    const todayDate = new Date(today);
    const daysUntilDue = Math.floor((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      merchant: bill.merchant_display_name,
      due_date: bill.next_predicted_date,
      predicted_amount: bill.next_predicted_amount,
      priority: bill.priority as Priority,
      confidence: bill.prediction_confidence as ConfidenceLevel,
      days_until_due: daysUntilDue,
    };
  });

  // Calculate total reserved
  const totalReserved = upcomingBills.reduce((sum, bill) => sum + bill.predicted_amount, 0);

  // Calculate by priority
  const byPriority = {
    essential: upcomingBills.filter((b) => b.priority === 'essential').reduce((sum, b) => sum + b.predicted_amount, 0),
    important: upcomingBills.filter((b) => b.priority === 'important').reduce((sum, b) => sum + b.predicted_amount, 0),
    discretionary: upcomingBills
      .filter((b) => b.priority === 'discretionary')
      .reduce((sum, b) => sum + b.predicted_amount, 0),
  };

  // True available cash (after all bills)
  const trueAvailable = checkingBalance - totalReserved;

  // Conservative available (after essential + important bills only)
  const conservativeReserved = byPriority.essential + byPriority.important;
  const conservativeAvailable = checkingBalance - conservativeReserved;

  // Determine health status
  let healthStatus: 'healthy' | 'tight' | 'overdrawn';
  if (trueAvailable > 1000) {
    healthStatus = 'healthy';
  } else if (trueAvailable > 0) {
    healthStatus = 'tight';
  } else {
    healthStatus = 'overdrawn';
  }

  return {
    checking_balance: checkingBalance,
    days_ahead: daysAhead,
    upcoming_bills: upcomingBills,
    total_bills_count: upcomingBills.length,
    total_reserved: totalReserved,
    reserved_by_priority: byPriority,
    true_available_cash: trueAvailable,
    conservative_available_cash: conservativeAvailable,
    health_status: healthStatus,
  };
}
