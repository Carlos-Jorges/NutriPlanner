// Who can do what. The Firestore rules enforce the same table on the server;
// this copy only decides which buttons to show.

import type { Member, Role } from './types';

export type Action =
  | 'manageFridges'
  | 'addItem'
  | 'takeOutItem'
  | 'editItem'
  | 'manageMembers'
  | 'manageInvites'
  | 'editGroup'
  | 'approve'
  | 'scheduleMeal'
  | 'proposeMeal'
  | 'saveRecipe'
  | 'proposeRecipe'
  | 'editShopping'
  | 'generateShopping'
  | 'putAway';

const MEMBER_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'addItem',
  'proposeMeal',
  'proposeRecipe',
  'editShopping',
  'generateShopping',
  'putAway',
]);

export function can(role: Role | null | undefined, action: Action): boolean {
  if (role === 'admin') return true;
  if (role === 'member') return MEMBER_ACTIONS.has(action);
  return false;
}

export function adminCount(members: readonly Member[]): number {
  return members.filter((m) => m.role === 'admin').length;
}

/** The last admin cannot step down while others remain, or the group is locked. */
export function canChangeOwnAdminRole(members: readonly Member[], uid: string): boolean {
  const me = members.find((m) => m.uid === uid);
  if (!me || me.role !== 'admin') return true;
  return adminCount(members) > 1;
}

export function canLeave(members: readonly Member[], uid: string): boolean {
  if (members.length <= 1) return true;
  return canChangeOwnAdminRole(members, uid);
}
