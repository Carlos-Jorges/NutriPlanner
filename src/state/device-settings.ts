// Small per device preferences (not shared with the family), such as
// whether this phone should schedule reminders.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<(value: string | null) => void>>();

async function read(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const value = await AsyncStorage.getItem(key);
    cache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

export async function writeSetting(key: string, value: string | null): Promise<void> {
  cache.set(key, value);
  listeners.get(key)?.forEach((listener) => listener(value));
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // Not persisted; the in memory value still applies this session.
  }
}

/** Returns undefined until the stored value has been read. */
export function useSetting(key: string): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(() => (cache.has(key) ? cache.get(key) : undefined));
  useEffect(() => {
    let active = true;
    void read(key).then((v) => {
      if (active) setValue(v);
    });
    const set = listeners.get(key) ?? new Set();
    set.add(setValue);
    listeners.set(key, set);
    return () => {
      active = false;
      set.delete(setValue);
    };
  }, [key]);
  return value;
}

export const SETTINGS = {
  reminders: 'nutriplanner.reminders',
} as const;
