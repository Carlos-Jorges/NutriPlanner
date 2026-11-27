// Keeps this phone's scheduled reminders in step with the group's data.
// Only admins get reminders (storage alerts and defrost take out times),
// and only once they have switched them on for this device.

import { useEffect, useRef } from 'react';

import { buildReminders } from '@/core/reminders';
import { useGroupData } from './group-data';
import { clearSchedule, configureNotifier, hasPermission, notifierSupported, replaceSchedule } from './notifier';
import { SETTINGS, useSetting } from './device-settings';

export function useReminderSync(): void {
  const { ready, isAdmin, items, fridges, meals, recipes, group } = useGroupData();
  const enabled = useSetting(SETTINGS.reminders) === 'on';
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!notifierSupported) return;
    configureNotifier();
  }, []);

  useEffect(() => {
    if (!notifierSupported || !ready || !group) return;
    if (!enabled || !isAdmin) {
      if (lastSignature.current !== 'off') {
        lastSignature.current = 'off';
        void clearSchedule().catch(() => undefined);
      }
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (!(await hasPermission())) return;
        const reminders = buildReminders({
          items,
          fridges,
          meals,
          recipes,
          times: { lunchTime: group.lunchTime, dinnerTime: group.dinnerTime },
          now: Date.now(),
        });
        const signature = JSON.stringify(reminders.map((r) => [r.id, r.at, r.body]));
        if (signature === lastSignature.current) return;
        lastSignature.current = signature;
        await replaceSchedule(reminders);
      } catch {
        lastSignature.current = null; // try again on the next change
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, enabled, isAdmin, items, fridges, meals, recipes, group]);
}
