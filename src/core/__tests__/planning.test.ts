import { buildDefrostPlan, reminderTime, takeOutTime } from '../defrost';
import { DAY_MS } from '../dates';
import { buildReminders, listNames, storageReminderTime } from '../reminders';
import { planShoppingFromConsumption, splitByCategory } from '../shopping';
import { describeAlert, itemsNeedingAttention, sortFifo, storageAlert } from '../storage-alerts';
import { at, consumption, fridge, item, meal, recipe, shoppingItem } from './fixtures';

const times = { lunchTime: '12:30', dinnerTime: '18:30' };
const freezer = fridge({ id: 'freezer1', name: 'Garage freezer', kind: 'freezer', defaultAlertDays: 90 });
const kitchen = fridge();

describe('storage alerts', () => {
  const stored = item({ storedAt: at(2026, 11, 20, 9), alertAfterDays: 3 }); // alert at 23 Nov 9 am

  it('is ok early, soon on the final day, due once the set time is reached', () => {
    expect(storageAlert(stored, at(2026, 11, 21, 9)).level).toBe('ok');
    // The "soon" window for a 3 day clock is the final 18 hours.
    expect(storageAlert(stored, at(2026, 11, 22, 14)).level).toBe('ok');
    expect(storageAlert(stored, at(2026, 11, 22, 16)).level).toBe('soon');
    expect(storageAlert(stored, at(2026, 11, 23, 9)).level).toBe('due');
    expect(storageAlert(stored, at(2026, 11, 23, 9)).alertAt).toBe(at(2026, 11, 23, 9));
  });

  it('describes the clock in words', () => {
    expect(describeAlert(stored, at(2026, 11, 21, 10))).toBe('Day 2 of 3');
    expect(describeAlert(stored, at(2026, 11, 23, 12))).toBe('Use today');
    expect(describeAlert(stored, at(2026, 11, 25, 12))).toBe('Over by 2 days');
  });

  it('gives defrosting items a two day clock from when defrosting started', () => {
    const thawing = item({ status: 'defrosting', defrostStartedAt: at(2026, 11, 24, 18), alertAfterDays: 90 });
    expect(storageAlert(thawing, at(2026, 11, 25, 18)).level).toBe('ok');
    expect(storageAlert(thawing, at(2026, 11, 26, 18)).level).toBe('due');
  });

  it('sorts first in, first out and lists urgent items first', () => {
    const a = item({ id: 'a', name: 'Yoghurt', storedAt: at(2026, 11, 22) });
    const b = item({ id: 'b', name: 'Milk', storedAt: at(2026, 11, 18) });
    const c = item({ id: 'c', name: 'Butter', storedAt: at(2026, 11, 18) });
    expect(sortFifo([a, b, c]).map((i) => i.id)).toEqual(['c', 'b', 'a']);
    // b and c are overdue (tie broken first in, first out); a is in its final hours.
    expect(itemsNeedingAttention([a, b, c], at(2026, 11, 24, 12)).map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(itemsNeedingAttention([a, b, c], at(2026, 11, 24, 0)).map((i) => i.id)).toEqual(['c', 'b']);
  });
});

describe('defrost planning', () => {
  it('subtracts the recipe defrost hours from the meal time', () => {
    expect(takeOutTime(new Date(at(2026, 11, 27, 18, 30)), 24).getTime()).toBe(at(2026, 11, 26, 18, 30));
  });

  it('moves overnight take out times to 9 pm the evening before', () => {
    expect(reminderTime(new Date(at(2026, 11, 27, 6, 30))).getTime()).toBe(at(2026, 11, 26, 21));
    expect(reminderTime(new Date(at(2026, 11, 27, 23, 0))).getTime()).toBe(at(2026, 11, 27, 21));
    expect(reminderTime(new Date(at(2026, 11, 27, 7, 0))).getTime()).toBe(at(2026, 11, 27, 7));
  });

  it('suggests the oldest matching freezer item and never allocates it twice', () => {
    const older = item({ id: 'old', fridgeId: 'freezer1', name: 'Chicken thighs', unit: 'g', quantity: 500, storedAt: at(2026, 9, 1) });
    const newer = item({ id: 'new', fridgeId: 'freezer1', name: 'Chicken thighs', unit: 'g', quantity: 500, storedAt: at(2026, 11, 1) });
    const inFridge = item({ id: 'fresh', fridgeId: 'fridge1', name: 'Chicken thighs', storedAt: at(2026, 8, 1) });
    const plan = buildDefrostPlan({
      meals: [meal({ id: 'm1', date: '2026-11-27' }), meal({ id: 'm2', date: '2026-11-28' })],
      recipes: [recipe()],
      items: [newer, inFridge, older],
      fridges: [kitchen, freezer],
      times,
      now: at(2026, 11, 26, 9),
    });
    expect(plan.map((t) => t.picks.map((p) => p.item.id))).toEqual([['old'], ['new']]);
    expect(plan[0].takeOutAt.getTime()).toBe(at(2026, 11, 26, 18, 30));
    expect(plan[0].status).toBe('upcoming');
  });

  it('marks tasks due after the take out time and done once defrosting', () => {
    const frozen = item({ id: 'f', fridgeId: 'freezer1', name: 'Chicken thighs' });
    const input = {
      meals: [meal({ date: '2026-11-27' })],
      recipes: [recipe()],
      fridges: [kitchen, freezer],
      times,
      now: at(2026, 11, 26, 19),
    };
    expect(buildDefrostPlan({ ...input, items: [frozen] })[0].status).toBe('due');
    const thawing = { ...frozen, status: 'defrosting' as const, defrostStartedAt: at(2026, 11, 26, 18, 30) };
    expect(buildDefrostPlan({ ...input, items: [thawing] })[0].status).toBe('done');
  });

  it('ignores proposed meals, past meals and recipes without defrost time', () => {
    const plan = buildDefrostPlan({
      meals: [
        meal({ id: 'proposed', status: 'proposed', date: '2026-11-27' }),
        meal({ id: 'past', date: '2026-11-20' }),
        meal({ id: 'nodefrost', recipeId: 'r0', date: '2026-11-27' }),
      ],
      recipes: [recipe(), recipe({ id: 'r0', defrostHours: 0 })],
      items: [],
      fridges: [freezer],
      times,
      now: at(2026, 11, 26, 9),
    });
    expect(plan).toEqual([]);
  });
});

describe('shopping list generation', () => {
  it('adds up repeated uses, converts units and keeps fresh and frozen apart', () => {
    const plan = planShoppingFromConsumption(
      [
        consumption({ id: 'c1', itemName: 'Beef mince', unit: 'g', quantity: 500, category: 'frozen' }),
        consumption({ id: 'c2', itemName: 'beef mince', unit: 'kg', quantity: 0.75, category: 'frozen' }),
        consumption({ id: 'c3', itemName: 'Milk', unit: 'l', quantity: 2 }),
        consumption({ id: 'c4', itemName: 'Milk', unit: 'ml', quantity: 500 }),
        consumption({ id: 'c5', itemName: 'Coriander', unit: 'pcs', quantity: 1, reason: 'discarded', listed: true }),
        consumption({ id: 'c6', itemName: 'Bread', unit: 'pack', quantity: 1, listed: true }),
      ],
      [],
    );
    expect(plan.creates).toEqual([
      { name: 'Milk', quantity: 2.5, unit: 'l', category: 'fresh' },
      { name: 'Beef mince', quantity: 1.25, unit: 'kg', category: 'frozen' },
    ]);
    expect(plan.consumptionIds.sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('tops up an open auto line instead of duplicating it', () => {
    const plan = planShoppingFromConsumption(
      [consumption({ quantity: 1, unit: 'l' })],
      [shoppingItem({ id: 'open', quantity: 500, unit: 'ml' }), shoppingItem({ id: 'ticked', checked: true })],
    );
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([{ id: 'open', quantity: 1.5, unit: 'l' }]);
  });

  it('splits the list by category with unticked lines first', () => {
    const split = splitByCategory([
      shoppingItem({ id: 'a', name: 'Bananas', checked: true }),
      shoppingItem({ id: 'b', name: 'Yoghurt' }),
      shoppingItem({ id: 'c', name: 'Peas', category: 'frozen' }),
    ]);
    expect(split.fresh.map((s) => s.id)).toEqual(['b', 'a']);
    expect(split.frozen.map((s) => s.id)).toEqual(['c']);
  });
});

describe('reminders', () => {
  it('keeps storage reminders in waking hours', () => {
    expect(storageReminderTime(at(2026, 11, 27, 3))).toBe(at(2026, 11, 27, 8, 30));
    expect(storageReminderTime(at(2026, 11, 27, 14))).toBe(at(2026, 11, 27, 14));
    expect(storageReminderTime(at(2026, 11, 27, 22))).toBe(at(2026, 11, 28, 8, 30));
  });

  it('joins names naturally', () => {
    expect(listNames(['Milk'])).toBe('Milk');
    expect(listNames(['Milk', 'Eggs'])).toBe('Milk and Eggs');
    expect(listNames(['Milk', 'Eggs', 'Kale', 'Feta'])).toBe('Milk, Eggs and 2 more');
  });

  it('groups storage alerts per day and adds defrost reminders, soonest first', () => {
    const now = at(2026, 11, 26, 9);
    const reminders = buildReminders({
      items: [
        item({ id: 'a', name: 'Milk', storedAt: now - 2 * DAY_MS, alertAfterDays: 3 }),
        item({ id: 'b', name: 'Spinach', storedAt: now - 2 * DAY_MS + 3_600_000, alertAfterDays: 3 }),
        item({ id: 'c', name: 'Chicken thighs', fridgeId: 'freezer1', storedAt: now - 10 * DAY_MS, alertAfterDays: 90 }),
        item({ id: 'd', name: 'Old cheese', storedAt: now - 9 * DAY_MS, alertAfterDays: 3 }),
      ],
      fridges: [kitchen, freezer],
      meals: [meal({ date: '2026-11-27' })],
      recipes: [recipe()],
      times,
      now,
    });
    expect(reminders.map((r) => r.id)).toEqual(['defrost-meal1', 'storage-2026-11-27', 'storage-2027-02-14']);
    expect(reminders[0].at).toBe(at(2026, 11, 26, 18, 30));
    expect(reminders[0].body).toBe('Take out Chicken thighs (500 g) for Chicken stir fry.');
    expect(reminders[1].body).toBe('Milk and Spinach have reached their storage time. Plan them into a meal.');
  });

  it('caps the number of scheduled notifications', () => {
    const now = at(2026, 11, 26, 9);
    const many = Array.from({ length: 80 }, (_, i) =>
      item({ id: `i${i}`, name: `Item ${i}`, storedAt: now, alertAfterDays: i + 1 }),
    );
    expect(buildReminders({ items: many, fridges: [kitchen], meals: [], recipes: [], times, now })).toHaveLength(60);
  });
});
