// Shopping list generation from what was used. Each used item becomes a
// line in the same category it came from: freezer items are "frozen"
// (bought to freeze), fridge items are "fresh" (bought for this week).
// Repeated uses of the same thing are added up, and lines that are still
// open on the list are topped up instead of duplicated.

import { normaliseName } from './names';
import { fromBase, toBase, type UnitFamily, unitFamily } from './units';
import type { Consumption, ShoppingCategory, ShoppingItem, StorageKind, Unit } from './types';

export function categoryForStorage(kind: StorageKind): ShoppingCategory {
  return kind === 'freezer' ? 'frozen' : 'fresh';
}

export function shoppingKey(name: string, unit: Unit, category: ShoppingCategory): string {
  return `${normaliseName(name)}|${unitFamily(unit)}|${category}`;
}

export interface NewShoppingLine {
  name: string;
  quantity: number;
  unit: Unit;
  category: ShoppingCategory;
}

export interface ShoppingPlan {
  creates: NewShoppingLine[];
  updates: { id: string; quantity: number; unit: Unit }[];
  /** Consumption entries to mark as listed. */
  consumptionIds: string[];
}

export function pendingConsumptions(consumptions: readonly Consumption[]): Consumption[] {
  return consumptions.filter((c) => c.reason === 'used' && !c.listed);
}

export function planShoppingFromConsumption(
  consumptions: readonly Consumption[],
  existing: readonly ShoppingItem[],
): ShoppingPlan {
  const pending = pendingConsumptions(consumptions);
  const totals = new Map<
    string,
    { name: string; amount: number; family: UnitFamily; category: ShoppingCategory; latest: number }
  >();

  for (const c of pending) {
    const key = shoppingKey(c.itemName, c.unit, c.category);
    const { amount, family } = toBase(c.quantity, c.unit);
    const total = totals.get(key);
    if (total) {
      total.amount += amount;
      if (c.consumedAt > total.latest) {
        total.name = c.itemName;
        total.latest = c.consumedAt;
      }
    } else {
      totals.set(key, { name: c.itemName, amount, family, category: c.category, latest: c.consumedAt });
    }
  }

  const openAuto = new Map(
    existing
      .filter((s) => s.source === 'auto' && !s.checked)
      .map((s) => [shoppingKey(s.name, s.unit, s.category), s] as const),
  );

  const creates: NewShoppingLine[] = [];
  const updates: ShoppingPlan['updates'] = [];
  for (const [key, total] of totals) {
    const open = openAuto.get(key);
    if (open) {
      const base = toBase(open.quantity, open.unit).amount + total.amount;
      updates.push({ id: open.id, ...fromBase(base, total.family) });
    } else {
      creates.push({ name: total.name, category: total.category, ...fromBase(total.amount, total.family) });
    }
  }
  creates.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return { creates, updates, consumptionIds: pending.map((c) => c.id) };
}

/** Unchecked first, then alphabetical. */
export function sortShopping(items: readonly ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
}

export function splitByCategory(items: readonly ShoppingItem[]): Record<ShoppingCategory, ShoppingItem[]> {
  return {
    fresh: sortShopping(items.filter((i) => i.category === 'fresh')),
    frozen: sortShopping(items.filter((i) => i.category === 'frozen')),
  };
}
