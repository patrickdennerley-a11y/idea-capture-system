import type { TimePeriod } from '../types';

// Re-export for backward compatibility
export type { TimePeriod };

export function formatTime(date: string | number | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(date: string | number | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | number | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTodayString(): string {
  const isoString = new Date().toISOString().split('T')[0];
  if (!isoString) {
    throw new Error('Failed to generate today string');
  }
  return isoString;
}

export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}

export function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}
