// Group: invite codes, people and roles, meal times, reminders and account.

import * as Crypto from 'expo-crypto';
import { Platform, Share, StyleSheet, Switch, View } from 'react-native';

import { DAY_MS, formatClock } from '@/core/dates';
import { formatInviteCode } from '@/core/invite-code';
import { adminCount, canChangeOwnAdminRole, canLeave } from '@/core/permissions';
import type { Member } from '@/core/types';
import { createInvite, leaveGroup, removeMember, revokeInvite, setActiveGroup, setRole, updateGroupSettings } from '@/data/services/groups';
import { useBackend } from '@/state/backend-context';
import { SETTINGS, useSetting, writeSetting } from '@/state/device-settings';
import { useGroup } from '@/state/group-data';
import { notifierSupported, requestPermission } from '@/state/notifier';
import { useSession } from '@/state/session';
import { Badge, Banner, Button, Card, Chips, Divider, PageHeader, Row, Screen, SectionHeader, TapeLabel, Txt, useToast } from '@/ui/components';
import { confirmAction, showMessage } from '@/ui/dialogs';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

const LUNCH_TIMES = ['11:30', '12:00', '12:30', '13:00', '13:30'];
const DINNER_TIMES = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];

export default function GroupScreen() {
  const backend = useBackend();
  const session = useSession();
  const { group, isAdmin } = useGroup();
  const { busy, error, run } = useAction();
  const toast = useToast();

  return (
    <Screen testID="group-screen">
      <PageHeader eyebrow="Group" title={group.name} />

      {backend.mode === 'demo' ? (
        <Card style={styles.demo}>
          <Txt variant="heading">Demo mode</Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            Sample data, saved on this device only. Connect Firebase (see SETUP_WINDOWS.md) to share with your family.
          </Txt>
          <Button
            small
            variant="secondary"
            label="Reset demo data"
            loading={busy === 'reset'}
            onPress={() =>
              void (async () => {
                if (!(await confirmAction('Reset the demo?', 'All demo changes are replaced with fresh sample data, and you will be signed out.', 'Reset', true))) return;
                await run('reset', async () => {
                  await backend.resetDemo?.();
                  toast('Demo data reset');
                });
              })()
            }
          />
        </Card>
      ) : backend.usingEmulator ? (
        <Banner kind="warning" text="Connected to the local Firebase emulators, not your real project." />
      ) : null}

      <Invite />
      <People />
      {isAdmin ? <MealTimes /> : null}
      {isAdmin && notifierSupported ? <Reminders /> : null}
      <Account />
      {error ? <Banner kind="error" text={error} /> : null}
      <Txt variant="caption" tone={color.inkFaint} style={styles.version}>
        NutriPlanner prototype 0.2 · {backend.mode === 'demo' ? 'demo data' : 'Firebase'} · signed in as {session.profile?.email}
      </Txt>
    </Screen>
  );
}

function Invite() {
  const { store } = useBackend();
  const { actor } = useSession();
  const { group, isAdmin, now } = useGroup();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const live = group.inviteCode && group.inviteExpiresAt && group.inviteExpiresAt > now ? group.inviteCode : null;
  const daysLeft = live && group.inviteExpiresAt ? Math.max(1, Math.ceil((group.inviteExpiresAt - now) / DAY_MS)) : 0;

  const share = async (code: string) => {
    const message = `Join "${group.name}" on NutriPlanner. After you sign up, choose "Join with a code" and enter ${formatInviteCode(code)}.`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
        toast('Invite message copied');
      } else {
        await Share.share({ message });
      }
    } catch {
      showMessage('Invite code', formatInviteCode(code));
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <Txt variant="heading">Invite people</Txt>
        <Txt variant="callout" tone={color.inkSoft}>
          Ask an admin for an invite code to add someone to this group.
        </Txt>
      </Card>
    );
  }

  return (
    <Card testID="invite">
      <Txt variant="heading">Invite people</Txt>
      {live ? (
        <>
          <Txt variant="callout" tone={color.inkSoft}>
            They sign up, choose Join with a code, and enter this. Expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
          </Txt>
          <View style={styles.code}>
            <TapeLabel text={formatInviteCode(live)} angle={-2} large />
          </View>
          <Row gap={space.sm} wrap>
            <Button small label={Platform.OS === 'web' ? 'Copy invite' : 'Share invite'} icon="share-variant-outline" onPress={() => void share(live)} />
            <Button
              small
              variant="secondary"
              label="New code"
              loading={busy === 'new'}
              onPress={() => actor && void run('new', async () => void (await createInvite(store, actor, group, Crypto.getRandomBytes)))}
            />
            <Button small variant="ghost" label="Stop invites" loading={busy === 'stop'} onPress={() => void run('stop', () => revokeInvite(store, group))} />
          </Row>
        </>
      ) : (
        <>
          <Txt variant="callout" tone={color.inkSoft}>
            Create a code to share. It works for 7 days and anyone who uses it joins as a member.
          </Txt>
          <Button
            label="Create invite code"
            icon="ticket-outline"
            loading={busy === 'new'}
            onPress={() => actor && void run('new', async () => void (await createInvite(store, actor, group, Crypto.getRandomBytes)))}
            testID="create-invite"
          />
        </>
      )}
      {error ? <Banner kind="error" text={error} /> : null}
    </Card>
  );
}

function People() {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, members, isAdmin } = useGroup();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const sorted = [...members].sort((a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName) : a.role === 'admin' ? -1 : 1));

  const changeRole = (member: Member) => {
    if (!actor) return;
    const next = member.role === 'admin' ? 'member' : 'admin';
    void run(`${member.uid}-role`, async () => {
      await setRole(store, groupId, members, actor.uid, member, next);
      toast(next === 'admin' ? `${member.displayName} is now an admin` : `${member.displayName} is now a member`);
    });
  };

  const remove = async (member: Member) => {
    const ok = await confirmAction(`Remove ${member.displayName}?`, 'They lose access to this group straight away.', 'Remove', true);
    if (!ok) return;
    void run(`${member.uid}-remove`, async () => {
      await removeMember(store, groupId, member);
      toast(`Removed ${member.displayName}`);
    });
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="People" count={members.length} />
      <Card style={styles.list}>
        {sorted.map((member, index) => {
          const me = member.uid === actor?.uid;
          const canDemoteSelf = !me || canChangeOwnAdminRole(members, member.uid);
          return (
            <View key={member.uid} style={styles.person} testID={`member-${member.uid}`}>
              {index > 0 ? <Divider /> : null}
              <Row gap={space.sm}>
                <View style={styles.flex}>
                  <Txt variant="heading">
                    {member.displayName}
                    {me ? <Txt variant="callout" tone={color.inkSoft}> (you)</Txt> : null}
                  </Txt>
                </View>
                <Badge label={member.role === 'admin' ? 'Admin' : 'Member'} tone={member.role === 'admin' ? 'evergreen' : 'neutral'} />
              </Row>
              {isAdmin && canDemoteSelf ? (
                <Row gap={space.sm}>
                  <Button
                    small
                    variant="soft"
                    label={member.role === 'admin' ? (me ? 'Step down' : 'Make member') : 'Make admin'}
                    loading={busy === `${member.uid}-role`}
                    onPress={() => changeRole(member)}
                    testID={`role-${member.uid}`}
                  />
                  {!me ? (
                    <Button small variant="ghost" label="Remove" loading={busy === `${member.uid}-remove`} onPress={() => void remove(member)} />
                  ) : null}
                </Row>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Txt variant="caption" tone={color.inkSoft}>
        Admins manage fridges, take food out, approve proposals and invite people. Members add food, propose meals and
        recipes, and use the shopping list. {adminCount(members) === 1 ? 'A group always keeps at least one admin.' : ''}
      </Txt>
      {error ? <Banner kind="error" text={error} /> : null}
    </View>
  );
}

function MealTimes() {
  const { store } = useBackend();
  const { group, groupId } = useGroup();
  const { error, run } = useAction();
  const set = (patch: { lunchTime?: string; dinnerTime?: string }) => void run('times', () => updateGroupSettings(store, groupId, patch));
  const options = (times: string[]) => times.map((t) => ({ value: t, label: formatClock(t) }));
  return (
    <Card>
      <Txt variant="heading">Meal times</Txt>
      <Txt variant="callout" tone={color.inkSoft}>
        Defrost take out times count back from these.
      </Txt>
      <Chips label="Lunch" options={options(LUNCH_TIMES)} value={group.lunchTime} onChange={(lunchTime) => set({ lunchTime })} />
      <Chips label="Dinner" options={options(DINNER_TIMES)} value={group.dinnerTime} onChange={(dinnerTime) => set({ dinnerTime })} />
      {error ? <Banner kind="error" text={error} /> : null}
    </Card>
  );
}

function Reminders() {
  const setting = useSetting(SETTINGS.reminders);
  const on = setting === 'on';
  const toggle = async (next: boolean) => {
    if (!next) return writeSetting(SETTINGS.reminders, 'off');
    const granted = await requestPermission();
    await writeSetting(SETTINGS.reminders, granted ? 'on' : 'off');
    if (!granted) showMessage('Notifications are off', 'Allow notifications for Expo Go or NutriPlanner in your phone settings, then try again.');
  };
  return (
    <Card>
      <Row gap={space.md}>
        <View style={styles.flex}>
          <Txt variant="heading">Reminders on this phone</Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            Storage alerts and defrost take out times. Scheduled on this phone, so open the app now and then to pick up
            changes others made.
          </Txt>
        </View>
        <Switch value={on} onValueChange={(next) => void toggle(next)} trackColor={{ true: color.leaf, false: color.line }} accessibilityLabel="Reminders on this phone" />
      </Row>
    </Card>
  );
}

function Account() {
  const { store } = useBackend();
  const session = useSession();
  const { groupId, members } = useGroup();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const { actor, profile } = session;
  if (!actor || !profile) return null;

  const leave = async () => {
    if (!canLeave(members, actor.uid)) {
      showMessage('Make someone else an admin first', 'A group always needs at least one admin.');
      return;
    }
    const ok = await confirmAction('Leave this group?', 'You will need a new invite code to come back.', 'Leave', true);
    if (!ok) return;
    void run('leave', async () => {
      await leaveGroup(store, actor, profile, groupId, members);
      toast('You left the group');
    });
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Account" />
      <Card>
        <Txt variant="heading">{profile.displayName}</Txt>
        <Txt variant="callout" tone={color.inkSoft}>
          {profile.email}
        </Txt>
        {profile.groupIds.length > 1 ? (
          <Chips
            label="Switch group"
            options={profile.groupIds.map((id) => ({ value: id, label: id === groupId ? 'This group' : `Group ${profile.groupIds.indexOf(id) + 1}` }))}
            value={groupId}
            onChange={(id) => void run('switch', () => setActiveGroup(store, actor.uid, id))}
          />
        ) : null}
        <Row gap={space.sm} wrap>
          <Button small variant="secondary" label="Sign out" onPress={() => void session.signOut()} testID="sign-out" />
          <Button small variant="ghost" label="Leave group" loading={busy === 'leave'} onPress={() => void leave()} />
        </Row>
        {error ? <Banner kind="error" text={error} /> : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  person: { gap: space.sm, paddingVertical: space.sm },
  code: { alignItems: 'flex-start', paddingVertical: space.sm },
  demo: { backgroundColor: color.amberSoft, borderColor: color.amberSoft },
  version: { textAlign: 'center' },
});
