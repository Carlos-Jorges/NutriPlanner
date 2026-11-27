// Signed in but not in a group yet: start one, or join with a code.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatInviteCode, normaliseInviteCode } from '@/core/invite-code';
import { DEMO_INVITE_CODE } from '@/data/demo-seed';
import { createGroup, joinGroup } from '@/data/services/groups';
import { useBackend } from '@/state/backend-context';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Field, Screen, TapeLabel, Txt, useToast } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function WelcomeScreen() {
  const { store, mode } = useBackend();
  const session = useSession();
  const toast = useToast();
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();
  const actor = session.actor;
  const profile = session.profile;

  if (!actor || !profile) return null;

  const create = () =>
    void run('create', async () => {
      await createGroup(store, actor, groupName);
      toast(`Created ${groupName.trim()}. You are its admin.`);
    });

  const join = () =>
    void run('join', async () => {
      const { groupName: joined } = await joinGroup(store, actor, profile, code);
      toast(`Joined ${joined}`);
    });

  return (
    <Screen testID="welcome-screen">
      <View style={styles.hero}>
        <Txt variant="label" tone={color.inkSoft}>
          Hi {actor.displayName}
        </Txt>
        <Txt variant="display">Set up your kitchen</Txt>
        <Txt variant="callout" tone={color.inkSoft}>
          NutriPlanner works in groups: one per household. Whoever starts the group becomes its admin and can invite
          everyone else.
        </Txt>
      </View>

      {error ? <Banner kind="error" text={error} /> : null}

      <Card>
        <Txt variant="title">Start a group</Txt>
        <Field
          label="Group name"
          value={groupName}
          onChangeText={setGroupName}
          placeholder="For example, Home kitchen"
          testID="group-name"
        />
        <Button label="Create group" icon="plus" loading={busy === 'create'} disabled={!groupName.trim()} onPress={create} testID="create-group" />
      </Card>

      <Card>
        <Txt variant="title">Join with a code</Txt>
        <Txt variant="callout" tone={color.inkSoft}>
          Ask your group admin for the 6 character invite code.
          {mode === 'demo' ? ` In demo mode, try ${formatInviteCode(DEMO_INVITE_CODE)}.` : ''}
        </Txt>
        <Field
          label="Invite code"
          value={code}
          onChangeText={(value) => setCode(normaliseInviteCode(value).slice(0, 6))}
          placeholder="ABC 234"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          testID="invite-code"
        />
        {code.length === 6 ? <TapeLabel text={formatInviteCode(code)} angle={-1.5} /> : null}
        <Button label="Join group" variant="secondary" icon="account-plus-outline" loading={busy === 'join'} disabled={code.length !== 6} onPress={join} testID="join-group" />
      </Card>

      <Button label="Sign out" variant="ghost" onPress={() => void session.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, paddingTop: space.xxl },
});
