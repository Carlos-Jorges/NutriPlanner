import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@/data/auth';
import { useBackend } from '@/state/backend-context';
import { useSession } from '@/state/session';
import { Banner, Button, Field, Screen, Txt } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color } from '@/ui/theme';

export default function SignUpScreen() {
  const { mode } = useBackend();
  const session = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, setError, run } = useAction();

  const submit = () => {
    if (!name.trim()) return setError('Enter your name, so your family knows who added what.');
    if (password !== confirm) return setError('The two passwords do not match.');
    void run('signup', () => session.signUp(name.trim(), email, password));
  };

  return (
    <Screen
      testID="sign-up-screen"
      footer={
        <Button
          label="Create account"
          loading={busy === 'signup'}
          disabled={!name || !email || !password || !confirm}
          onPress={submit}
          testID="create-account"
        />
      }>
      <Txt variant="callout" tone={color.inkSoft}>
        {mode === 'demo'
          ? 'Demo mode: this account only exists on this device.'
          : 'Each person in the family gets their own account, so everyone can see who added and used what.'}
      </Txt>
      <Field label="Your name" value={name} onChangeText={setName} placeholder="First name is fine" autoComplete="name" textContentType="name" testID="signup-name" />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        testID="signup-email"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        testID="signup-password"
      />
      <Field
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        testID="signup-confirm"
      />
      {error ? <Banner kind="error" text={error} /> : null}
    </Screen>
  );
}
