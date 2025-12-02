/**
 * Utility functions for consistent timezone handling
 * All timestamps are stored in UTC (ISO format) in the database
 * Display functions convert to Georgia time (UTC+4)
 */

export const GEORGIA_TIMEZONE = 'Asia/Tbilisi';

/**
 * Convert UTC timestamp to Georgia time string
 */
export function toGeorgiaTime(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;

  return date.toLocaleString('ka-GE', {
    timeZone: GEORGIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Convert UTC timestamp to Georgia time (Date object)
 */
export function toGeorgiaDate(utcTimestamp: string | Date): Date {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  const georgiaTimeString = date.toLocaleString('en-US', { timeZone: GEORGIA_TIMEZONE });
  return new Date(georgiaTimeString);
}

/**
 * Get current time in UTC (for storage)
 */
export function getCurrentUTC(): string {
  return new Date().toISOString();
}

/**
 * Get current time formatted for Georgia display
 */
export function getCurrentGeorgiaTime(): string {
  return toGeorgiaTime(new Date());
}

/**
 * Calculate time ago from UTC timestamp
 */
export function getTimeAgo(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

/**
 * Format timestamp for display (Georgia time + time ago)
 */
export function formatTimestamp(utcTimestamp: string | Date): {
  georgiaTime: string;
  timeAgo: string;
  utc: string;
} {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;

  return {
    georgiaTime: toGeorgiaTime(date),
    timeAgo: getTimeAgo(date),
    utc: date.toISOString()
  };
}