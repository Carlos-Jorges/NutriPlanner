// Firebase initialisation. Reads the web app config from EXPO_PUBLIC_*
// environment variables (see .env.example).
//
// Auth persistence differs by platform:
//   iOS and Android  AsyncStorage, so people stay signed in between launches
//   web              the browser's local storage
//
// Firestore cache: the JS SDK can only keep an on disk cache in browsers
// (IndexedDB). On phones it caches in memory, so data needs a connection
// after the app restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { Platform } from 'react-native';

export function firebaseConfigFromEnv(): FirebaseOptions {
  // Each variable must be referenced literally so Expo can inline it.
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
}

export function hasFirebaseConfig(config: FirebaseOptions): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

export function emulatorHost(): string | null {
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  return host && host.trim() ? host.trim() : null;
}

let services: { auth: Auth; db: Firestore } | null = null;

export function initFirebase(config: FirebaseOptions): { auth: Auth; db: Firestore } {
  if (services) return services;
  const firstRun = getApps().length === 0;
  const app = firstRun ? initializeApp(config) : getApp();

  let auth: Auth;
  let db: Firestore;
  if (firstRun) {
    auth = initializeAuth(app, {
      persistence: Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(AsyncStorage),
    });
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache:
        Platform.OS === 'web'
          ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          : memoryLocalCache(),
    });
    const host = emulatorHost();
    if (host) {
      connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
    }
  } else {
    // Fast refresh during development re-runs this module.
    auth = getAuth(app);
    db = getFirestore(app);
  }
  services = { auth, db };
  return services;
}
