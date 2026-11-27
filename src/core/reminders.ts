// Works out which phone notifications an admin's device should schedule.
// On the free Firebase plan there is no server to send pushes, so each
// admin's phone schedules these locally from the shared data.

import { buildDefrostPlan } from './defrost';
import { dayKey, type MealTimes, weekdayName } from './dates';
import { storageAlert } from './storage-alerts';
import { formatQuantity } from './units';
import type { Fridge, FridgeItem, Meal, Recipe } from './types';

/** iOS keeps at most 64 scheduled notifications per app; stay well under. */
export const MAX_SCHEDULED = 60;
export const MORNING_HOUR = 8;
export const MORNING_MINUTE = 30;
export const LATEST_HOUR = 21;

export interface PlannedReminder {
  id: string;
  kind: 'storage' | 'defrost';
  at: number;
  title: string;
  body: string;
}

/** Storage alerts fire in waking hours: 8:30 am at the earliest, before 9 pm. */
export function storageReminderTime(alertAt: number): number {
  const d = new Date(alertAt);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < MORNING_HOUR * 60 + MORNING_MINUTE) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), MORNING_HOUR, MORNING_MINUTE).getTime();
  }
  if (d.getHours() >= LATEST_HOUR) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, MORNING_HOUR, MORNING_MINUTE).getTime();
  }
  return alertAt;
}

/** "Milk", "Milk and spinach", "Milk, spinach and 2 more" */
export function listNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export interface ReminderInput {
  items: readonly FridgeItem[];
  fridges: readonly Fridge[];
  meals: readonly Meal[];
  recipes: readonly Recipe[];
  times: MealTimes;
  now: number;
  max?: number;
}

export function buildReminders(input: ReminderInput): PlannedReminder[] {
  const { items, now } = input;
  const reminders: PlannedReminder[] = [];

  // Storage alerts, one notification per day.
  const byDay = new Map<string, { at: number; names: string[] }>();
  for (const item of items) {
    const alert = storageAlert(item, now);
    if (alert.alertAt <= now) continue; // already due: the app shows it, no notification needed
    const at = storageReminderTime(alert.alertAt);
    const key = dayKey(new Date(at));
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.at = Math.min(bucket.at, at);
      bucket.names.push(item.name);
    } else {
      byDay.set(key, { at, names: [item.name] });
    }
  }
  for (const [key, bucket] of byDay) {
    const one = bucket.names.length === 1;
    reminders.push({
      id: `storage-${key}`,
      kind: 'storage',
      at: bucket.at,
      title: 'Use soon',
      body: `${listNames(bucket.names)} ${one ? 'has' : 'have'} reached ${one ? 'its' : 'their'} storage time. Plan ${one ? 'it' : 'them'} into a meal.`,
    });
  }

  // Defrost take out reminders.
  const plan = buildDefrostPlan({ ...input, horizonDays: 14 });
  for (const task of plan) {
    if (task.status === 'done' || task.remindAt.getTime() <= now) continue;
    const what =
      task.picks.length > 0
        ? listNames(
            task.picks
              .filter((p) => !p.alreadyDefrosting)
              .map((p) => `${p.item.name} (${formatQuantity(p.ingredient.quantity, p.ingredient.unit)})`),
          )
        : 'the frozen ingredients';
    reminders.push({
      id: `defrost-${task.meal.id}`,
      kind: 'defrost',
      at: task.remindAt.getTime(),
      title: `Defrost for ${weekdayName(task.mealAt)} ${task.meal.slot}`,
      body: `Take out ${what} for ${task.recipe.name}.`,
    });
  }

  return reminders.sort((a, b) => a.at - b.at).slice(0, input.max ?? MAX_SCHEDULED);
}
