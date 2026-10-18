import {
  IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
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
  const { name, c } = useTheme();
  const { session, restoring } = useSession();

  // Keep the splash up until fonts are in and any stored session is re-checked.
  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync();
  }, [restoring]);

  const base = name === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.canvas, card: c.surface, text: c.ink, border: c.border, primary: c.accent },
  };
  const header = { fontFamily: 'IBMPlexSans_600SemiBold' };
  if (restoring) return null;

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.ink,
          headerTitleStyle: header,
          headerBackTitleStyle: header,
          headerTransparent: false,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.canvas },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="d/[dept]/index" options={{ title: '' }} />
        <Stack.Screen name="d/[dept]/clearance" options={{ title: 'Clearance' }} />
        <Stack.Screen name="d/[dept]/submit-proof" options={{ title: 'Submit payment proof' }} />

        {/* Guards drive auth navigation: signing in sends sign-in to /home, signing out sends officer screens to /. */}
        <Stack.Protected guard={!session} redirectTo="/home">
          <Stack.Screen name="d/[dept]/sign-in" options={{ title: 'Officer sign-in' }} />
        </Stack.Protected>

        <Stack.Protected guard={!!session} redirectTo="/">
          <Stack.Screen name="(officer)" options={{ headerShown: false }} />
          <Stack.Screen name="officer/verify/[id]" options={{ title: 'Review remittance' }} />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}
