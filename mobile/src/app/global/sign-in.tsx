import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, ApiError } from '@/api';
import { Banner, Button, ColorHeader, OtpInput, Screen, Text, TextField } from '@/components/ui';
import { useSession } from '@/lib/session';

const WAIT = 60;

export default function GlobalAdminSignIn() {
  const { signInGlobal } = useSession();
  const [email, setEmail] = useState('');
  const [requestedEmail, setRequestedEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (busy || cooldown > 0) return;
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setError('Enter a valid administrator email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.requestGlobalCode(normalized);
      setRequestedEmail(normalized);
      setCode('');
      setCooldown(WAIT);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (digits = code) => {
    if (busy || !requestedEmail || digits.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      await signInGlobal(await api.verifyGlobalCode(requestedEmail, digits));
      // The root stack guard redirects to /global after the session is saved.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_code') setCode('');
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitted = !!requestedEmail;
  return (
    <Screen
      edges={['bottom']}
      contentStyle={styles.content}
      header={
        <ColorHeader
          tone={submitted ? 'sun' : 'ink'}
          icon="shield"
          title={submitted ? 'Check your email' : 'Global administrator'}
          body={submitted
            ? 'Enter the six-digit verification code. It expires in five minutes.'
            : 'Use your authorized global CLEAR account. This sign-in is separate from department officers.'}
        />
      }
      footer={
        <Button
          block
          loading={busy}
          disabled={submitted ? code.length !== 6 : cooldown > 0}
          onPress={submitted ? () => void verifyCode() : () => void sendCode()}>
          {submitted ? 'Verify and sign in' : 'Email me a code'}
        </Button>
      }>
      <StatusBar style={submitted ? 'dark' : 'light'} />
      {error ? <Banner tone="danger" title="Sign-in problem">{error}</Banner> : null}
      {!submitted ? (
        <TextField
          label="Global administrator email"
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          placeholder="admin@example.org"
          onChangeText={(value) => { setEmail(value); setError(''); }}
          helper="Only authorized global administrators receive a code."
          onSubmitEditing={() => void sendCode()}
        />
      ) : (
        <View style={styles.code}>
          <Text variant="bodySm" color="inkMuted">
            If this address is authorized, a code was sent to {requestedEmail}.
          </Text>
          <Text variant="label">Verification code</Text>
          <OtpInput
            value={code}
            onChange={(digits) => { setCode(digits); setError(''); }}
            onComplete={(digits) => void verifyCode(digits)}
            helper="Check your inbox and spam folder. Codes expire after five minutes."
            error={error || undefined}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || cooldown > 0}
            onPress={() => void sendCode()}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification code'}
          </Button>
          <Button size="sm" variant="secondary" onPress={() => {
            setRequestedEmail('');
            setCode('');
            setError('');
          }}>
            Change email
          </Button>
        </View>
      )}
      <Banner tone="info" title="Protected administrator access">
        This session is separate from department users. Finance posting and provisioning are not enabled in the Android preview.
      </Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 18 },
  code: { gap: 16 },
});
