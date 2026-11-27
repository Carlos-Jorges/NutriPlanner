// Defrost planning. Defrost time lives on the recipe (agreed decision), so
// the planner never has to work it out per meal: take out time is simply
// the meal time minus the recipe's defrost hours.

import { addDays, DAY_MS, HOUR_MS, mealDateTime, type MealTimes, startOfDay } from './dates';
import { nameMatchScore } from './names';
import { sortFifo } from './storage-alerts';
import type { Fridge, FridgeItem, Ingredient, Meal, Recipe } from './types';

export const OVERNIGHT_FROM_HOUR = 22;
export const OVERNIGHT_UNTIL_HOUR = 7;
export const EVENING_REMINDER_HOUR = 21;

export function takeOutTime(mealAt: Date, defrostHours: number): Date {
  return new Date(mealAt.getTime() - defrostHours * HOUR_MS);
}

/**
 * Nobody takes chicken out at 3 am. Take out times that land between
 * 10 pm and 7 am move to 9 pm the evening before. Defrosting a few hours
 * longer in the fridge is safe; defrosting for less time is not.
 */
export function reminderTime(takeOut: Date): Date {
  const hour = takeOut.getHours();
  if (hour >= OVERNIGHT_FROM_HOUR) {
    return new Date(takeOut.getFullYear(), takeOut.getMonth(), takeOut.getDate(), EVENING_REMINDER_HOUR, 0);
  }
  if (hour < OVERNIGHT_UNTIL_HOUR) {
    const previous = addDays(startOfDay(takeOut), -1);
    return new Date(previous.getFullYear(), previous.getMonth(), previous.getDate(), EVENING_REMINDER_HOUR, 0);
  }
  return takeOut;
}

export type DefrostStatus = 'upcoming' | 'due' | 'done';

export interface DefrostPick {
  ingredient: Ingredient;
  item: FridgeItem;
  fridge: Fridge | null;
  alreadyDefrosting: boolean;
}

export interface DefrostTask {
  meal: Meal;
  recipe: Recipe;
  mealAt: Date;
  takeOutAt: Date;
  remindAt: Date;
  status: DefrostStatus;
  /** Suggested items, oldest first, each item allocated to one meal only. */
  picks: DefrostPick[];
}

export interface DefrostPlanInput {
  meals: readonly Meal[];
  recipes: readonly Recipe[];
  items: readonly FridgeItem[];
  fridges: readonly Fridge[];
  times: MealTimes;
  now: number;
  horizonDays?: number;
}

function bestMatch(pool: readonly FridgeItem[], ingredient: Ingredient, used: ReadonlySet<string>): FridgeItem | null {
  let best: FridgeItem | null = null;
  let bestScore = 0;
  for (const item of pool) {
    if (used.has(item.id)) continue;
    const score = nameMatchScore(ingredient.name, item.name);
    if (score > bestScore) {
      best = item;
      bestScore = score;
      if (score === 2) break; // pool is oldest first, so the first exact match wins
    }
  }
  return best;
}

export function buildDefrostPlan(input: DefrostPlanInput): DefrostTask[] {
  const { meals, recipes, items, fridges, times, now } = input;
  const horizonEnd = now + (input.horizonDays ?? 7) * DAY_MS;
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const fridgeById = new Map(fridges.map((f) => [f.id, f]));

  const inFreezer = sortFifo(
    items.filter((i) => i.status === 'stored' && fridgeById.get(i.fridgeId)?.kind === 'freezer'),
  );
  const defrosting = sortFifo(items.filter((i) => i.status === 'defrosting'));

  const candidates = meals
    .filter((meal) => meal.status === 'confirmed' && meal.recipeId !== null)
    .flatMap((meal) => {
      const recipe = recipeById.get(meal.recipeId as string);
      if (!recipe || recipe.defrostHours <= 0) return [];
      const mealAt = mealDateTime(meal.date, meal.slot, times);
      if (mealAt.getTime() <= now || mealAt.getTime() > horizonEnd) return [];
      const takeOutAt = takeOutTime(mealAt, recipe.defrostHours);
      return [{ meal, recipe, mealAt, takeOutAt, remindAt: reminderTime(takeOutAt) }];
    })
    .sort((a, b) => a.takeOutAt.getTime() - b.takeOutAt.getTime());

  const used = new Set<string>();
  return candidates.map((candidate) => {
    const picks: DefrostPick[] = [];
    for (const ingredient of candidate.recipe.ingredients) {
      const item = bestMatch(defrosting, ingredient, used) ?? bestMatch(inFreezer, ingredient, used);
      if (!item) continue;
      used.add(item.id);
      picks.push({
        ingredient,
        item,
        fridge: fridgeById.get(item.fridgeId) ?? null,
        alreadyDefrosting: item.status === 'defrosting',
      });
    }
    let status: DefrostStatus = 'upcoming';
    if (picks.length > 0 && picks.every((p) => p.alreadyDefrosting)) status = 'done';
    else if (now >= candidate.takeOutAt.getTime()) status = 'due';
    return { ...candidate, status, picks };
  });
}
