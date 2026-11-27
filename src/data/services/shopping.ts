// Shopping list: manual lines, lines generated from what was used, and
// putting bought food away into fridges.

import { AppError } from '@/core/errors';
import { cleanName } from '@/core/names';
import { planShoppingFromConsumption } from '@/core/shopping';
import type { Consumption, ShoppingCategory, ShoppingItem, Unit } from '@/core/types';
import { isUnit, roundQty } from '@/core/units';
import { paths, type Store, type WriteOp } from '../store';
import type { Actor } from './groups';
import { validateItem } from './storage';

/** Firestore allows 500 writes per batch. */
const BATCH_LIMIT = 450;

async function commitInChunks(store: Store, ops: readonly WriteOp[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    await store.batch(ops.slice(i, i + BATCH_LIMIT));
  }
}

export interface ShoppingInput {
  name: string;
  quantity: number;
  unit: Unit;
  category: ShoppingCategory;
}

export async function addShoppingItem(store: Store, groupId: string, actor: Actor, input: ShoppingInput) {
  const name = cleanName(input.name);
  if (!name) throw new AppError('validation', 'Name the item.');
  if (!(input.quantity > 0)) throw new AppError('validation', 'Enter a quantity above zero.');
  if (!isUnit(input.unit)) throw new AppError('validation', 'Choose a unit.');
  await store.set(paths.shoppingItem(groupId, store.newId(paths.shopping(groupId))), {
    name,
    quantity: roundQty(input.quantity),
    unit: input.unit,
    category: input.category,
    source: 'manual',
    checked: false,
    addedBy: actor.uid,
    addedByName: actor.displayName,
    addedAt: Date.now(),
  });
}

export async function setChecked(store: Store, groupId: string, id: string, checked: boolean): Promise<void> {
  await store.update(paths.shoppingItem(groupId, id), { checked });
}

export async function removeShoppingItem(store: Store, groupId: string, id: string): Promise<void> {
  await store.remove(paths.shoppingItem(groupId, id));
}

/** Turns everything used since the last run into shopping lines. */
export async function generateFromUsed(
  store: Store,
  groupId: string,
  actor: Actor,
  consumptions: readonly Consumption[],
  shopping: readonly ShoppingItem[],
): Promise<{ added: number; updated: number }> {
  const plan = planShoppingFromConsumption(consumptions, shopping);
  if (plan.consumptionIds.length === 0) return { added: 0, updated: 0 };
  const now = Date.now();
  const ops: WriteOp[] = [
    ...plan.creates.map((line) => ({
      type: 'set' as const,
      path: paths.shoppingItem(groupId, store.newId(paths.shopping(groupId))),
      data: { ...line, source: 'auto', checked: false, addedBy: actor.uid, addedByName: actor.displayName, addedAt: now },
    })),
    ...plan.updates.map((update) => ({
      type: 'update' as const,
      path: paths.shoppingItem(groupId, update.id),
      data: { quantity: update.quantity, unit: update.unit },
    })),
    ...plan.consumptionIds.map((id) => ({
      type: 'update' as const,
      path: paths.consumption(groupId, id),
      data: { listed: true },
    })),
  ];
  await commitInChunks(store, ops);
  return { added: plan.creates.length, updated: plan.updates.length };
}

export interface PutAwayLine {
  shoppingId: string;
  name: string;
  fridgeId: string;
  quantity: number;
  unit: Unit;
  alertAfterDays: number;
}

/** After shopping: bought lines become fridge items stored today, and leave the list. */
export async function putAway(store: Store, groupId: string, actor: Actor, lines: readonly PutAwayLine[]) {
  if (lines.length === 0) return;
  const now = Date.now();
  const ops: WriteOp[] = [];
  for (const line of lines) {
    validateItem({ ...line, notes: '', daysAlreadyStored: 0 });
    ops.push({
      type: 'set',
      path: paths.item(groupId, store.newId(paths.items(groupId))),
      data: {
        fridgeId: line.fridgeId,
        name: cleanName(line.name),
        quantity: roundQty(line.quantity),
        unit: line.unit,
        storedAt: now,
        alertAfterDays: line.alertAfterDays,
        status: 'stored',
        defrostStartedAt: null,
        addedBy: actor.uid,
        addedByName: actor.displayName,
        notes: '',
      },
    });
    ops.push({ type: 'delete', path: paths.shoppingItem(groupId, line.shoppingId) });
  }
  await commitInChunks(store, ops);
}

/** For ticked lines that are not food storage (or were not bought). */
export async function clearChecked(store: Store, groupId: string, items: readonly ShoppingItem[]) {
  await commitInChunks(
    store,
    items.filter((i) => i.checked).map((i) => ({ type: 'delete' as const, path: paths.shoppingItem(groupId, i.id) })),
  );
}
