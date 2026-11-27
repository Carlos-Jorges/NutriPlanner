// Fridges and the items inside them.

import { DAY_MS } from '@/core/dates';
import { AppError } from '@/core/errors';
import { cleanName, normaliseName } from '@/core/names';
import { categoryForStorage } from '@/core/shopping';
import type { Fridge, FridgeItem, StorageKind, TakeOutPurpose, Unit } from '@/core/types';
import { convertQuantity, isUnit, roundQty } from '@/core/units';
import { paths, type Store } from '../store';
import type { Actor } from './groups';

export const MAX_ALERT_DAYS = 730;

export interface FridgeInput {
  name: string;
  kind: StorageKind;
  defaultAlertDays: number;
}

function assertAlertDays(days: number): void {
  if (!Number.isInteger(days) || days < 1 || days > MAX_ALERT_DAYS) {
    throw new AppError('validation', `Alert days must be a whole number from 1 to ${MAX_ALERT_DAYS}.`);
  }
}

export async function saveFridge(
  store: Store,
  groupId: string,
  actor: Actor,
  input: FridgeInput,
  existingId?: string,
): Promise<string> {
  const name = cleanName(input.name);
  if (!name) throw new AppError('validation', 'Give this fridge a name.');
  assertAlertDays(input.defaultAlertDays);
  if (existingId) {
    await store.update(paths.fridge(groupId, existingId), {
      name,
      kind: input.kind,
      defaultAlertDays: input.defaultAlertDays,
    });
    return existingId;
  }
  const id = store.newId(paths.fridges(groupId));
  await store.set(paths.fridge(groupId, id), {
    name,
    kind: input.kind,
    defaultAlertDays: input.defaultAlertDays,
    createdAt: Date.now(),
    createdBy: actor.uid,
  });
  return id;
}

export async function deleteFridge(
  store: Store,
  groupId: string,
  fridgeId: string,
  items: readonly FridgeItem[],
): Promise<void> {
  if (items.some((item) => item.fridgeId === fridgeId)) throw new AppError('fridge-not-empty');
  await store.remove(paths.fridge(groupId, fridgeId));
}

export interface ItemInput {
  fridgeId: string;
  name: string;
  quantity: number;
  unit: Unit;
  alertAfterDays: number;
  notes: string;
  /** For logging food that was already in storage before using the app. */
  daysAlreadyStored: number;
}

export function validateItem(input: ItemInput): void {
  if (!input.fridgeId) throw new AppError('validation', 'Choose where this is stored.');
  if (!cleanName(input.name)) throw new AppError('validation', 'Name the item.');
  if (!(input.quantity > 0)) throw new AppError('validation', 'Enter a quantity above zero.');
  if (!isUnit(input.unit)) throw new AppError('validation', 'Choose a unit.');
  assertAlertDays(input.alertAfterDays);
  if (!Number.isInteger(input.daysAlreadyStored) || input.daysAlreadyStored < 0 || input.daysAlreadyStored > 3650) {
    throw new AppError('validation', 'Days already stored must be a whole number, 0 or more.');
  }
}

/** Any member can add items: whoever unpacks the shopping logs it. */
export async function addItem(store: Store, groupId: string, actor: Actor, input: ItemInput): Promise<string> {
  validateItem(input);
  const id = store.newId(paths.items(groupId));
  await store.set(paths.item(groupId, id), {
    fridgeId: input.fridgeId,
    name: cleanName(input.name),
    quantity: roundQty(input.quantity),
    unit: input.unit,
    storedAt: Date.now() - input.daysAlreadyStored * DAY_MS,
    alertAfterDays: input.alertAfterDays,
    status: 'stored',
    defrostStartedAt: null,
    addedBy: actor.uid,
    addedByName: actor.displayName,
    notes: input.notes.trim(),
  });
  return id;
}

/** Admins only (enforced by the rules). The storage date is never edited, to keep the order honest. */
export async function updateItem(
  store: Store,
  groupId: string,
  itemId: string,
  input: Omit<ItemInput, 'daysAlreadyStored'>,
): Promise<void> {
  validateItem({ ...input, daysAlreadyStored: 0 });
  await store.update(paths.item(groupId, itemId), {
    fridgeId: input.fridgeId,
    name: cleanName(input.name),
    quantity: roundQty(input.quantity),
    unit: input.unit,
    alertAfterDays: input.alertAfterDays,
    notes: input.notes.trim(),
  });
}

export async function deleteItem(store: Store, groupId: string, itemId: string): Promise<void> {
  await store.remove(paths.item(groupId, itemId));
}

/**
 * Takes an amount out of an item:
 *   defrost  the amount moves to "defrosting" (split off if partial)
 *   use      logged as used, so it appears in "Add what was used" on the shopping list
 *   discard  logged as thrown out, never added to the shopping list
 * Runs as a transaction so two admins cannot take the same food twice.
 */
export async function takeOut(
  store: Store,
  groupId: string,
  actor: Actor,
  itemId: string,
  fridge: Fridge | undefined,
  purpose: TakeOutPurpose,
  amount: number,
): Promise<void> {
  if (!(amount > 0)) throw new AppError('validation', 'Enter an amount above zero.');
  const itemPath = paths.item(groupId, itemId);
  await store.transaction(async (tx) => {
    const current = await tx.get<FridgeItem>(itemPath);
    if (!current) throw new AppError('not-found');
    const taken = roundQty(Math.min(amount, current.quantity));
    const remaining = roundQty(current.quantity - taken);
    const now = Date.now();

    if (purpose === 'defrost') {
      if (current.status === 'defrosting') return;
      if (remaining <= 0) {
        tx.update(itemPath, { status: 'defrosting', defrostStartedAt: now });
      } else {
        const { id: _id, ...rest } = current;
        tx.update(itemPath, { quantity: remaining });
        tx.set(paths.item(groupId, store.newId(paths.items(groupId))), {
          ...rest,
          quantity: taken,
          status: 'defrosting',
          defrostStartedAt: now,
        });
      }
      return;
    }

    if (remaining <= 0) tx.delete(itemPath);
    else tx.update(itemPath, { quantity: remaining });

    tx.set(paths.consumption(groupId, store.newId(paths.consumptions(groupId))), {
      itemName: current.name,
      normalisedName: normaliseName(current.name),
      quantity: taken,
      unit: current.unit,
      category: categoryForStorage(fridge?.kind ?? 'fridge'),
      fridgeId: current.fridgeId,
      fridgeName: fridge?.name ?? '',
      consumedAt: now,
      consumedBy: actor.uid,
      consumedByName: actor.displayName,
      reason: purpose === 'use' ? 'used' : 'discarded',
      listed: purpose !== 'use',
    });
  });
}

/** Amount of an item a recipe needs, in the item's own unit. Whole item if units differ. */
export function amountForRecipe(item: FridgeItem, quantity: number, unit: Unit): number {
  const converted = convertQuantity(quantity, unit, item.unit);
  return converted === null ? item.quantity : Math.min(item.quantity, converted);
}
