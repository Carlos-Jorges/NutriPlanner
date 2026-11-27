// Domain types for NutriPlanner.
//
// These mirror the Firestore documents one to one. The `id` field is the
// document ID and is never stored inside the document itself.
//
// Times are stored as epoch milliseconds (numbers). Calendar days are stored
// as local "YYYY-MM-DD" strings so a meal planned for Thursday stays on
// Thursday regardless of time zone.

export type Role = 'admin' | 'member';
export type StorageKind = 'fridge' | 'freezer';
export type ItemStatus = 'stored' | 'defrosting';
export type Slot = 'lunch' | 'dinner';
export type ShoppingCategory = 'fresh' | 'frozen';
export type RecipeStatus = 'pending' | 'approved' | 'rejected';
export type MealStatus = 'proposed' | 'confirmed' | 'rejected';
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'pack';
export type TakeOutPurpose = 'defrost' | 'use' | 'discard';

/** /users/{uid} */
export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  createdAt: number;
  groupIds: string[];
  activeGroupId: string | null;
}

/** /groups/{groupId} */
export interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  /** "HH:mm", 24 hour clock, local time */
  lunchTime: string;
  dinnerTime: string;
  inviteCode: string | null;
  inviteExpiresAt: number | null;
}

/** /groups/{groupId}/members/{uid} */
export interface Member {
  id: string;
  uid: string;
  displayName: string;
  role: Role;
  joinedAt: number;
  /** The invite code used to join. Null for the founder. Checked by the rules. */
  inviteCode: string | null;
}

/** /invites/{code} */
export interface Invite {
  id: string;
  groupId: string;
  groupName: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
}

/** /groups/{groupId}/fridges/{fridgeId} */
export interface Fridge {
  id: string;
  name: string;
  kind: StorageKind;
  /** Default "alert admins after N days" for new items in this fridge. */
  defaultAlertDays: number;
  createdAt: number;
  createdBy: string;
}

/** /groups/{groupId}/items/{itemId} */
export interface FridgeItem {
  id: string;
  fridgeId: string;
  name: string;
  quantity: number;
  unit: Unit;
  /** When the item went into storage. Drives first in, first out order. */
  storedAt: number;
  /** Manually set: admins are alerted once the item has been stored this long. */
  alertAfterDays: number;
  status: ItemStatus;
  defrostStartedAt: number | null;
  addedBy: string;
  addedByName: string;
  notes: string;
}

/** /groups/{groupId}/consumptions/{id}: the history that feeds the shopping list. */
export interface Consumption {
  id: string;
  itemName: string;
  normalisedName: string;
  quantity: number;
  unit: Unit;
  category: ShoppingCategory;
  fridgeId: string;
  fridgeName: string;
  consumedAt: number;
  consumedBy: string;
  consumedByName: string;
  reason: 'used' | 'discarded';
  /** True once this entry has been turned into a shopping list line (or never should be). */
  listed: boolean;
}

/** /groups/{groupId}/shopping/{id} */
export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: ShoppingCategory;
  source: 'auto' | 'manual';
  checked: boolean;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

export interface Ingredient {
  name: string;
  quantity: number;
  unit: Unit;
}

/** /groups/{groupId}/recipes/{id} */
export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  /** Hours frozen ingredients need in the fridge before cooking. 0 means none. */
  defrostHours: number;
  notes: string;
  status: RecipeStatus;
  proposedBy: string;
  proposedByName: string;
  createdAt: number;
  reviewedBy: string | null;
  reviewedAt: number | null;
}

/** /groups/{groupId}/meals/{id} */
export interface Meal {
  id: string;
  /** Local calendar day, "YYYY-MM-DD" */
  date: string;
  slot: Slot;
  recipeId: string | null;
  title: string;
  status: MealStatus;
  proposedBy: string;
  proposedByName: string;
  createdAt: number;
  reviewedBy: string | null;
  reviewedAt: number | null;
}

export type WithoutId<T> = Omit<T, 'id'>;
