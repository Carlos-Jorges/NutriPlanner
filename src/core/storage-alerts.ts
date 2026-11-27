// Storage alerts: when an item has been stored for the number of days an
// admin set, it needs using. Items taken out to defrost get their own,
// shorter clock.

import { DAY_MS, wholeDaysBetween } from './dates';
import type { FridgeItem } from './types';

export type AlertLevel = 'ok' | 'soon' | 'due';

/**
 * Days a defrosted item can wait in the fridge before cooking.
 * USDA guidance for food thawed in the refrigerator: poultry, mince and
 * seafood 1 to 2 days, red meat cuts 3 to 5 days. We use the stricter figure.
 */
export const DEFROSTED_USE_WITHIN_DAYS = 2;

export interface StorageAlert {
  level: AlertLevel;
  /** When the alert fires (epoch ms). */
  alertAt: number;
  /** Whole days since storage (or since defrosting started). */
  daysStored: number;
  /** Clock length in days. */
  limitDays: number;
  /** 0 when stored, 1 at the alert point, above 1 when overdue. */
  progress: number;
}

export function alertClock(item: FridgeItem): { start: number; limitDays: number } {
  if (item.status === 'defrosting' && item.defrostStartedAt !== null) {
    return { start: item.defrostStartedAt, limitDays: DEFROSTED_USE_WITHIN_DAYS };
  }
  return { start: item.storedAt, limitDays: Math.max(1, item.alertAfterDays) };
}

export function storageAlert(item: FridgeItem, now: number): StorageAlert {
  const { start, limitDays } = alertClock(item);
  const windowMs = limitDays * DAY_MS;
  const alertAt = start + windowMs;
  // "Soon" covers the final day, or the final quarter for short windows.
  const soonMs = Math.min(DAY_MS, windowMs * 0.25);
  let level: AlertLevel = 'ok';
  if (now >= alertAt) level = 'due';
  else if (now >= alertAt - soonMs) level = 'soon';
  return {
    level,
    alertAt,
    daysStored: wholeDaysBetween(start, now),
    limitDays,
    progress: Math.max(0, (now - start) / windowMs),
  };
}

/** First in, first out: oldest storage date first, then name. */
export function sortFifo<T extends Pick<FridgeItem, 'storedAt' | 'name'>>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.storedAt - b.storedAt || a.name.localeCompare(b.name));
}

/** Items at "soon" or "due", most urgent first. */
export function itemsNeedingAttention(items: readonly FridgeItem[], now: number): FridgeItem[] {
  return items
    .map((item) => ({ item, alert: storageAlert(item, now) }))
    .filter(({ alert }) => alert.level !== 'ok')
    .sort(
      (a, b) =>
        a.alert.alertAt - b.alert.alertAt ||
        a.item.storedAt - b.item.storedAt ||
        a.item.name.localeCompare(b.item.name),
    )
    .map(({ item }) => item);
}

/** Short human text for an item's storage clock. */
export function describeAlert(item: FridgeItem, now: number): string {
  const alert = storageAlert(item, now);
  const day = alert.daysStored + 1;
  if (item.status === 'defrosting') {
    return alert.level === 'due' ? 'Defrosted 2+ days ago: cook or throw out' : `Defrosting, day ${day}`;
  }
  if (alert.level === 'due') {
    const over = wholeDaysBetween(alert.alertAt, now);
    return over === 0 ? 'Use today' : `Over by ${over} ${over === 1 ? 'day' : 'days'}`;
  }
  return `Day ${day} of ${alert.limitDays}`;
}
