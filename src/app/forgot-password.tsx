import { useState } from 'react';

import { useBackend } from '@/state/backend-context';
import { useSession } from '@/state/session';
import { Banner, Button, Field, Screen, Txt } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color } from '@/ui/theme';

export default function ForgotPasswordScreen() {
  const { mode } = useBackend();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  const send = () =>
    void run('send', async () => {
      await session.sendPasswordReset(email);
      setSent(true);
    });

  return (
    <Screen footer={<Button label="Send reset link" loading={busy === 'send'} disabled={!email} onPress={send} />}>
      <Txt variant="callout" tone={color.inkSoft}>
        Enter the email you signed up with and we will send a link to choose a new password.
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setSent(false);
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        onSubmitEditing={send}
      />
      {error ? <Banner kind="error" text={error} /> : null}
      {sent ? (
        <Banner
          kind="success"
          text={
            mode === 'demo'
              ? 'Demo mode does not send emails. The demo password is demo1234.'
              : 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.'
          }
        />
      ) : null}
    </Screen>
  );
}
