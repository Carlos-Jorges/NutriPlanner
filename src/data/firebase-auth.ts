// Firebase Authentication implementation of AuthGateway.

import {
  type Auth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { toAppError } from '@/core/errors';
import { assertEmail, assertNewPassword, type AuthGateway, type AuthUser, normaliseEmail } from './auth';

const toUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email ?? '',
  displayName: user.displayName,
});

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toAppError(error);
  }
}

export function createFirebaseAuth(auth: Auth): AuthGateway {
  return {
    kind: 'firebase',

    onChange: (listener) => onAuthStateChanged(auth, (user) => listener(user ? toUser(user) : null)),

    signIn: (email, password) =>
      guard(async () => {
        const address = normaliseEmail(email);
        assertEmail(address);
        const credential = await signInWithEmailAndPassword(auth, address, password);
        return toUser(credential.user);
      }),

    signUp: (displayName, email, password) =>
      guard(async () => {
        const address = normaliseEmail(email);
        assertEmail(address);
        assertNewPassword(password);
        const credential = await createUserWithEmailAndPassword(auth, address, password);
        await updateProfile(credential.user, { displayName });
        return { ...toUser(credential.user), displayName };
      }),

    signOut: () => guard(() => signOut(auth)),

    sendPasswordReset: (email) =>
      guard(async () => {
        const address = normaliseEmail(email);
        assertEmail(address);
        await sendPasswordResetEmail(auth, address);
      }),
  };
}
