// Date helpers. Everything works in the phone's local time zone, because a
// family plans "Thursday dinner", not a UTC instant. Never use toISOString()
// for calendar days: in Sydney (UTC+11) it shifts the date backwards.

import type { Slot } from './types';

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight for a "YYYY-MM-DD" key. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return dayKey(parseDayKey(value)) === value;
}

/** Adds calendar days (safe across daylight saving changes). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // Monday = 0
  return addDays(day, -offset);
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isValidTime(hhmm: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return match !== null;
}

export function parseTime(hhmm: string): { hours: number; minutes: number } {
  if (!isValidTime(hhmm)) throw new Error(`Invalid time "${hhmm}"`);
  const [hours, minutes] = hhmm.split(':').map(Number);
  return { hours, minutes };
}

export interface MealTimes {
  lunchTime: string;
  dinnerTime: string;
}

export const DEFAULT_MEAL_TIMES: MealTimes = { lunchTime: '12:30', dinnerTime: '18:30' };

/** The moment a meal is eaten: its day plus the group's lunch or dinner time. */
export function mealDateTime(date: string, slot: Slot, times: MealTimes): Date {
  const { hours, minutes } = parseTime(slot === 'lunch' ? times.lunchTime : times.dinnerTime);
  const day = parseDayKey(date);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

/** Whole days elapsed between two instants (floored, never negative). */
export function wholeDaysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

/** "12 Nov" */
export function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Thu 14" */
export function formatDayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

export function weekdayName(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

/** "6:30 pm" */
export function formatTime(date: Date): string {
  const h = date.getHours();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(date.getMinutes())} ${suffix}`;
}

/** "6:30 pm" from "18:30" */
export function formatClock(hhmm: string): string {
  const { hours, minutes } = parseTime(hhmm);
  return formatTime(new Date(2000, 0, 1, hours, minutes));
}

/** "Today 6:30 pm", "Tomorrow 9:00 am", "Wed 6:30 pm" (this week) or "12 Nov 6:30 pm". */
export function formatWhen(ms: number, now: number): string {
  const target = new Date(ms);
  const today = startOfDay(new Date(now));
  const diffDays = Math.round((startOfDay(target).getTime() - today.getTime()) / DAY_MS);
  const time = formatTime(target);
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  if (diffDays > 1 && diffDays < 7) return `${WEEKDAYS[target.getDay()]} ${time}`;
  return `${formatShortDate(ms)} ${time}`;
}

/** formatWhen for the middle of a sentence: "was due yesterday 6:30 pm". */
export function formatWhenInSentence(ms: number, now: number): string {
  return formatWhen(ms, now).replace(/^(Today|Tomorrow|Yesterday)/, (word) => word.toLowerCase());
}

/** "Thu 14 Nov" */
export function formatLongDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Week range label: "11 to 17 Nov" or "28 Oct to 3 Nov". */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.getDate()} to ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} to ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}
