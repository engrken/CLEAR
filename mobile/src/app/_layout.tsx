import {
  BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, useFonts,
} from '@expo-google-fonts/figtree';
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { AppState, View, ActivityIndicator } from 'react-native';
import { biometricEnabled, unlockWithBiometrics } from '@/lib/biometrics';
import { Button, Text } from '@/components/ui';

import { MOBILE_BUSINESS_WRITES_ENABLED, TENANT_OPERATIONS_ENABLED } from '@/api/config';
import { DataPrivacyNotice } from '@/components/privacy/DataPrivacyNotice';
import { ServiceAdvisory } from '@/components/maintenance/ServiceAdvisory';
import { getItem, setItem } from '@/lib/secure-storage';
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
  const { session, globalSession, restoring, signOut } = useSession();
  const [lock, setLock] = useState<{ key: string; status: 'checking' | 'locked' | 'open' }>({ key: '', status: 'checking' });
  const identity = globalSession ? { kind: 'global' as const, id: globalSession.admin.id, token: globalSession.token } :
    session ? { kind: 'officer' as const, id: session.officer.id, token: session.token } : null;
  const key = identity ? identity.kind + ':' + identity.id + ':' + identity.token : '';
  const foreground = useRef(AppState.currentState);
  const lockEpoch = useRef(0);
  // An OS biometric prompt may temporarily background the Activity. The screen
  // is already hidden behind 'checking' while that prompt is in progress.
  const biometricPromptActive = useRef(false);
  useEffect(() => {
    let live = true;
    const epoch = ++lockEpoch.current;
    if (restoring) return () => { live = false; };
    if (!identity) return () => { live = false; };
    void biometricEnabled(identity).then(e => { if (live && epoch === lockEpoch.current) setLock({ key, status: e ? 'locked' : 'open' }); })
      .catch(() => { if (live && epoch === lockEpoch.current) setLock({ key, status: 'locked' }); });
    return () => { live = false; };
  }, [restoring, key]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active' && foreground.current === 'active' && identity && !biometricPromptActive.current) {
        const epoch = ++lockEpoch.current;
        // Deny access immediately; asynchronous preference reads must not leave a visible unlocked frame.
        setLock({ key, status: 'locked' });
        void biometricEnabled(identity).then(e => {
          if (epoch === lockEpoch.current) setLock({ key, status: e ? 'locked' : 'open' });
        }).catch(() => { if (epoch === lockEpoch.current) setLock({ key, status: 'locked' }); });
      }
      foreground.current = next;
    });
    return () => sub.remove();
  }, [key]);
  const unlock = async () => {
    if (!identity || biometricPromptActive.current) return;
    const epoch = ++lockEpoch.current;
    biometricPromptActive.current = true;
    setLock({ key, status: 'checking' });
    try {
      const verified = await unlockWithBiometrics(identity).catch(() => false);
      if (epoch === lockEpoch.current) {
        // Do not display session data unless the app is actually in foreground.
        setLock({ key, status: verified && AppState.currentState === 'active' ? 'open' : 'locked' });
      }
    } finally {
      biometricPromptActive.current = false;
    }
  };
  const pathname = usePathname();
  const routeTenant = /^\/(?:d|global\/tenant)\/([a-z0-9-]+)/.exec(pathname)?.[1] || null;
  const advisoryTenant = routeTenant || session?.org.subdomain || null;
  const [privacyReady, setPrivacyReady] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);

  useEffect(() => {
    let active = true;
    void getItem('clear_privacy_notice_ack_v1')
      .then((value) => { if (active) setPrivacyAcknowledged(value === 'true'); })
      .catch(() => { if (active) setPrivacyAcknowledged(false); })
      .finally(() => { if (active) setPrivacyReady(true); });
    return () => { active = false; };
  }, []);

  const acknowledgePrivacy = () => {
    setPrivacyAcknowledged(true);
    void setItem('clear_privacy_notice_ack_v1', 'true').catch(() => {
      // A failed local write means the disclosure will be shown again next launch.
    });
  };

  // Keep the splash up until fonts are in and any stored session is re-checked.
  useEffect(() => {
    if (!restoring && privacyReady) void SplashScreen.hideAsync();
  }, [restoring, privacyReady]);

  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: c.canvas, card: c.canvas, text: c.ink, border: c.border, primary: c.accent },
  };
  if (restoring || !privacyReady) return null;
  const effectiveLock = lock.key === key ? lock.status : 'checking';
  if (identity && effectiveLock !== 'open') return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 20 }}>
    <Text variant="headline">CLEAR security lock</Text>
    <Text variant="bodySm">Use your enrolled fingerprint or face to unlock; follow the OS prompt if it offers a device passcode. Otherwise sign out and use OTP. Server permissions remain enforced.</Text>
    {effectiveLock === 'checking' ? <ActivityIndicator /> : <Button block onPress={() => void unlock()}>Unlock with biometrics</Button>}
    <Button block variant="secondary" onPress={() => void signOut()}>Sign out and use OTP</Button>
  </View>;

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack
        // Bright Campus screens draw their own headers (back button, chips, coloured blocks).
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="organizations" />
        <Stack.Screen name="d/[dept]/index" />
        <Stack.Screen name="d/[dept]/clearance" />
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
          <Stack.Screen name="officer/profile" />
          <Stack.Screen name="officer/walkthrough" />
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
          <Stack.Screen name="global/account" />
          <Stack.Screen name="global/maintenance" />
          <Stack.Screen name="global/tenant/[org]" />
          <Stack.Screen name="global/provisions/index" />
          <Stack.Protected guard={TENANT_OPERATIONS_ENABLED} redirectTo="/global/provisions">
            <Stack.Screen name="global/provisions/new" />
          </Stack.Protected>
          <Stack.Screen name="global/provisions/[id]" />
        </Stack.Protected>
      </Stack>
      <DataPrivacyNotice
        visible={!privacyAcknowledged}
        required
        onDismiss={acknowledgePrivacy}
      />
      <ServiceAdvisory tenant={advisoryTenant} enabled={privacyAcknowledged} />
    </NavThemeProvider>
  );
}
