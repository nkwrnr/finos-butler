import db from '../db';

export type DataEvent =
  | 'transactions_imported'
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_deleted'
  | 'transactions_categorized'
  | 'balance_updated'
  | 'goal_created'
  | 'goal_updated'
  | 'goal_deleted'
  | 'zcash_logged';

export interface DataChange {
  event: DataEvent;
  timestamp: string;
  affectedAccounts?: number[];
  affectedMonths?: string[];
  metadata?: Record<string, unknown>;
}

export interface DataChangeRecord {
  id: number;
  event: string;
  timestamp: string;
  affected_accounts: string | null;
  affected_months: string | null;
  metadata: string | null;
  processed: number;
}

/**
 * Log a data change event
 */
export function logDataChange(change: DataChange): void {
  db.prepare(`
    INSERT INTO data_changes (event, timestamp, affected_accounts, affected_months, metadata, processed)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(
    change.event,
    change.timestamp,
    change.affectedAccounts ? JSON.stringify(change.affectedAccounts) : null,
    change.affectedMonths ? JSON.stringify(change.affectedMonths) : null,
    change.metadata ? JSON.stringify(change.metadata) : null
  );
}

/**
 * Get the timestamp of the most recent data change
 */
export function getLastDataChange(): string | null {
  const result = db.prepare(`
    SELECT timestamp FROM data_changes
    ORDER BY timestamp DESC
    LIMIT 1
  `).get() as { timestamp: string } | undefined;

  return result?.timestamp || null;
}

/**
 * Get recent data changes for debugging/monitoring
 */
export function getRecentDataChanges(limit: number = 10): DataChangeRecord[] {
  return db.prepare(`
    SELECT * FROM data_changes
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as DataChangeRecord[];
}

/**
 * Extract unique months from a list of dates
 */
export function getUniqueMonths(dates: string[]): string[] {
  const months = new Set<string>();
  for (const date of dates) {
    if (date && date.length >= 7) {
      months.add(date.slice(0, 7));
    }
  }
  return Array.from(months);
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
