// Root layout: loads fonts and the backend, then routes by session state.
//   signed out             sign in, sign up, reset password
//   signed in, no group    welcome (create or join a group)
//   signed in with group   the tabs and their detail screens

import { PermanentMarker_400Regular, useFonts } from '@expo-google-fonts/permanent-marker';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createBackend, type Backend } from '@/data/backend';
import { BackendProvider } from '@/state/backend-context';
import { GroupDataProvider } from '@/state/group-data';
import { SessionProvider, useSession } from '@/state/session';
import { Banner, Loading, Screen, ToastProvider } from '@/ui/components';
import { color } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PermanentMarker_400Regular });
  const [backend, setBackend] = useState<Backend | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    createBackend().then(setBackend, (error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error));
    });
  }, []);

  useEffect(() => {
    if (failure) void SplashScreen.hideAsync().catch(() => undefined);
  }, [failure]);

  if (failure) {
    return (
      <Screen>
        <Banner kind="error" title="NutriPlanner could not start" text={`Check the Firebase values in .env.local. Details: ${failure}`} />
      </Screen>
    );
  }
  if (!backend || (!fontsLoaded && !fontError)) return null;

  return (
    <BackendProvider backend={backend}>
      <SessionProvider>
        <GroupDataProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ToastProvider>
        </GroupDataProvider>
      </SessionProvider>
    </BackendProvider>
  );
}

function RootNavigator() {
  const session = useSession();
  const loading = session.status === 'loading';
  const signedIn = session.status === 'signedIn';
  const hasGroup = signedIn && session.activeGroupId !== null;

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  const modal = { presentation: 'modal' } as const;

  return (
    <View style={styles.fill}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.evergreen,
          headerTitleStyle: { color: color.ink, fontWeight: '600' },
          contentStyle: { backgroundColor: color.bg },
        }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false, title: 'Sign in' }} />
          <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasGroup}>
          <Stack.Screen name="welcome" options={{ headerShown: false, title: 'Welcome' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasGroup}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="fridge/[id]" options={{ title: 'Fridge' }} />
          <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
          <Stack.Screen name="item/[id]" options={{ ...modal, title: 'Food' }} />
          <Stack.Screen name="item-form" options={{ ...modal, title: 'Add food' }} />
          <Stack.Screen name="fridge-form" options={{ ...modal, title: 'Fridge' }} />
          <Stack.Screen name="meal/[id]" options={{ ...modal, title: 'Meal' }} />
          <Stack.Screen name="meal-form" options={{ ...modal, title: 'Plan a meal' }} />
          <Stack.Screen name="recipe-form" options={{ ...modal, title: 'Recipe' }} />
          <Stack.Screen name="put-away" options={{ ...modal, title: 'Put shopping away' }} />
        </Stack.Protected>
      </Stack>
      {loading ? (
        <View style={StyleSheet.absoluteFill}>
          <Loading />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
});
