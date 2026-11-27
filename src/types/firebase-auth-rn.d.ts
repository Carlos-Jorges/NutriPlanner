// Firebase ships getReactNativePersistence only in its React Native build.
// Metro picks that build on iOS and Android, but TypeScript reads the
// browser typings, so the export is declared here. It is only called when
// Platform.OS is not 'web' (see src/data/firebase-app.ts).

import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
