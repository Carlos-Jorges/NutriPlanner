// Security rules tests. They run against the local Firestore emulator:
//   npm run test:rules
// The emulator needs Java 21 or newer (see SETUP_WINDOWS.md).

const fs = require('fs');
const path = require('path');
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');

const DAY = 86400000;
const NOW = Date.now();
const G = 'family';
const OTHER = 'neighbours';

let env;

const db = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

const member = (uid, role, inviteCode = null) => ({
  uid,
  displayName: uid,
  role,
  joinedAt: NOW,
  inviteCode,
});

const item = (overrides = {}) => ({
  fridgeId: 'freezer',
  name: 'Beef mince',
  quantity: 500,
  unit: 'g',
  storedAt: NOW - 10 * DAY,
  alertAfterDays: 90,
  status: 'stored',
  defrostStartedAt: null,
  addedBy: 'alex',
  addedByName: 'Alex',
  notes: '',
  ...overrides,
});

const recipe = (overrides = {}) => ({
  name: 'Prawn tacos',
  ingredients: [{ name: 'Prawns', quantity: 500, unit: 'g' }],
  defrostHours: 12,
  notes: '',
  status: 'pending',
  proposedBy: 'mia',
  proposedByName: 'Mia',
  createdAt: NOW,
  reviewedBy: null,
  reviewedAt: null,
  ...overrides,
});

const meal = (overrides = {}) => ({
  date: '2026-11-27',
  slot: 'dinner',
  recipeId: null,
  title: 'Tacos',
  status: 'proposed',
  proposedBy: 'mia',
  proposedByName: 'Mia',
  createdAt: NOW,
  reviewedBy: null,
  reviewedAt: null,
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nutriplanner',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await admin.doc(`groups/${G}`).set({
      name: 'Family kitchen',
      createdBy: 'alex',
      createdAt: NOW,
      lunchTime: '12:30',
      dinnerTime: '18:30',
      inviteCode: 'KTCH42',
      inviteExpiresAt: NOW + 7 * DAY,
    });
    await admin.doc(`groups/${G}/members/alex`).set(member('alex', 'admin'));
    await admin.doc(`groups/${G}/members/mia`).set(member('mia', 'member', 'KTCH42'));
    await admin.doc(`groups/${G}/fridges/freezer`).set({ name: 'Freezer', kind: 'freezer', defaultAlertDays: 90, createdAt: NOW, createdBy: 'alex' });
    await admin.doc(`groups/${G}/items/mince`).set(item());
    await admin.doc(`groups/${G}/consumptions/c1`).set({
      itemName: 'Milk', normalisedName: 'milk', quantity: 1, unit: 'l', category: 'fresh', fridgeId: 'freezer',
      fridgeName: 'Freezer', consumedAt: NOW, consumedBy: 'alex', consumedByName: 'Alex', reason: 'used', listed: false,
    });
    await admin.doc(`groups/${G}/recipes/tacos`).set(recipe());
    await admin.doc(`groups/${G}/meals/tacos`).set(meal());
    await admin.doc('invites/KTCH42').set({ groupId: G, groupName: 'Family kitchen', createdBy: 'alex', createdAt: NOW, expiresAt: NOW + 7 * DAY });
    await admin.doc('invites/EXPRD2').set({ groupId: G, groupName: 'Family kitchen', createdBy: 'alex', createdAt: NOW - 8 * DAY, expiresAt: NOW - DAY });
    await admin.doc(`groups/${OTHER}`).set({ name: 'Neighbours', createdBy: 'ned', createdAt: NOW, lunchTime: '12:30', dinnerTime: '18:30', inviteCode: 'NBRS22', inviteExpiresAt: NOW + DAY });
    await admin.doc('invites/NBRS22').set({ groupId: OTHER, groupName: 'Neighbours', createdBy: 'ned', createdAt: NOW, expiresAt: NOW + DAY });
  });
});

describe('profiles', () => {
  test('people read and write only their own profile', async () => {
    await assertSucceeds(db('zoe').doc('users/zoe').set({ displayName: 'Zoe', email: 'z@x.com', createdAt: NOW, groupIds: [], activeGroupId: null }));
    await assertFails(db('zoe').doc('users/alex').get());
    await assertFails(db(null).doc('users/zoe').get());
  });
});

describe('creating and joining groups', () => {
  test('a founder creates the group and their admin membership together', async () => {
    const zoe = db('zoe');
    const batch = zoe.batch();
    batch.set(zoe.doc('groups/new'), { name: 'Zoe home', createdBy: 'zoe', createdAt: NOW, lunchTime: '12:30', dinnerTime: '18:30', inviteCode: null, inviteExpiresAt: null });
    batch.set(zoe.doc('groups/new/members/zoe'), member('zoe', 'admin'));
    await assertSucceeds(batch.commit());
  });

  test('nobody can make themselves admin of an existing group', async () => {
    await assertFails(db('zoe').doc(`groups/${G}/members/zoe`).set(member('zoe', 'admin')));
  });

  test('a group cannot be created without its admin membership', async () => {
    await assertFails(db('zoe').doc('groups/new').set({ name: 'Zoe home', createdBy: 'zoe', createdAt: NOW }));
  });

  test('a live code lets someone join as a member', async () => {
    await assertSucceeds(db('zoe').doc('invites/KTCH42').get());
    await assertSucceeds(db('zoe').doc(`groups/${G}/members/zoe`).set(member('zoe', 'member', 'KTCH42')));
    await assertSucceeds(db('zoe').doc(`groups/${G}`).get());
  });

  test('expired codes, codes for another group and missing codes are refused', async () => {
    await assertFails(db('zoe').doc(`groups/${G}/members/zoe`).set(member('zoe', 'member', 'EXPRD2')));
    await assertFails(db('zoe').doc(`groups/${G}/members/zoe`).set(member('zoe', 'member', 'NBRS22')));
    await assertFails(db('zoe').doc(`groups/${G}/members/zoe`).set(member('zoe', 'member', 'ZZZZZZ')));
    await assertFails(db('zoe').doc(`groups/${G}/members/zoe`).set(member('zoe', 'member', null)));
  });

  test('codes cannot be listed', async () => {
    await assertFails(db('zoe').collection('invites').get());
  });

  test('only admins create invite codes', async () => {
    const invite = { groupId: G, groupName: 'Family kitchen', createdAt: NOW, expiresAt: NOW + 7 * DAY };
    await assertFails(db('mia').doc('invites/MIAMIA').set({ ...invite, createdBy: 'mia' }));
    await assertSucceeds(db('alex').doc('invites/ALEX22').set({ ...invite, createdBy: 'alex' }));
  });
});

describe('roles', () => {
  test('outsiders see nothing', async () => {
    await assertFails(db('zoe').doc(`groups/${G}`).get());
    await assertFails(db('zoe').collection(`groups/${G}/items`).get());
  });

  test('members cannot promote themselves; admins can promote', async () => {
    await assertFails(db('mia').doc(`groups/${G}/members/mia`).update({ role: 'admin' }));
    await assertSucceeds(db('alex').doc(`groups/${G}/members/mia`).update({ role: 'admin' }));
  });

  test('anyone can leave; only admins remove others', async () => {
    await assertFails(db('mia').doc(`groups/${G}/members/alex`).delete());
    await assertSucceeds(db('mia').doc(`groups/${G}/members/mia`).delete());
  });

  test('only admins manage fridges', async () => {
    const fridge = { name: 'Garage freezer', kind: 'freezer', defaultAlertDays: 90, createdAt: NOW, createdBy: 'mia' };
    await assertFails(db('mia').doc(`groups/${G}/fridges/garage`).set(fridge));
    await assertSucceeds(db('alex').doc(`groups/${G}/fridges/garage`).set({ ...fridge, createdBy: 'alex' }));
  });
});

describe('fridge items', () => {
  test('members can put food away', async () => {
    await assertSucceeds(db('mia').doc(`groups/${G}/items/peas`).set(item({ name: 'Peas', addedBy: 'mia', addedByName: 'Mia' })));
  });

  test('members cannot take out, edit or delete', async () => {
    await assertFails(db('mia').doc(`groups/${G}/items/mince`).update({ status: 'defrosting', defrostStartedAt: NOW }));
    await assertFails(db('mia').doc(`groups/${G}/items/mince`).delete());
    await assertFails(db('mia').doc(`groups/${G}/items/x`).set(item({ addedBy: 'mia', status: 'defrosting' })));
  });

  test('admins take items out, but never rewrite the storage date', async () => {
    await assertSucceeds(db('alex').doc(`groups/${G}/items/mince`).update({ status: 'defrosting', defrostStartedAt: NOW }));
    await assertFails(db('alex').doc(`groups/${G}/items/mince`).update({ storedAt: NOW }));
  });

  test('items must go into a fridge that exists, with a valid unit', async () => {
    await assertFails(db('alex').doc(`groups/${G}/items/x`).set(item({ fridgeId: 'nowhere' })));
    await assertFails(db('alex').doc(`groups/${G}/items/x`).set(item({ unit: 'handful' })));
  });

  test('only admins log use; members may mark entries as listed', async () => {
    const log = { itemName: 'Milk', quantity: 1, unit: 'l', category: 'fresh', consumedBy: 'mia', reason: 'used', listed: false };
    await assertFails(db('mia').doc(`groups/${G}/consumptions/c2`).set(log));
    await assertSucceeds(db('mia').doc(`groups/${G}/consumptions/c1`).update({ listed: true }));
    await assertFails(db('mia').doc(`groups/${G}/consumptions/c1`).update({ quantity: 9 }));
  });
});

describe('shopping list', () => {
  test('every member can add, tick and remove lines', async () => {
    const line = { name: 'Lemons', quantity: 3, unit: 'pcs', category: 'fresh', source: 'manual', checked: false, addedBy: 'mia', addedByName: 'Mia', addedAt: NOW };
    const mia = db('mia');
    await assertSucceeds(mia.doc(`groups/${G}/shopping/lemons`).set(line));
    await assertSucceeds(mia.doc(`groups/${G}/shopping/lemons`).update({ checked: true }));
    await assertSucceeds(mia.doc(`groups/${G}/shopping/lemons`).delete());
    await assertFails(db('zoe').doc(`groups/${G}/shopping/x`).set({ ...line, addedBy: 'zoe' }));
  });
});

describe('recipes and meals', () => {
  test('members propose recipes but cannot approve them', async () => {
    await assertSucceeds(db('mia').doc(`groups/${G}/recipes/r2`).set(recipe()));
    await assertFails(db('mia').doc(`groups/${G}/recipes/r3`).set(recipe({ status: 'approved' })));
    await assertFails(db('mia').doc(`groups/${G}/recipes/tacos`).update({ status: 'approved' }));
    await assertSucceeds(db('alex').doc(`groups/${G}/recipes/tacos`).update({ status: 'approved', reviewedBy: 'alex', reviewedAt: NOW }));
  });

  test('members propose meals; only admins confirm', async () => {
    await assertSucceeds(db('mia').doc(`groups/${G}/meals/m2`).set(meal()));
    await assertFails(db('mia').doc(`groups/${G}/meals/m3`).set(meal({ status: 'confirmed' })));
    await assertFails(db('mia').doc(`groups/${G}/meals/tacos`).update({ status: 'confirmed' }));
    await assertSucceeds(db('alex').doc(`groups/${G}/meals/tacos`).update({ status: 'confirmed', reviewedBy: 'alex', reviewedAt: NOW }));
  });

  test('members withdraw their own proposals only', async () => {
    await assertSucceeds(db('mia').doc(`groups/${G}/meals/tacos`).delete());
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`groups/${G}/meals/confirmed`).set(meal({ status: 'confirmed', proposedBy: 'alex' })));
    await assertFails(db('mia').doc(`groups/${G}/meals/confirmed`).delete());
  });

  test('meal dates must be calendar days', async () => {
    await assertFails(db('mia').doc(`groups/${G}/meals/bad`).set(meal({ date: '27/11/2026' })));
  });
});
