import type { Consumption, Fridge, FridgeItem, Meal, Recipe, ShoppingItem } from '../types';

export const at = (y: number, month: number, d: number, h = 0, min = 0) =>
  new Date(y, month - 1, d, h, min).getTime();

export function fridge(overrides: Partial<Fridge> = {}): Fridge {
  return {
    id: 'fridge1',
    name: 'Kitchen fridge',
    kind: 'fridge',
    defaultAlertDays: 3,
    createdAt: 0,
    createdBy: 'u1',
    ...overrides,
  };
}

export function item(overrides: Partial<FridgeItem> = {}): FridgeItem {
  return {
    id: 'item1',
    fridgeId: 'fridge1',
    name: 'Milk',
    quantity: 1,
    unit: 'l',
    storedAt: at(2026, 11, 20, 9),
    alertAfterDays: 3,
    status: 'stored',
    defrostStartedAt: null,
    addedBy: 'u1',
    addedByName: 'Alex',
    notes: '',
    ...overrides,
  };
}

export function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe1',
    name: 'Chicken stir fry',
    ingredients: [{ name: 'Chicken thighs', quantity: 500, unit: 'g' }],
    defrostHours: 24,
    notes: '',
    status: 'approved',
    proposedBy: 'u1',
    proposedByName: 'Alex',
    createdAt: 0,
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  };
}

export function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal1',
    date: '2026-11-26',
    slot: 'dinner',
    recipeId: 'recipe1',
    title: 'Chicken stir fry',
    status: 'confirmed',
    proposedBy: 'u1',
    proposedByName: 'Alex',
    createdAt: 0,
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  };
}

export function consumption(overrides: Partial<Consumption> = {}): Consumption {
  return {
    id: 'c1',
    itemName: 'Milk',
    normalisedName: 'milk',
    quantity: 1,
    unit: 'l',
    category: 'fresh',
    fridgeId: 'fridge1',
    fridgeName: 'Kitchen fridge',
    consumedAt: at(2026, 11, 24, 8),
    consumedBy: 'u1',
    consumedByName: 'Alex',
    reason: 'used',
    listed: false,
    ...overrides,
  };
}

export function shoppingItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: 's1',
    name: 'Milk',
    quantity: 1,
    unit: 'l',
    category: 'fresh',
    source: 'auto',
    checked: false,
    addedBy: 'u1',
    addedByName: 'Alex',
    addedAt: 0,
    ...overrides,
  };
}
