// Groups, membership, invites and the signed in user's profile.

import { DAY_MS, DEFAULT_MEAL_TIMES, isValidTime } from '@/core/dates';
import { AppError } from '@/core/errors';
import { INVITE_TTL_DAYS, isValidInviteCode, makeInviteCode, normaliseInviteCode } from '@/core/invite-code';
import { cleanName } from '@/core/names';
import { canChangeOwnAdminRole, canLeave } from '@/core/permissions';
import type { Group, Invite, Member, Role, UserProfile } from '@/core/types';
import type { AuthUser } from '../auth';
import { paths, type Store, type WriteOp } from '../store';

export interface Actor {
  uid: string;
  displayName: string;
}

/** Creates the profile document once, the first time a user is seen. */
export async function ensureProfile(store: Store, user: AuthUser, preferredName: string | null): Promise<void> {
  const existing = await store.getDoc<UserProfile>(paths.user(user.uid));
  if (existing) return;
  const fallback = user.email.split('@')[0] || 'Me';
  await store.set(paths.user(user.uid), {
    displayName: cleanName(preferredName ?? user.displayName ?? fallback) || fallback,
    email: user.email.toLowerCase(),
    createdAt: Date.now(),
    groupIds: [],
    activeGroupId: null,
  });
}

export async function setActiveGroup(store: Store, uid: string, groupId: string): Promise<void> {
  await store.update(paths.user(uid), { activeGroupId: groupId });
}

/** Removes a group from the profile, for example after being removed by an admin. */
export async function forgetGroup(store: Store, profile: UserProfile, groupId: string): Promise<void> {
  const remaining = profile.groupIds.filter((id) => id !== groupId);
  await store.update(paths.user(profile.id), {
    groupIds: store.arrayRemove(groupId),
    activeGroupId: remaining[0] ?? null,
  });
}

export async function createGroup(store: Store, actor: Actor, rawName: string): Promise<string> {
  const name = cleanName(rawName);
  if (!name) throw new AppError('validation', 'Give your group a name.');
  const groupId = store.newId(paths.groups());
  const now = Date.now();

  // One batch: the rules only accept the founder's admin membership when the
  // group document is created in the same write.
  await store.batch([
    {
      type: 'set',
      path: paths.group(groupId),
      data: {
        name,
        createdBy: actor.uid,
        createdAt: now,
        ...DEFAULT_MEAL_TIMES,
        inviteCode: null,
        inviteExpiresAt: null,
      },
    },
    {
      type: 'set',
      path: paths.member(groupId, actor.uid),
      data: { uid: actor.uid, displayName: actor.displayName, role: 'admin', joinedAt: now, inviteCode: null },
    },
    {
      type: 'update',
      path: paths.user(actor.uid),
      data: { groupIds: store.arrayUnion(groupId), activeGroupId: groupId },
    },
  ]);

  // Starter storage. Written separately because the admin check needs the
  // membership to exist first. Not critical if it fails.
  try {
    await store.batch(
      [
        { name: 'Fridge', kind: 'fridge', defaultAlertDays: 3 },
        { name: 'Freezer', kind: 'freezer', defaultAlertDays: 90 },
      ].map((fridge) => ({
        type: 'set' as const,
        path: paths.fridge(groupId, store.newId(paths.fridges(groupId))),
        data: { ...fridge, createdAt: now, createdBy: actor.uid },
      })),
    );
  } catch {
    // The admin can add fridges from the Fridges tab.
  }
  return groupId;
}

export async function joinGroup(
  store: Store,
  actor: Actor,
  profile: UserProfile,
  rawCode: string,
): Promise<{ groupId: string; groupName: string }> {
  const code = normaliseInviteCode(rawCode);
  if (!isValidInviteCode(code)) throw new AppError('invite-invalid');
  const invite = await store.getDoc<Invite>(paths.invite(code));
  if (!invite) throw new AppError('invite-invalid');
  if (invite.expiresAt <= Date.now()) throw new AppError('invite-expired');

  if (profile.groupIds.includes(invite.groupId)) {
    await setActiveGroup(store, actor.uid, invite.groupId);
    return { groupId: invite.groupId, groupName: invite.groupName };
  }

  await store.batch([
    {
      type: 'set',
      path: paths.member(invite.groupId, actor.uid),
      data: { uid: actor.uid, displayName: actor.displayName, role: 'member', joinedAt: Date.now(), inviteCode: code },
    },
    {
      type: 'update',
      path: paths.user(actor.uid),
      data: { groupIds: store.arrayUnion(invite.groupId), activeGroupId: invite.groupId },
    },
  ]);
  return { groupId: invite.groupId, groupName: invite.groupName };
}

export async function createInvite(
  store: Store,
  actor: Actor,
  group: Group,
  randomBytes: (count: number) => Uint8Array,
): Promise<string> {
  const code = makeInviteCode(randomBytes);
  const now = Date.now();
  const expiresAt = now + INVITE_TTL_DAYS * DAY_MS;
  const ops: WriteOp[] = [
    {
      type: 'set',
      path: paths.invite(code),
      data: { groupId: group.id, groupName: group.name, createdBy: actor.uid, createdAt: now, expiresAt },
    },
    { type: 'update', path: paths.group(group.id), data: { inviteCode: code, inviteExpiresAt: expiresAt } },
  ];
  if (group.inviteCode) ops.push({ type: 'delete', path: paths.invite(group.inviteCode) });
  await store.batch(ops);
  return code;
}

export async function revokeInvite(store: Store, group: Group): Promise<void> {
  if (!group.inviteCode) return;
  await store.batch([
    { type: 'delete', path: paths.invite(group.inviteCode) },
    { type: 'update', path: paths.group(group.id), data: { inviteCode: null, inviteExpiresAt: null } },
  ]);
}

export async function setRole(
  store: Store,
  groupId: string,
  members: readonly Member[],
  actorUid: string,
  target: Member,
  role: Role,
): Promise<void> {
  if (target.uid === actorUid && role === 'member' && !canChangeOwnAdminRole(members, actorUid)) {
    throw new AppError('last-admin');
  }
  await store.update(paths.member(groupId, target.uid), { role });
}

export async function removeMember(store: Store, groupId: string, target: Member): Promise<void> {
  await store.remove(paths.member(groupId, target.uid));
}

export async function leaveGroup(
  store: Store,
  actor: Actor,
  profile: UserProfile,
  groupId: string,
  members: readonly Member[],
): Promise<void> {
  if (!canLeave(members, actor.uid)) throw new AppError('last-admin');
  const remaining = profile.groupIds.filter((id) => id !== groupId);
  await store.batch([
    { type: 'delete', path: paths.member(groupId, actor.uid) },
    {
      type: 'update',
      path: paths.user(actor.uid),
      data: { groupIds: store.arrayRemove(groupId), activeGroupId: remaining[0] ?? null },
    },
  ]);
}

export async function updateGroupSettings(
  store: Store,
  groupId: string,
  patch: Partial<Pick<Group, 'name' | 'lunchTime' | 'dinnerTime'>>,
): Promise<void> {
  const data: Record<string, string> = {};
  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    if (!name) throw new AppError('validation', 'Give your group a name.');
    data.name = name;
  }
  for (const key of ['lunchTime', 'dinnerTime'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (!isValidTime(value)) throw new AppError('validation', 'Times use the 24 hour format, for example 18:30.');
    data[key] = value;
  }
  await store.update(paths.group(groupId), data);
}
