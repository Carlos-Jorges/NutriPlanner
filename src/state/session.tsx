// The signed in person: their auth account and their profile document.
// Fixes two Day 1 defects:
//   * a relaunch restores the saved session (the auth listener drives state)
//   * a missing profile (for example a sign up interrupted by a lost
//     connection) is recreated instead of locking the account out

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';

import type { UserProfile } from '@/core/types';
import type { AuthUser } from '@/data/auth';
import { type Actor, ensureProfile } from '@/data/services/groups';
import { paths } from '@/data/store';
import { useBackend } from './backend-context';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface Session {
  status: SessionStatus;
  user: AuthUser | null;
  profile: UserProfile | null;
  actor: Actor | null;
  /** The group the app is showing. */
  activeGroupId: string | null;
  notice: string | null;
  clearNotice: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { auth, store } = useBackend();
  // undefined means "not known yet"
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  // Tagged with its owner, so a previous user's profile is never shown.
  const [loaded, setLoaded] = useState<{ uid: string; profile: UserProfile } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingName = useRef<string | null>(null);
  const creatingProfile = useRef(false);

  useEffect(() => auth.onChange(setUser), [auth]);

  useEffect(() => {
    if (!user) return;
    return store.onDoc<UserProfile>(
      paths.user(user.uid),
      (doc) => {
        if (doc) {
          setLoaded({ uid: user.uid, profile: doc });
          return;
        }
        if (creatingProfile.current) return;
        creatingProfile.current = true;
        ensureProfile(store, user, pendingName.current)
          .catch(() => setNotice('Could not create your profile. Check your connection and sign in again.'))
          .finally(() => {
            creatingProfile.current = false;
          });
      },
      () => {
        setNotice('Could not load your profile. Sign in again.');
        void auth.signOut();
      },
    );
  }, [auth, store, user]);

  const profile = user && loaded?.uid === user.uid ? loaded.profile : null;
  const status: SessionStatus =
    user === undefined || (user !== null && !profile) ? 'loading' : user ? 'signedIn' : 'signedOut';

  const activeGroupId =
    profile && profile.activeGroupId && profile.groupIds.includes(profile.activeGroupId)
      ? profile.activeGroupId
      : (profile?.groupIds[0] ?? null);

  const value: Session = {
    status,
    user: user ?? null,
    profile,
    actor: user && profile ? { uid: user.uid, displayName: profile.displayName } : null,
    activeGroupId,
    notice,
    clearNotice: () => setNotice(null),
    signIn: async (email, password) => {
      setNotice(null);
      await auth.signIn(email, password);
    },
    signUp: async (name, email, password) => {
      setNotice(null);
      pendingName.current = name;
      await auth.signUp(name, email, password);
    },
    signOut: async () => {
      pendingName.current = null;
      await auth.signOut();
    },
    sendPasswordReset: (email) => auth.sendPasswordReset(email),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
