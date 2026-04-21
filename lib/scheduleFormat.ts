import type { FastSchedule } from '../stores/userStore';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 0-23 → "12 AM", "1 AM", …, "12 PM", "11 PM" */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

/** Compact day summary: "Daily", "Weekdays", "Weekends", or "Mon, Wed, Fri". */
export function formatDays(days: number[]): string {
  if (days.length === 0) return 'No days';
  if (days.length === 7) return 'Daily';
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(',');
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return sorted.map(d => DAY_SHORT[d]).join(', ');
}

/** Subtitle for the Fast schedule row. */
export function formatScheduleSubtitle(schedule: FastSchedule | null): string {
  if (!schedule || !schedule.enabled) return 'Auto-start on selected days';
  if (schedule.days.length === 0) return 'Choose days to auto-start';
  return `${formatDays(schedule.days)} at ${formatHour(schedule.hour)}`;
}
