/**
 * Timezone utilities for America/Los_Angeles (Pacific time)
 * All date calculations in the app should use these functions
 */

const LA_TIMEZONE = 'America/Los_Angeles';

/**
 * Get today's date in LA timezone as YYYY-MM-DD string
 */
export function getTodayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: LA_TIMEZONE });
}

/**
 * Get current month in LA timezone as YYYY-MM string
 */
export function getCurrentMonthLA(): string {
  return getTodayLA().substring(0, 7);
}

/**
 * Get a Date object representing "now" in LA timezone
 * Note: The returned Date is still in local system time,
 * but its values reflect LA time
 */
export function getNowLA(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: LA_TIMEZONE }));
}

/**
 * Get the current ISO timestamp adjusted for LA timezone
 */
export function getISOTimestampLA(): string {
  return getNowLA().toISOString();
}

/**
 * Check if a cached timestamp is older than the specified hours in LA time
 */
export function isOlderThanHours(timestamp: string, hours: number): boolean {
  const cachedTime = new Date(timestamp).getTime();
  const nowLA = getNowLA().getTime();
  const hoursDiff = (nowLA - cachedTime) / (1000 * 60 * 60);
  return hoursDiff > hours;
}

/**
 * Check if a date string (YYYY-MM-DD) matches today in LA timezone
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayLA();
}
