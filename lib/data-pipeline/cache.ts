import db from '../db';
import { getLastDataChange, getCurrentMonth } from './events';

/**
 * Invalidate all caches affected by data changes
 */
export function invalidateDependentCaches(affectedMonths: string[]): void {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = getCurrentMonth();

  // Always invalidate today's briefing if current month is affected
  if (affectedMonths.includes(currentMonth)) {
    db.prepare('DELETE FROM daily_briefings WHERE date = ?').run(today);
  }

  // Mark recurring expenses as needing refresh
  db.prepare(`
    INSERT OR REPLACE INTO system_state (key, value, updated_at)
    VALUES ('recurring_expenses_stale_since', ?, datetime('now'))
  `).run(new Date().toISOString());
}

/**
 * Check if briefing needs refresh based on data changes
 */
export function briefingNeedsRefresh(cachedAt: string | null): boolean {
  if (!cachedAt) return true;

  const lastChange = getLastDataChange();
  if (!lastChange) return false;

  return new Date(lastChange) > new Date(cachedAt);
}

/**
 * Get cached briefing with generated_at timestamp
 */
export function getCachedBriefing(date: string): { briefing_json: string; generated_at: string } | null {
  const result = db.prepare(`
    SELECT briefing_json, generated_at FROM daily_briefings WHERE date = ?
  `).get(date) as { briefing_json: string; generated_at: string } | undefined;

  return result || null;
}

/**
 * Get system state value
 */
export function getSystemState(key: string): string | null {
  const result = db.prepare(`
    SELECT value FROM system_state WHERE key = ?
  `).get(key) as { value: string } | undefined;

  return result?.value || null;
}

/**
 * Set system state value
 */
export function setSystemState(key: string, value: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO system_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `).run(key, value);
}

/**
 * Clear system state key
 */
export function clearSystemState(key: string): void {
  db.prepare('DELETE FROM system_state WHERE key = ?').run(key);
}
