import { AppError } from '@/core/errors';
import type { Consumption, FridgeItem, Group, Member, Recipe, ShoppingItem, UserProfile } from '@/core/types';
import { createMemoryStore } from '../memory-store';
import { paths, type WithId } from '../store';
import {
  createGroup,
  createInvite,
  ensureProfile,
  joinGroup,
  leaveGroup,
  revokeInvite,
  setRole,
} from '../services/groups';
import { planMeal, reviewMeal, saveRecipe } from '../services/planning';
import { generateFromUsed, putAway } from '../services/shopping';
import { addItem, amountForRecipe, deleteFridge, saveFridge, takeOut } from '../services/storage';

const alex = { uid: 'alex', displayName: 'Alex' };
const mia = { uid: 'mia', displayName: 'Mia' };

function collection<T>(store: ReturnType<typeof createMemoryStore>, path: string): WithId<T>[] {
  return Object.entries(store.snapshot())
    .filter(([p]) => p.startsWith(`${path}/`) && p.split('/').length === path.split('/').length + 1)
    .map(([p, data]) => ({ id: p.split('/').pop() as string, ...(data as T) }));
}

async function setup() {
  const store = createMemoryStore();
  await ensureProfile(store, { uid: alex.uid, email: 'Alex@Example.com', displayName: null }, 'Alex');
  await ensureProfile(store, { uid: mia.uid, email: 'mia@example.com', displayName: 'Mia' }, null);
  const groupId = await createGroup(store, alex, '  Family   kitchen ');
  return { store, groupId };
}

describe('groups and invites', () => {
  it('creates the group with the founder as admin and starter storage', async () => {
    const { store, groupId } = await setup();
    const group = await store.getDoc<Group>(paths.group(groupId));
    expect(group?.name).toBe('Family kitchen');
    const founder = await store.getDoc<Member>(paths.member(groupId, 'alex'));
    expect(founder?.role).toBe('admin');
    const profile = await store.getDoc<UserProfile>(paths.user('alex'));
    expect(profile).toMatchObject({ email: 'alex@example.com', groupIds: [groupId], activeGroupId: groupId });
    expect(collection(store, paths.fridges(groupId)).map((f) => (f as { kind?: string }).kind).sort()).toEqual([
      'freezer',
      'fridge',
    ]);
  });

  it('lets a member join with a code typed in lowercase, once', async () => {
    const { store, groupId } = await setup();
    const group = (await store.getDoc<Group>(paths.group(groupId))) as Group;
    const code = await createInvite(store, alex, group, () => new Uint8Array([10, 11, 12, 13, 14, 15]));
    const miaProfile = (await store.getDoc<UserProfile>(paths.user('mia'))) as UserProfile;
    const joined = await joinGroup(store, mia, miaProfile, code.toLowerCase());
    expect(joined).toEqual({ groupId, groupName: 'Family kitchen' });
    const member = await store.getDoc<Member>(paths.member(groupId, 'mia'));
    expect(member).toMatchObject({ role: 'member', inviteCode: code });
    expect((await store.getDoc<UserProfile>(paths.user('mia')))?.activeGroupId).toBe(groupId);
  });

  it('rejects unknown, malformed and revoked codes', async () => {
    const { store, groupId } = await setup();
    const profile = (await store.getDoc<UserProfile>(paths.user('mia'))) as UserProfile;
    await expect(joinGroup(store, mia, profile, 'ZZZZZZ')).rejects.toMatchObject({ code: 'invite-invalid' });
    await expect(joinGroup(store, mia, profile, 'ABC')).rejects.toMatchObject({ code: 'invite-invalid' });
    const group = (await store.getDoc<Group>(paths.group(groupId))) as Group;
    const code = await createInvite(store, alex, group, () => new Uint8Array([1, 2, 3, 4, 5, 6]));
    await revokeInvite(store, (await store.getDoc<Group>(paths.group(groupId))) as Group);
    await expect(joinGroup(store, mia, profile, code)).rejects.toMatchObject({ code: 'invite-invalid' });
  });

  it('replaces the previous code when a new one is made', async () => {
    const { store, groupId } = await setup();
    const first = await createInvite(store, alex, (await store.getDoc<Group>(paths.group(groupId))) as Group, () => new Uint8Array(6).fill(1));
    const second = await createInvite(store, alex, (await store.getDoc<Group>(paths.group(groupId))) as Group, () => new Uint8Array(6).fill(2));
    expect(await store.getDoc(paths.invite(first))).toBeNull();
    expect(await store.getDoc(paths.invite(second))).not.toBeNull();
  });

  it('keeps at least one admin', async () => {
    const { store, groupId } = await setup();
    const members: Member[] = [
      { id: 'alex', uid: 'alex', displayName: 'Alex', role: 'admin', joinedAt: 0, inviteCode: null },
      { id: 'mia', uid: 'mia', displayName: 'Mia', role: 'member', joinedAt: 0, inviteCode: 'X' },
    ];
    await expect(setRole(store, groupId, members, 'alex', members[0], 'member')).rejects.toBeInstanceOf(AppError);
    const profile = (await store.getDoc<UserProfile>(paths.user('alex'))) as UserProfile;
    await expect(leaveGroup(store, alex, profile, groupId, members)).rejects.toMatchObject({ code: 'last-admin' });
  });
});

describe('fridge items', () => {
  async function withFreezer() {
    const { store, groupId } = await setup();
    const freezerId = await saveFridge(store, groupId, alex, { name: 'Garage freezer', kind: 'freezer', defaultAlertDays: 90 });
    const freezer = { id: freezerId, name: 'Garage freezer', kind: 'freezer' as const, defaultAlertDays: 90, createdAt: 0, createdBy: 'alex' };
    const itemId = await addItem(store, groupId, mia, {
      fridgeId: freezerId,
      name: ' Beef  mince ',
      quantity: 1,
      unit: 'kg',
      alertAfterDays: 90,
      notes: '',
      daysAlreadyStored: 10,
    });
    return { store, groupId, freezer, itemId };
  }

  it('backdates items that were already stored', async () => {
    const { store, groupId, itemId } = await withFreezer();
    const item = (await store.getDoc<FridgeItem>(paths.item(groupId, itemId))) as FridgeItem;
    expect(item.name).toBe('Beef mince');
    expect(Math.round((Date.now() - item.storedAt) / 86_400_000)).toBe(10);
    expect(item.addedByName).toBe('Mia');
  });

  it('splits a partial defrost into its own item and keeps the storage date', async () => {
    const { store, groupId, freezer, itemId } = await withFreezer();
    await takeOut(store, groupId, alex, itemId, freezer, 'defrost', 0.5);
    const items = collection<FridgeItem>(store, paths.items(groupId));
    expect(items).toHaveLength(2);
    const original = items.find((i) => i.id === itemId) as FridgeItem;
    const thawing = items.find((i) => i.id !== itemId) as FridgeItem;
    expect(original).toMatchObject({ quantity: 0.5, status: 'stored' });
    expect(thawing).toMatchObject({ quantity: 0.5, status: 'defrosting', storedAt: original.storedAt });
  });

  it('logs use as frozen consumption and deletes the item when it is used up', async () => {
    const { store, groupId, freezer, itemId } = await withFreezer();
    await takeOut(store, groupId, alex, itemId, freezer, 'use', 5); // more than is there: capped at 1 kg
    expect(await store.getDoc(paths.item(groupId, itemId))).toBeNull();
    const [log] = collection<Consumption>(store, paths.consumptions(groupId));
    expect(log).toMatchObject({ itemName: 'Beef mince', quantity: 1, unit: 'kg', category: 'frozen', reason: 'used', listed: false });
  });

  it('logs thrown out food without sending it to the shopping list', async () => {
    const { store, groupId, freezer, itemId } = await withFreezer();
    await takeOut(store, groupId, alex, itemId, freezer, 'discard', 0.25);
    const [log] = collection<Consumption>(store, paths.consumptions(groupId));
    expect(log).toMatchObject({ reason: 'discarded', listed: true, quantity: 0.25 });
  });

  it('refuses to delete a fridge that still holds food', async () => {
    const { store, groupId, freezer, itemId } = await withFreezer();
    const items = collection<FridgeItem>(store, paths.items(groupId));
    await expect(deleteFridge(store, groupId, freezer.id, items)).rejects.toMatchObject({ code: 'fridge-not-empty' });
    expect(itemId).toBeTruthy();
  });

  it('works out how much of an item a recipe needs', () => {
    const item = { quantity: 1, unit: 'kg' } as FridgeItem;
    expect(amountForRecipe(item, 500, 'g')).toBe(0.5);
    expect(amountForRecipe(item, 2, 'kg')).toBe(1);
    expect(amountForRecipe(item, 2, 'pcs')).toBe(1);
  });
});

describe('shopping', () => {
  it('generates lines from what was used once, then puts bought food away', async () => {
    const { store, groupId } = await setup();
    const fridgeId = await saveFridge(store, groupId, alex, { name: 'Kitchen', kind: 'fridge', defaultAlertDays: 4 });
    const kitchen = { id: fridgeId, name: 'Kitchen', kind: 'fridge' as const, defaultAlertDays: 4, createdAt: 0, createdBy: 'alex' };
    for (const amount of [1, 0.5]) {
      const id = await addItem(store, groupId, alex, { fridgeId, name: 'Milk', quantity: amount, unit: 'l', alertAfterDays: 4, notes: '', daysAlreadyStored: 0 });
      await takeOut(store, groupId, alex, id, kitchen, 'use', amount);
    }

    const consumptions = collection<Consumption>(store, paths.consumptions(groupId));
    const first = await generateFromUsed(store, groupId, alex, consumptions, []);
    expect(first).toEqual({ added: 1, updated: 0 });
    const [line] = collection<ShoppingItem>(store, paths.shopping(groupId));
    expect(line).toMatchObject({ name: 'Milk', quantity: 1.5, unit: 'l', category: 'fresh', source: 'auto' });

    // Running it again adds nothing: those uses are already listed.
    const again = await generateFromUsed(store, groupId, alex, collection<Consumption>(store, paths.consumptions(groupId)), [line]);
    expect(again).toEqual({ added: 0, updated: 0 });

    await putAway(store, groupId, mia, [
      { shoppingId: line.id, name: line.name, fridgeId, quantity: 2, unit: 'l', alertAfterDays: 4 },
    ]);
    expect(collection(store, paths.shopping(groupId))).toHaveLength(0);
    const [stored] = collection<FridgeItem>(store, paths.items(groupId));
    expect(stored).toMatchObject({ name: 'Milk', quantity: 2, status: 'stored', addedByName: 'Mia' });
  });
});

describe('recipes and meals', () => {
  it('saves member recipes and meals as proposals, and approving the meal approves its recipe', async () => {
    const { store, groupId } = await setup();
    const recipeId = await saveRecipe(store, groupId, mia, false, {
      name: 'Prawn tacos',
      ingredients: [
        { name: 'Prawns', quantity: 500, unit: 'g' },
        { name: '  ', quantity: 1, unit: 'pcs' },
      ],
      defrostHours: 12,
      notes: '',
    });
    const recipe = (await store.getDoc<Recipe>(paths.recipe(groupId, recipeId))) as Recipe;
    expect(recipe.status).toBe('pending');
    expect(recipe.ingredients).toHaveLength(1);

    const mealId = await planMeal(store, groupId, mia, false, { date: '2026-11-27', slot: 'dinner', recipeId, title: recipe.name });
    const meal = await store.getDoc(paths.meal(groupId, mealId));
    expect(meal).toMatchObject({ status: 'proposed', proposedByName: 'Mia' });

    await reviewMeal(store, groupId, alex, meal as never, 'confirmed', recipe);
    expect(await store.getDoc(paths.meal(groupId, mealId))).toMatchObject({ status: 'confirmed', reviewedBy: 'alex' });
    expect(await store.getDoc(paths.recipe(groupId, recipeId))).toMatchObject({ status: 'approved' });
  });

  it('validates recipes and meal days', async () => {
    const { store, groupId } = await setup();
    await expect(
      saveRecipe(store, groupId, alex, true, { name: 'Toast', ingredients: [], defrostHours: 0, notes: '' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      planMeal(store, groupId, alex, true, { date: '2026-02-30', slot: 'lunch', recipeId: null, title: 'Soup' }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});
