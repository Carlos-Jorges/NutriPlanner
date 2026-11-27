// Sample family data for demo mode. Everything is relative to "now", so the
// demo always shows a realistic mix: something overdue, something to use
// soon, a defrost to do right now, and a meal waiting for approval.

import { addDays, dayKey, DAY_MS, HOUR_MS, startOfDay } from '@/core/dates';
import { normaliseName } from '@/core/names';
import type { Ingredient, ShoppingCategory, Slot, Unit } from '@/core/types';
import { DEMO_SESSION_PATH, demoAccountPath } from './demo-auth';
import { paths, type DocData } from './store';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_INVITE_CODE = 'KTCH42';
const G = 'demo-family';

export const DEMO_PEOPLE = {
  alex: { uid: 'demo_alex', name: 'Alex', role: 'admin', email: 'alex@demo.nutriplanner.app' },
  sam: { uid: 'demo_sam', name: 'Sam', role: 'admin', email: 'sam@demo.nutriplanner.app' },
  mia: { uid: 'demo_mia', name: 'Mia', role: 'member', email: 'mia@demo.nutriplanner.app' },
  leo: { uid: 'demo_leo', name: 'Leo', role: 'member', email: 'leo@demo.nutriplanner.app' },
} as const;

export function buildDemoSeed(now = Date.now()): Record<string, DocData> {
  const docs: Record<string, DocData> = {};
  const put = (path: string, data: DocData) => {
    docs[path] = data;
  };
  const today = startOfDay(new Date(now));
  const ago = (days: number, hours = 0) => now - days * DAY_MS - hours * HOUR_MS;
  const day = (offset: number) => dayKey(addDays(today, offset));
  const { alex, sam, mia } = DEMO_PEOPLE;

  // People
  Object.values(DEMO_PEOPLE).forEach((p, index) => {
    put(demoAccountPath(p.uid), { email: p.email, password: DEMO_PASSWORD, displayName: p.name });
    put(paths.user(p.uid), {
      displayName: p.name,
      email: p.email,
      createdAt: ago(120),
      groupIds: [G],
      activeGroupId: G,
    });
    put(paths.member(G, p.uid), {
      uid: p.uid,
      displayName: p.name,
      role: p.role,
      joinedAt: ago(120 - index),
      inviteCode: index === 0 ? null : 'SETUP2',
    });
  });

  // Group and its open invite
  put(paths.group(G), {
    name: 'Family kitchen',
    createdBy: alex.uid,
    createdAt: ago(120),
    lunchTime: '12:30',
    dinnerTime: '18:30',
    inviteCode: DEMO_INVITE_CODE,
    inviteExpiresAt: now + 7 * DAY_MS,
  });
  put(paths.invite(DEMO_INVITE_CODE), {
    groupId: G,
    groupName: 'Family kitchen',
    createdBy: alex.uid,
    createdAt: now,
    expiresAt: now + 7 * DAY_MS,
  });

  // Storage
  const fridges = [
    { id: 'kitchen', name: 'Kitchen fridge', kind: 'fridge', defaultAlertDays: 4 },
    { id: 'garage', name: 'Garage freezer', kind: 'freezer', defaultAlertDays: 90 },
    { id: 'drawer', name: 'Freezer drawer', kind: 'freezer', defaultAlertDays: 60 },
  ];
  fridges.forEach((f) =>
    put(paths.fridge(G, f.id), {
      name: f.name,
      kind: f.kind,
      defaultAlertDays: f.defaultAlertDays,
      createdAt: ago(120),
      createdBy: alex.uid,
    }),
  );

  type SeedItem = [id: string, fridge: string, name: string, qty: number, unit: Unit, storedDaysAgo: number, alertDays: number, by?: typeof alex | typeof sam | typeof mia, extraHours?: number];
  const items: SeedItem[] = [
    ['milk', 'kitchen', 'Milk', 2, 'l', 5, 5, sam],
    ['spinach', 'kitchen', 'Baby spinach', 200, 'g', 3, 4, mia, 8],
    ['yoghurt', 'kitchen', 'Greek yoghurt', 1, 'kg', 2, 10],
    ['eggs', 'kitchen', 'Eggs', 10, 'pcs', 6, 21, mia],
    ['cheddar', 'kitchen', 'Cheddar', 250, 'g', 12, 14],
    ['thighs-old', 'garage', 'Chicken thighs', 1, 'kg', 95, 90],
    ['mince-old', 'garage', 'Beef mince', 500, 'g', 40, 90, sam],
    ['mince-new', 'garage', 'Beef mince', 500, 'g', 10, 90],
    ['salmon', 'garage', 'Salmon fillets', 4, 'pcs', 20, 60],
    ['peas', 'garage', 'Frozen peas', 1, 'kg', 30, 180, mia],
    ['bread', 'drawer', 'Sourdough loaf', 1, 'pack', 7, 30],
    ['prawns', 'drawer', 'Prawns', 500, 'g', 15, 60, sam],
    ['thighs-new', 'drawer', 'Chicken thighs', 500, 'g', 25, 90],
  ];
  for (const [id, fridgeId, name, quantity, unit, daysAgo, alertAfterDays, by = alex, extraHours = 0] of items) {
    put(paths.item(G, id), {
      fridgeId,
      name,
      quantity,
      unit,
      storedAt: ago(daysAgo, extraHours),
      alertAfterDays,
      status: 'stored',
      defrostStartedAt: null,
      addedBy: by.uid,
      addedByName: by.name,
      notes: '',
    });
  }
  put(paths.item(G, 'pork'), {
    fridgeId: 'garage',
    name: 'Pork chops',
    quantity: 4,
    unit: 'pcs',
    storedAt: ago(50),
    alertAfterDays: 90,
    status: 'defrosting',
    defrostStartedAt: ago(0, 20),
    addedBy: alex.uid,
    addedByName: alex.name,
    notes: '',
  });

  // Recipes
  const ing = (name: string, quantity: number, unit: Unit): Ingredient => ({ name, quantity, unit });
  const recipes: [string, string, number, Ingredient[], string, 'approved' | 'pending', typeof alex | typeof mia][] = [
    ['stirfry', 'Chicken stir fry', 24, [ing('Chicken thighs', 500, 'g'), ing('Broccoli', 1, 'pcs'), ing('Jasmine rice', 300, 'g')], 'Slice the chicken thinly so it cooks fast.', 'approved', alex],
    ['ragu', 'Beef ragu', 24, [ing('Beef mince', 500, 'g'), ing('Tinned tomatoes', 2, 'pcs'), ing('Onion', 1, 'pcs')], 'Doubles well. Freeze half for another night.', 'approved', alex],
    ['salmon', 'Salmon traybake', 12, [ing('Salmon fillets', 4, 'pcs'), ing('Potatoes', 800, 'g'), ing('Green beans', 300, 'g')], '', 'approved', alex],
    ['frittata', 'Spinach frittata', 0, [ing('Eggs', 8, 'pcs'), ing('Baby spinach', 200, 'g'), ing('Feta', 150, 'g')], 'Good way to use up spinach before it turns.', 'approved', alex],
    ['pork', 'Pork chops with apple slaw', 24, [ing('Pork chops', 4, 'pcs'), ing('Green apples', 2, 'pcs'), ing('Cabbage', 1, 'pcs')], '', 'approved', alex],
    ['tacos', 'Prawn tacos', 12, [ing('Prawns', 500, 'g'), ing('Tortillas', 1, 'pack'), ing('Avocado', 2, 'pcs')], 'Mia: can we have these on Friday?', 'pending', mia],
  ];
  for (const [id, name, defrostHours, ingredients, notes, status, by] of recipes) {
    put(paths.recipe(G, id), {
      name,
      ingredients,
      defrostHours,
      notes,
      status,
      proposedBy: by.uid,
      proposedByName: by.name,
      createdAt: ago(60),
      reviewedBy: status === 'approved' ? alex.uid : null,
      reviewedAt: status === 'approved' ? ago(59) : null,
    });
  }

  // Meals. The stir fry lands within 24 hours, so its defrost is due now.
  const tonight = today.getTime() + 18.5 * HOUR_MS;
  const stirFry: [string, Slot] = now < tonight - HOUR_MS ? [day(0), 'dinner'] : [day(1), 'lunch'];
  const meals: [string, string, Slot, string | null, string, 'confirmed' | 'proposed', typeof alex | typeof mia][] = [
    ['m-past', day(-1), 'dinner', 'ragu', 'Beef ragu', 'confirmed', alex],
    ['m-stirfry', stirFry[0], stirFry[1], 'stirfry', 'Chicken stir fry', 'confirmed', alex],
    ['m-pork', day(1), 'dinner', 'pork', 'Pork chops with apple slaw', 'confirmed', alex],
    ['m-frittata', day(2), 'dinner', 'frittata', 'Spinach frittata', 'confirmed', alex],
    ['m-ragu', day(3), 'dinner', 'ragu', 'Beef ragu', 'confirmed', alex],
    ['m-tacos', day(4), 'dinner', 'tacos', 'Prawn tacos', 'proposed', mia],
    ['m-salmon', day(5), 'dinner', 'salmon', 'Salmon traybake', 'confirmed', alex],
  ];
  if (stirFry[1] !== 'lunch') meals.push(['m-leftovers', day(1), 'lunch', null, 'Leftovers', 'confirmed', alex]);
  for (const [id, date, slot, recipeId, title, status, by] of meals) {
    put(paths.meal(G, id), {
      date,
      slot,
      recipeId,
      title,
      status,
      proposedBy: by.uid,
      proposedByName: by.name,
      createdAt: ago(3),
      reviewedBy: status === 'confirmed' ? alex.uid : null,
      reviewedAt: status === 'confirmed' ? ago(3) : null,
    });
  }

  // What was used this week (feeds "Add what was used")
  const used: [string, string, number, Unit, ShoppingCategory, string, number, 'used' | 'discarded'][] = [
    ['u-milk', 'Milk', 2, 'l', 'fresh', 'kitchen', 2, 'used'],
    ['u-eggs', 'Eggs', 6, 'pcs', 'fresh', 'kitchen', 3, 'used'],
    ['u-bananas', 'Bananas', 6, 'pcs', 'fresh', 'kitchen', 1, 'used'],
    ['u-mince', 'Beef mince', 500, 'g', 'frozen', 'garage', 1, 'used'],
    ['u-thighs', 'Chicken thighs', 500, 'g', 'frozen', 'drawer', 4, 'used'],
    ['u-coriander', 'Coriander', 1, 'pcs', 'fresh', 'kitchen', 2, 'discarded'],
  ];
  const fridgeName = Object.fromEntries(fridges.map((f) => [f.id, f.name]));
  for (const [id, itemName, quantity, unit, category, fridgeId, daysAgo, reason] of used) {
    put(paths.consumption(G, id), {
      itemName,
      normalisedName: normaliseName(itemName),
      quantity,
      unit,
      category,
      fridgeId,
      fridgeName: fridgeName[fridgeId],
      consumedAt: ago(daysAgo),
      consumedBy: alex.uid,
      consumedByName: alex.name,
      reason,
      listed: reason === 'discarded',
    });
  }

  // Shopping list
  const shopping: [string, string, number, Unit, ShoppingCategory, boolean, typeof sam | typeof mia][] = [
    ['s-lemons', 'Lemons', 3, 'pcs', 'fresh', false, mia],
    ['s-tortillas', 'Tortillas', 1, 'pack', 'fresh', false, mia],
    ['s-berries', 'Frozen berries', 1, 'kg', 'frozen', false, sam],
    ['s-carrots', 'Carrots', 1, 'kg', 'fresh', true, sam],
  ];
  for (const [id, name, quantity, unit, category, checked, by] of shopping) {
    put(paths.shoppingItem(G, id), {
      name,
      quantity,
      unit,
      category,
      source: 'manual',
      checked,
      addedBy: by.uid,
      addedByName: by.name,
      addedAt: ago(1),
    });
  }

  // Nobody is signed in to start with.
  delete docs[DEMO_SESSION_PATH];
  return docs;
}
