// Chooses the backend at start up:
//   Firebase  when the EXPO_PUBLIC_FIREBASE_* values are set
//   demo      otherwise (or when EXPO_PUBLIC_DEMO_MODE=1)
// Demo data is kept on the device so it survives a reload.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthGateway } from './auth';
import { createDemoAuth } from './demo-auth';
import { buildDemoSeed } from './demo-seed';
import { emulatorHost, firebaseConfigFromEnv, hasFirebaseConfig, initFirebase } from './firebase-app';
import { createFirebaseAuth } from './firebase-auth';
import { createFirebaseStore } from './firebase-store';
import { createMemoryStore, type MemoryStore } from './memory-store';
import type { DocData, Store } from './store';

export interface Backend {
  mode: 'firebase' | 'demo';
  store: Store;
  auth: AuthGateway;
  usingEmulator: boolean;
  /** Demo mode only: put the sample data back. */
  resetDemo: (() => Promise<void>) | null;
}

const DEMO_STORAGE_KEY = 'nutriplanner.demo.v1';

async function loadDemoDocs(): Promise<Record<string, DocData>> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; docs?: Record<string, DocData> };
      if (parsed.version === 1 && parsed.docs) return parsed.docs;
    }
  } catch {
    // Storage unavailable (private browsing, for example): start fresh.
  }
  return buildDemoSeed();
}

async function saveDemoDocs(store: MemoryStore): Promise<void> {
  try {
    await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, docs: store.snapshot() }));
  } catch {
    // Demo data simply will not survive a reload.
  }
}

export async function createBackend(): Promise<Backend> {
  const config = firebaseConfigFromEnv();
  const forceDemo = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

  if (!forceDemo && hasFirebaseConfig(config)) {
    const { auth, db } = initFirebase(config);
    return {
      mode: 'firebase',
      store: createFirebaseStore(db),
      auth: createFirebaseAuth(auth),
      usingEmulator: emulatorHost() !== null,
      resetDemo: null,
    };
  }

  const store = createMemoryStore(await loadDemoDocs());
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  store.onAnyChange(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveDemoDocs(store), 300);
  });

  return {
    mode: 'demo',
    store,
    auth: createDemoAuth(store),
    usingEmulator: false,
    resetDemo: async () => {
      store.restore(buildDemoSeed());
      await saveDemoDocs(store);
    },
  };
}
