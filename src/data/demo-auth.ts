// Demo mode sign in. Accounts live in the in memory store (and in this
// device's storage), never on a server. Passwords are stored as typed, which
// is acceptable only because demo data never leaves the device.

import { AppError } from '@/core/errors';
import { cleanName } from '@/core/names';
import { assertEmail, assertNewPassword, type AuthGateway, type AuthUser, normaliseEmail } from './auth';
import type { MemoryStore } from './memory-store';

interface DemoAccount {
  email: string;
  password: string;
  displayName: string;
}

export const DEMO_SESSION_PATH = '_demo/session';
export const demoAccountPath = (uid: string) => `_demoAccounts/${uid}`;

export function createDemoAuth(store: MemoryStore): AuthGateway {
  const listeners = new Set<(user: AuthUser | null) => void>();

  const accounts = (): [string, DemoAccount][] =>
    Object.entries(store.snapshot())
      .filter(([path]) => path.startsWith('_demoAccounts/'))
      .map(([path, data]) => [path.split('/')[1], data as unknown as DemoAccount]);

  const userFor = (uid: string): AuthUser | null => {
    const account = accounts().find(([id]) => id === uid)?.[1];
    return account ? { uid, email: account.email, displayName: account.displayName } : null;
  };

  const readCurrent = (): AuthUser | null => {
    const session = store.snapshot()[DEMO_SESSION_PATH] as { uid?: string } | undefined;
    return session?.uid ? userFor(session.uid) : null;
  };

  let current = readCurrent();

  const emit = () => listeners.forEach((listener) => listener(current));

  // Resetting the demo data clears the session too.
  store.onAnyChange(() => {
    const next = readCurrent();
    if (next?.uid !== current?.uid) {
      current = next;
      emit();
    }
  });

  const startSession = async (user: AuthUser) => {
    current = user;
    await store.set(DEMO_SESSION_PATH, { uid: user.uid });
    emit();
    return user;
  };

  return {
    kind: 'demo',

    onChange: (listener) => {
      listeners.add(listener);
      setTimeout(() => listener(current), 0);
      return () => {
        listeners.delete(listener);
      };
    },

    signIn: async (email, password) => {
      const address = normaliseEmail(email);
      assertEmail(address);
      const match = accounts().find(([, account]) => account.email === address);
      if (!match || match[1].password !== password) throw new AppError('wrong-credentials');
      return startSession({ uid: match[0], email: address, displayName: match[1].displayName });
    },

    signUp: async (displayName, email, password) => {
      const address = normaliseEmail(email);
      assertEmail(address);
      assertNewPassword(password);
      if (accounts().some(([, account]) => account.email === address)) throw new AppError('email-in-use');
      const uid = `demo_${store.newId('_demoAccounts')}`;
      const name = cleanName(displayName);
      await store.set(demoAccountPath(uid), { email: address, password, displayName: name });
      return startSession({ uid, email: address, displayName: name });
    },

    signOut: async () => {
      current = null;
      await store.remove(DEMO_SESSION_PATH);
      emit();
    },

    sendPasswordReset: async (email) => {
      assertEmail(normaliseEmail(email));
    },
  };
}
