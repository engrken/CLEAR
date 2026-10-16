import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api, DEMO_OTP } from '@/api';
import { Banner, Button, OtpInput, Screen, Text, TextField } from '@/components/ui';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme';

const RESEND_AFTER = 60; // the server refuses a new code within 60 s (429 cooldown)

/** Officer sign-in: email, then the 6-digit code that expires in 5 minutes. */
export default function SignIn() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
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
      setSentTo(r.sentTo);
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
      await signIn(await api.verifyCode(dept, sentTo!, value));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!sentTo) {
    return (
      <Screen
        edges={['bottom']}
        footer={<Button block icon="envelope" onPress={send} loading={busy} loadingLabel="Sending code…">Send code</Button>}>
        <View style={{ gap: spacing[2] }}>
          <Text variant="title">Sign in with your email</Text>
          <Text color="inkMuted">We’ll email a 6-digit code to your registered officer address. No password needed.</Text>
        </View>
        <TextField
          label="Email address"
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
          error={error}
        />
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
      footer={<Button block onPress={() => verify()} loading={busy} loadingLabel="Verifying…" disabled={code.length !== 6}>Verify and sign in</Button>}>
      <View style={{ gap: spacing[2] }}>
        <Text variant="title">Enter the code</Text>
        <Text color="inkMuted">
          Sent to <Text variant="bodyStrong">{sentTo}</Text>. It expires in 5 minutes.
        </Text>
      </View>
      <OtpInput value={code} onChange={(v) => { setCode(v); setError(undefined); }} onComplete={verify} error={error} helper={api.mode === 'mock' ? `Offline demo: use ${DEMO_OTP}.` : 'Check your inbox and spam folder.'} />
      <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" onPress={send} disabled={cooldown > 0 || busy}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </Button>
        <Button variant="ghost" size="sm" onPress={() => { setSentTo(undefined); setError(undefined); }}>
          Use a different email
        </Button>
      </View>
    </Screen>
  );
}
