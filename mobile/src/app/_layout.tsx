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

import { MOBILE_BUSINESS_WRITES_ENABLED, STUDENT_PRIVATE_CLEARANCE_ENABLED } from '@/api/config';
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
  const { session, globalSession, restoring } = useSession();

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
        <Stack.Protected guard={STUDENT_PRIVATE_CLEARANCE_ENABLED} redirectTo="/">
          <Stack.Screen name="d/[dept]/student-verify" />
        </Stack.Protected>
        <Stack.Protected guard={MOBILE_BUSINESS_WRITES_ENABLED} redirectTo="/">
          <Stack.Screen name="d/[dept]/submit-proof" />
        </Stack.Protected>

        {/* Global admins and department officers have independent authentication. */}
        <Stack.Protected guard={!session} redirectTo="/home">
          <Stack.Screen name="d/[dept]/sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={!globalSession} redirectTo="/global">
          <Stack.Screen name="global/sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !globalSession} redirectTo="/">
          <Stack.Screen name="(officer)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !globalSession && !!session.officer.allowedTabs.includes('tab-remittances')} redirectTo="/">
          <Stack.Screen name="officer/verify/[id]" />
        </Stack.Protected>

        <Stack.Protected
          guard={!!session && !globalSession && ['admin', 'administrator', 'master'].includes(String(session?.officer.role || '').toLowerCase())}
          redirectTo="/">
          <Stack.Screen name="officer/tenant-portal" />
        </Stack.Protected>

        <Stack.Protected guard={!!globalSession && !session} redirectTo="/">
          <Stack.Screen name="global/index" />
          <Stack.Screen name="global/tenant/[org]" />
          <Stack.Screen name="global/provisions/index" />
          <Stack.Protected guard={MOBILE_BUSINESS_WRITES_ENABLED} redirectTo="/global/provisions">
            <Stack.Screen name="global/provisions/new" />
          </Stack.Protected>
          <Stack.Screen name="global/provisions/[id]" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}
