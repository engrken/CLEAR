import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError, DEMO_OTP, type Organization } from '@/api';
import { Banner, Button, ColorHeader, OtpInput, Screen, Text, TextField } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, useTheme } from '@/theme';

const RESEND_AFTER = 60; // the server sends at most one code per 60 s (and 10 a day)

/**
 * Officer sign-in: email, then the 6-digit code that expires in 5 minutes.
 * The server answers a code request the same way whether or not the email is
 * an officer's, so the copy stays neutral.
 */
export default function SignIn() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const router = useRouter();
  const { signIn } = useSession();
  const org = useAsync<Organization>(() => api.getOrganization(dept), dept);

  const [email, setEmail] = useState('');
  /** The address the code was requested for; verify sends this, not the (possibly masked) `sentTo`. */
  const [requested, setRequested] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email address your department registered.');
    setBusy(true);
    setError(undefined);
    try {
      const r = await api.requestCode(dept, email);
      setRequested(email.trim().toLowerCase());
      setSentTo(r.sentTo || email.trim().toLowerCase());
      setCode('');
      setCooldown(RESEND_AFTER);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(undefined);
    try {
      // The root layout's guard redirects to /home once the session is set.
      await signIn(await api.verifyCode(dept, requested!, value));
    } catch (e) {
      // invalid_code: wrong, expired or too many attempts. The server's message says which.
      if (e instanceof ApiError && e.code === 'invalid_code') setCode('');
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const orgName = org.data?.name;

  if (!sentTo || !requested) {
    return (
      <Screen
        edges={['bottom']}
        contentStyle={styles.content}
        header={
          <ColorHeader
            tone="ink"
            icon="shield"
            title="Officer sign-in"
            body="We’ll email a 6-digit code to your registered officer address. No password needed."
          />
        }
        footer={<Button block icon="envelope" onPress={send} loading={busy} loadingLabel="Sending code…">Email me a code</Button>}>
        <StatusBar style="light" />
        <TextField
          label="Your officer email"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(undefined); }}
          placeholder="officer@school.edu.ph"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={send}
          helper={`Treasurers, auditors and admins of ${orgName ?? 'this department'}.`}
          error={error}
        />
        <Banner tone="info" title="Global Superadmin?">
          Global administrators use their own OTP sign-in and can select JIECEP or any other tenant afterward.
        </Banner>
        <Button block variant="secondary" icon="shield" onPress={() => router.push('/global/sign-in')}>
          Sign in as Global Superadmin
        </Button>
        {api.mode === 'mock' ? (
          <Banner tone="info" title="Offline demo">
            Sign in as admin, treasurer, auditor or viewer@{dept}.local.
          </Banner>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      contentStyle={styles.codeContent}
      header={
        <ColorHeader
          tone="sun"
          icon="envelope"
          title="Check your email"
          body={
            <Text variant="body" style={{ color: SUN_MUTED }}>
              If <Text variant="bodyStrong" style={{ color: SUN_MUTED }}>{sentTo}</Text> belongs to an active officer of{' '}
              {orgName ?? 'this department'}, we sent a 6-digit code. It expires in 5 minutes.
            </Text>
          }
        />
      }
      footer={<Button block onPress={() => verify()} loading={busy} loadingLabel="Verifying…" disabled={code.length !== 6}>Verify and sign in</Button>}>
      <StatusBar style="dark" />
      <Text variant="label" style={styles.codeLabel}>Your code</Text>
      <OtpInput
        value={code}
        onChange={(v) => { setCode(v); setError(undefined); }}
        onComplete={verify}
        error={error}
        helper={api.mode === 'mock' ? `Offline demo: use ${DEMO_OTP}.` : 'Not there? Check your spam folder.'}
      />
      <View style={styles.links}>
        <ResendPill seconds={cooldown} disabled={cooldown > 0 || busy} onPress={send} />
        <Button
          variant="secondary"
          size="sm"
          onPress={() => router.push('/global/sign-in')}>
          Use Global Superadmin OTP instead
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => { setSentTo(undefined); setRequested(undefined); setCode(''); setError(undefined); }}>
          Different email
        </Button>
      </View>
    </Screen>
  );
}

/** The sun header's body colour (ColorHeader uses the same value for string bodies). */
const SUN_MUTED = '#3A2E05';

/** "Resend in 42s" on a soft pill while the timer runs; a cobalt-tint pill once a new code can be sent. */
function ResendPill({ seconds, disabled, onPress }: { seconds: number; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const waiting = seconds > 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: waiting ? c.soft : c.cobaltTint, opacity: pressed ? 0.8 : !waiting && disabled ? 0.45 : 1 },
      ]}>
      <Text variant="button" color={waiting ? 'inkMuted' : 'cobalt'} style={styles.pillText}>
        {waiting ? `Resend in ${seconds}s` : 'Resend code'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28, paddingHorizontal: 20 },
  codeContent: { paddingTop: 28, paddingHorizontal: 20, gap: 18 },
  codeLabel: { fontSize: 15 },
  links: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: { minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 14 },
});
