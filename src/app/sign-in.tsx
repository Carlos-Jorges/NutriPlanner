import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DEMO_PASSWORD, DEMO_PEOPLE } from '@/data/demo-seed';
import { useBackend } from '@/state/backend-context';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Field, Screen, Stack, TapeLabel, Txt } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function SignInScreen() {
  const { mode } = useBackend();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();

  const signIn = (address: string, secret: string, key: string) => run(key, () => session.signIn(address, secret));

  return (
    <Screen testID="sign-in-screen">
      <View style={styles.hero}>
        <TapeLabel text="NUTRIPLANNER" angle={-3} large />
        <Txt variant="title" style={styles.tagline}>
          Your family’s fridges, meals and shopping, in one place.
        </Txt>
      </View>

      {session.notice ? <Banner kind="warning" text={session.notice} /> : null}

      {mode === 'demo' ? (
        <Card>
          <Txt variant="heading">Demo mode</Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            Firebase is not connected yet, so you are exploring sample data that stays on this device. Alex is the
            family’s meal planner. Try both roles to see what admins and members can do.
          </Txt>
          <Button
            label="Explore as Alex (admin)"
            icon="chef-hat"
            loading={busy === 'alex'}
            onPress={() => void signIn(DEMO_PEOPLE.alex.email, DEMO_PASSWORD, 'alex')}
            testID="demo-admin"
          />
          <Button
            label="Explore as Mia (member)"
            variant="secondary"
            icon="account-outline"
            loading={busy === 'mia'}
            onPress={() => void signIn(DEMO_PEOPLE.mia.email, DEMO_PASSWORD, 'mia')}
            testID="demo-member"
          />
        </Card>
      ) : null}

      <Stack>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          testID="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => void signIn(email, password, 'form')}
          testID="password"
        />
        {error ? <Banner kind="error" text={error} /> : null}
        <Button
          label="Sign in"
          loading={busy === 'form'}
          disabled={!email || !password}
          onPress={() => void signIn(email, password, 'form')}
          testID="sign-in"
        />
        <View style={styles.links}>
          <Link href="/forgot-password" style={styles.link}>
            Forgot password?
          </Link>
          <Link href="/sign-up" style={styles.link} testID="go-sign-up">
            Create an account
          </Link>
        </View>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.lg, paddingTop: space.xxl, paddingBottom: space.sm },
  tagline: { maxWidth: 420 },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.md, paddingTop: space.xs },
  link: { color: color.evergreen, fontWeight: '600', fontSize: 15, paddingVertical: space.sm },
});
