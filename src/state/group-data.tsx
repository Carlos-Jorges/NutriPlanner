// Live data for the active group. One listener per collection, shared by
// every screen, so the whole family sees changes as they happen.

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { addDays, dayKey, startOfDay } from '@/core/dates';
import type { AppError } from '@/core/errors';
import type { Consumption, Fridge, FridgeItem, Group, Meal, Member, Recipe, Role, ShoppingItem } from '@/core/types';
import { forgetGroup } from '@/data/services/groups';
import { paths, type WhereClause } from '@/data/store';
import { useBackend } from './backend-context';
import { useSession } from './session';

export interface GroupData {
  groupId: string | null;
  ready: boolean;
  group: Group | null;
  members: Member[];
  fridges: Fridge[];
  items: FridgeItem[];
  consumptions: Consumption[];
  shopping: ShoppingItem[];
  recipes: Recipe[];
  meals: Meal[];
  me: Member | null;
  role: Role | null;
  isAdmin: boolean;
  /** Current time, refreshed every minute, so alert levels stay current. */
  now: number;
}

interface Collections {
  group: Group | null;
  members: Member[];
  fridges: Fridge[];
  items: FridgeItem[];
  consumptions: Consumption[];
  shopping: ShoppingItem[];
  recipes: Recipe[];
  meals: Meal[];
}

const EMPTY: Collections = {
  group: null,
  members: [],
  fridges: [],
  items: [],
  consumptions: [],
  shopping: [],
  recipes: [],
  meals: [],
};

const GroupDataContext = createContext<GroupData | null>(null);

/** Retries after a join or create, when the membership write may not have reached the server yet. */
const RETRY_DELAYS = [800, 1600, 3200];

/** Data is tagged with the group it belongs to, so switching groups never shows stale data. */
interface Loaded extends Collections {
  groupId: string | null;
  groupLoaded: boolean;
  membersLoaded: boolean;
}

const blank = (groupId: string | null): Loaded => ({ ...EMPTY, groupId, groupLoaded: false, membersLoaded: false });

export function GroupDataProvider({ children }: { children: ReactNode }) {
  const { store } = useBackend();
  const { activeGroupId: groupId, profile, user } = useSession();
  const [data, setData] = useState<Loaded>(() => blank(null));
  const [retry, setRetry] = useState<{ groupId: string | null; attempt: number }>({ groupId: null, attempt: 0 });
  const [now, setNow] = useState(() => Date.now());
  const attempt = retry.groupId === groupId ? retry.attempt : 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    let handled = false;

    const update = (patch: Partial<Loaded>) => {
      if (!cancelled) setData((d) => ({ ...(d.groupId === groupId ? d : blank(groupId)), ...patch }));
    };

    const onGroupError = (error: AppError) => {
      if (cancelled || handled || error.code !== 'permission-denied') return;
      handled = true;
      if (attempt < RETRY_DELAYS.length) {
        setTimeout(() => {
          if (!cancelled) setRetry({ groupId, attempt: attempt + 1 });
        }, RETRY_DELAYS[attempt]);
      } else if (profile) {
        // Removed from the group by an admin: drop it from this profile.
        void forgetGroup(store, profile, groupId);
      }
    };
    const ignore = () => undefined;

    const listen = <K extends keyof Collections>(key: K, path: string, where: WhereClause[] = []) =>
      store.onCollection<never>(
        path,
        where,
        (docs) => update({ [key]: docs, ...(key === 'members' ? { membersLoaded: true } : {}) } as Partial<Loaded>),
        key === 'members' ? onGroupError : ignore,
      );

    const mealsFrom = dayKey(addDays(startOfDay(new Date()), -28));
    const unsubscribers = [
      store.onDoc<Group>(paths.group(groupId), (group) => update({ group, groupLoaded: true }), onGroupError),
      listen('members', paths.members(groupId)),
      listen('fridges', paths.fridges(groupId)),
      listen('items', paths.items(groupId)),
      listen('consumptions', paths.consumptions(groupId), [['listed', '==', false]]),
      listen('shopping', paths.shopping(groupId)),
      listen('recipes', paths.recipes(groupId)),
      listen('meals', paths.meals(groupId), [['date', '>=', mealsFrom]]),
    ];
    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // profile is read only for the removal case; resubscribing on every profile change is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, groupId, attempt]);

  const current = groupId !== null && data.groupId === groupId ? data : blank(groupId);
  const me = current.members.find((m) => m.uid === user?.uid) ?? null;
  const ready = groupId !== null && current.groupLoaded && current.group !== null && current.membersLoaded;

  const value: GroupData = {
    groupId,
    ready,
    group: current.group,
    members: current.members,
    fridges: current.fridges,
    items: current.items,
    consumptions: current.consumptions,
    shopping: current.shopping,
    recipes: current.recipes,
    meals: current.meals,
    me,
    role: me?.role ?? null,
    isAdmin: me?.role === 'admin',
    now,
  };

  return <GroupDataContext.Provider value={value}>{children}</GroupDataContext.Provider>;
}

export function useGroupData(): GroupData {
  const value = useContext(GroupDataContext);
  if (!value) throw new Error('useGroupData must be used inside GroupDataProvider');
  return value;
}

/** Renders children only once the active group has loaded. */
export function GroupGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { ready } = useGroupData();
  return <>{ready ? children : fallback}</>;
}

/** For components rendered inside GroupGate. */
export function useGroup() {
  const data = useGroupData();
  if (!data.ready || !data.group || !data.groupId) throw new Error('Group not loaded');
  return { ...data, group: data.group, groupId: data.groupId };
}
