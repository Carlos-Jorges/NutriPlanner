// Web version: browsers do not get scheduled reminders in this prototype.
// The phone version lives in notifier.native.ts (Metro picks it automatically).

import type { PlannedReminder } from '@/core/reminders';

export const notifierSupported = false;

export function configureNotifier(): void {}

export async function hasPermission(): Promise<boolean> {
  return false;
}

export async function requestPermission(): Promise<boolean> {
  return false;
}

export async function replaceSchedule(_reminders: readonly PlannedReminder[]): Promise<void> {}

export async function clearSchedule(): Promise<void> {}
