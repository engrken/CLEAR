import {
  BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, useFonts,
} from '@expo-google-fonts/figtree';
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
  });

  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <SessionProvider>
        <Navigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

function Navigator() {
  const { c } = useTheme();
  const { session, restoring } = useSession();

  // Keep the splash up until fonts are in and any stored session is re-checked.
  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync();
  }, [restoring]);

  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: c.canvas, card: c.canvas, text: c.ink, border: c.border, primary: c.accent },
  };
  if (restoring) return null;

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack
        // Bright Campus screens draw their own headers (back button, chips, coloured blocks).
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="d/[dept]/index" />
        <Stack.Screen name="d/[dept]/clearance" />
        <Stack.Screen name="d/[dept]/submit-proof" />

        {/* Guards drive auth navigation: signing in sends sign-in to /home, signing out sends officer screens to /. */}
        <Stack.Protected guard={!session} redirectTo="/home">
          <Stack.Screen name="d/[dept]/sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={!!session} redirectTo="/">
          <Stack.Screen name="(officer)" />
          <Stack.Screen name="officer/verify/[id]" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}
