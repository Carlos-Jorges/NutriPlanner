// Recipes and the meal calendar, including the approval flow:
// admins add directly; members propose, and an admin approves or declines.

import { isDayKey } from '@/core/dates';
import { AppError } from '@/core/errors';
import { cleanName } from '@/core/names';
import type { Ingredient, Meal, Recipe, Slot } from '@/core/types';
import { isUnit, roundQty } from '@/core/units';
import { paths, type Store, type WriteOp } from '../store';
import type { Actor } from './groups';

export const MAX_DEFROST_HOURS = 72;

export interface RecipeInput {
  name: string;
  ingredients: Ingredient[];
  defrostHours: number;
  notes: string;
}

export function cleanRecipe(input: RecipeInput): RecipeInput {
  const name = cleanName(input.name);
  if (!name) throw new AppError('validation', 'Name the recipe.');
  const ingredients = input.ingredients
    .map((i) => ({ ...i, name: cleanName(i.name) }))
    .filter((i) => i.name.length > 0);
  if (ingredients.length === 0) throw new AppError('validation', 'Add at least one ingredient.');
  for (const i of ingredients) {
    if (!(i.quantity > 0) || !isUnit(i.unit)) {
      throw new AppError('validation', `Give "${i.name}" a quantity and unit.`);
    }
  }
  if (!Number.isInteger(input.defrostHours) || input.defrostHours < 0 || input.defrostHours > MAX_DEFROST_HOURS) {
    throw new AppError('validation', `Defrost time must be 0 to ${MAX_DEFROST_HOURS} hours.`);
  }
  return {
    name,
    ingredients: ingredients.map((i) => ({ name: i.name, quantity: roundQty(i.quantity), unit: i.unit })),
    defrostHours: input.defrostHours,
    notes: input.notes.trim(),
  };
}

export async function saveRecipe(
  store: Store,
  groupId: string,
  actor: Actor,
  isAdmin: boolean,
  input: RecipeInput,
  existing?: Recipe,
): Promise<string> {
  const recipe = cleanRecipe(input);
  if (existing) {
    await store.update(paths.recipe(groupId, existing.id), { ...recipe });
    return existing.id;
  }
  const id = store.newId(paths.recipes(groupId));
  const now = Date.now();
  await store.set(paths.recipe(groupId, id), {
    ...recipe,
    status: isAdmin ? 'approved' : 'pending',
    proposedBy: actor.uid,
    proposedByName: actor.displayName,
    createdAt: now,
    reviewedBy: isAdmin ? actor.uid : null,
    reviewedAt: isAdmin ? now : null,
  });
  return id;
}

export async function reviewRecipe(
  store: Store,
  groupId: string,
  actor: Actor,
  recipe: Recipe,
  decision: 'approved' | 'rejected',
): Promise<void> {
  await store.update(paths.recipe(groupId, recipe.id), {
    status: decision,
    reviewedBy: actor.uid,
    reviewedAt: Date.now(),
  });
}

export async function deleteRecipe(store: Store, groupId: string, recipeId: string): Promise<void> {
  await store.remove(paths.recipe(groupId, recipeId));
}

export interface MealInput {
  date: string;
  slot: Slot;
  recipeId: string | null;
  title: string;
}

export async function planMeal(
  store: Store,
  groupId: string,
  actor: Actor,
  isAdmin: boolean,
  input: MealInput,
): Promise<string> {
  if (!isDayKey(input.date)) throw new AppError('validation', 'Choose a day.');
  const title = cleanName(input.title);
  if (!title) throw new AppError('validation', 'Choose a recipe or type what you are eating.');
  const id = store.newId(paths.meals(groupId));
  const now = Date.now();
  await store.set(paths.meal(groupId, id), {
    date: input.date,
    slot: input.slot,
    recipeId: input.recipeId,
    title,
    status: isAdmin ? 'confirmed' : 'proposed',
    proposedBy: actor.uid,
    proposedByName: actor.displayName,
    createdAt: now,
    reviewedBy: isAdmin ? actor.uid : null,
    reviewedAt: isAdmin ? now : null,
  });
  return id;
}

/** Approving a meal that uses a proposed recipe approves the recipe too. */
export async function reviewMeal(
  store: Store,
  groupId: string,
  actor: Actor,
  meal: Meal,
  decision: 'confirmed' | 'rejected',
  recipe: Recipe | null,
): Promise<void> {
  const now = Date.now();
  const ops: WriteOp[] = [
    { type: 'update', path: paths.meal(groupId, meal.id), data: { status: decision, reviewedBy: actor.uid, reviewedAt: now } },
  ];
  if (decision === 'confirmed' && recipe && recipe.status === 'pending') {
    ops.push({
      type: 'update',
      path: paths.recipe(groupId, recipe.id),
      data: { status: 'approved', reviewedBy: actor.uid, reviewedAt: now },
    });
  }
  await store.batch(ops);
}

export async function deleteMeal(store: Store, groupId: string, mealId: string): Promise<void> {
  await store.remove(paths.meal(groupId, mealId));
}
