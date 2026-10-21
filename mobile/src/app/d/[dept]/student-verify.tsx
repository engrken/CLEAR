import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { api, type StudentSelfClearance } from '@/api';
import { BackHeader, Banner, Button, ClearanceCard, Screen, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

type Step = 'email' | 'code' | 'cleared';

/**
 * Student identity is proven by an OTP sent to the registered roster email.
 * School IDs, arbitrary email lookups and officer tokens are never credentials.
 * The student bearer token exists only in screen memory and expires server-side.
 */
export default function StudentVerify() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [result, setResult] = useState<StudentSelfClearance | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = useRef<string | null>(null);

  useEffect(() => () => {
    // Revocation is best effort; the backend also enforces a 10-minute expiry.
    if (token.current) void api.revokeStudentSession(dept, token.current);
  }, [dept]);

  const requestCode = async () => {
    setBusy(true);
    setError('');
    try {
      await api.requestStudentCode(dept, email);
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      const auth = await api.verifyStudentCode(dept, email, code);
      token.current = auth.token;
      setResult(await api.getMyStudentClearance(dept, auth.token));
      setStep('cleared');
      setCode('');
    } catch (e) {
      if (token.current) {
        await api.revokeStudentSession(dept, token.current);
        token.current = null;
      }
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  const closeSession = async () => {
    if (token.current) await api.revokeStudentSession(dept, token.current);
    token.current = null;
    setResult(null);
    setEmail('');
    setCode('');
    setStep('email');
  };

  return (
    <Screen header={<BackHeader />} contentStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">My clearance</Text>
      <Text color="inkMuted">Verify the email registered with your department to view your own status.</Text>
      {error ? <Banner tone="danger" title="Unable to verify">{error}</Banner> : null}

      {step === 'email' ? (
        <View style={styles.form}>
          <Text variant="label">Registered student email</Text>
          <TextInput
            value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" autoComplete="email" accessibilityLabel="Registered student email"
            placeholder="student@school.edu" placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.soft, color: c.ink }]}
          />
          <Button block disabled={busy || !email.trim()} onPress={requestCode}>
            {busy ? 'Sending…' : 'Email me a verification code'}
          </Button>
        </View>
      ) : null}

      {step === 'code' ? (
        <View style={styles.form}>
          <Banner tone="info" title="Check your registered inbox">
            If this address has an eligible student record, a six-digit code will arrive. It expires in 5 minutes.
          </Banner>
          <Text variant="label">Six-digit verification code</Text>
          <TextInput
            value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" maxLength={6} autoComplete="one-time-code"
            accessibilityLabel="Six-digit verification code" placeholder="000000"
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.soft, color: c.ink, letterSpacing: 6 }]}
          />
          <Button block disabled={busy || code.length !== 6} onPress={verify}>
            {busy ? 'Verifying…' : 'Verify and view my clearance'}
          </Button>
          <Button block variant="ghost" disabled={busy} onPress={() => { setStep('email'); setCode(''); }}>
            Use a different registered email
          </Button>
        </View>
      ) : null}

      {step === 'cleared' && result ? (
        <View style={styles.form}>
          <ClearanceCard
            orgName={dept} studentName="" studentId="" status={result.status}
            outstanding={null} qrToken={undefined} ay={result.ay} term={result.term}
          />
          <Text variant="bodySm" color="inkMuted">
            This view confirms your current clearance status only. For a signed certificate, contact your tenant office.
          </Text>
          <Button block variant="secondary" onPress={closeSession}>Sign out of student view</Button>
        </View>
      ) : null}
      {busy ? <ActivityIndicator color={c.cobalt} /> : null}
      <Text variant="caption" color="inkMuted">
        No email on your student record? Contact your department admin to register an authorized address.
        Never share OTP codes.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing[3], paddingBottom: spacing[5], gap: spacing[3] },
  form: { gap: spacing[3] },
  input: { minHeight: 52, paddingHorizontal: 16, borderRadius: radius.md, fontSize: 16 },
});
