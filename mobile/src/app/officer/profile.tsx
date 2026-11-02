import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput } from 'react-native';

import { api } from '@/api';
import { BackHeader, Banner, Button, Card, Screen, Text } from '@/components/ui';
import { useOfficerSession, useSession } from '@/lib/session';
import { spacing, useTheme } from '@/theme';
import { BiometricSettings } from '@/components/security/BiometricSettings';

type Stage = 'start' | 'current_code' | 'new_address' | 'new_code' | 'complete';
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254;

/** Personal metadata only, guarded by live officer session and a dual-address OTP. */
export default function OfficerProfile() {
  const session = useOfficerSession();
  const { signOut } = useSession();
  const router = useRouter();
  const { c } = useTheme();
  const [stage, setStage] = useState<Stage>('start');
  const [writeStatus, setWriteStatus] = useState<{ token: string; state: 'disabled' | 'enabled' }>({ token: '', state: 'disabled' });
  const effectiveWriteStatus = writeStatus.token === session.token ? writeStatus.state : 'checking';
  useEffect(() => {
    let active = true;
    void api.getWriteCapabilities(session).then((policy) => {
      if (active) setWriteStatus({ token: session.token, state: policy.enabled && Array.isArray(policy.grants) && policy.grants.some((grant) => grant?.organization === session.org.subdomain) ? 'enabled' : 'disabled' });
    }).catch(() => {
      // Network failure never implies permission to post transactions.
      if (active) setWriteStatus({ token: session.token, state: 'disabled' });
    });
    return () => { active = false; };
  }, [session.token, session.org.subdomain]);
  const [currentCode, setCurrentCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account verification is unavailable.');
    } finally { setBusy(false); }
  };
  const start = () => void run(async () => {
    await api.requestOfficerEmailChangeCurrentCode(session);
    setStage('current_code');
    setNotice('If eligible, a verification code has been sent to your current officer email.');
  });
  const verifyOld = () => {
    if (!/^\d{6}$/.test(currentCode.trim())) return setError('Enter your six-digit current-email code.');
    void run(async () => {
      await api.verifyOfficerEmailChangeCurrentCode(session, currentCode.trim());
      setCurrentCode(''); setStage('new_address');
      setNotice('Current email confirmed. Enter your new address.');
    });
  };
  const requestNew = () => {
    const next = newEmail.trim().toLowerCase();
    if (!validEmail(next) || next === session.officer.email.trim().toLowerCase()) {
      return setError('Enter a different, valid email address.');
    }
    void run(async () => {
      await api.requestOfficerEmailChangeNewCode(session, next);
      setNewEmail(next);
      setStage('new_code');
      setNotice('If the new address is eligible, a code has been sent there.');
    });
  };
  const confirm = () => {
    if (!/^\d{6}$/.test(newCode.trim())) return setError('Enter the six-digit new-email code.');
    Alert.alert(
      'Confirm your login email change?',
      `Your login email will become ${newEmail.trim().toLowerCase()}. Existing sessions will be revoked and you must sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Email',
          onPress: () => void run(async () => {
            await api.confirmOfficerEmailChange(session, newEmail.trim().toLowerCase(), newCode.trim());
            setNewCode(''); setStage('complete');
            setNotice('Your email has changed. Existing officer sessions were revoked; sign in again using the new address.');
          }),
        },
      ],
    );
  };
  const finish = async () => {
    setBusy(true);
    try {
      await signOut();
      router.replace({ pathname: '/d/[dept]/sign-in', params: { dept: session.org.subdomain } });
    } catch {
      setError('Please sign out and log in again with your new email address.');
    } finally { setBusy(false); }
  };
  const field = [styles.field, { backgroundColor: c.soft, color: c.ink, borderColor: c.border }];

  return (
    <Screen edges={['top', 'bottom']} header={<BackHeader title="My profile" onBack={() => router.back()} />}
      contentStyle={styles.root}>
      <Text variant="headline" accessibilityRole="header">Officer profile and account details</Text>
      <Card style={styles.section}>
        <Text variant="caption" color="inkMuted">Registered name</Text>
        <Text variant="bodyStrong">{session.officer.fullName}</Text>
        <Text variant="caption" color="inkMuted">Registered email</Text>
        <Text variant="bodyStrong">{session.officer.email}</Text>
        <Text variant="caption" color="inkMuted">Organization and role</Text>
        <Text variant="bodyStrong">{session.org.name} · {session.officer.role}</Text>
      </Card>
      <Card style={styles.section}><BiometricSettings identity={{ kind: "officer", id: session.officer.id, token: session.token }} /></Card>
      <Banner tone="info" title="Transaction access">
        {effectiveWriteStatus === 'checking' ? 'Checking server-issued transaction permissions…' : effectiveWriteStatus === 'enabled' ? 'Server-issued transaction grants are present. Each operation still requires independent server authorization.' : 'Mobile financial and administrative transaction access is currently unavailable. Your existing read permissions are unaffected.'}
      </Banner>
      <Banner tone="info" title="Verified profile updates">
        Changing your login email requires two verification codes: one sent to the current email, and one to the new email. Your official name, role, and permissions remain managed by your tenant administrator.
      </Banner>

      <Card style={styles.section}>
        <Text variant="bodyStrong">Change my login email</Text>
        {notice ? <Banner tone="success" title="Verification">{notice}</Banner> : null}
        {error ? <Banner tone="danger" title="Could not continue">{error}</Banner> : null}

        {stage === 'start' ? (
          <Button block disabled={busy} onPress={start}>Send code to my current email</Button>
        ) : null}
        {stage === 'current_code' ? (
          <>
            <Text variant="bodySm" color="inkMuted">Code delivered to your current registered email</Text>
            <TextInput accessibilityLabel="Current email verification code" keyboardType="number-pad"
              autoComplete="one-time-code" maxLength={6} style={field} value={currentCode}
              onChangeText={setCurrentCode} placeholder="Six-digit verification code" />
            <Button block disabled={busy} onPress={verifyOld}>Verify current email</Button>
          </>
        ) : null}
        {stage === 'new_address' ? (
          <>
            <Text variant="bodySm" color="inkMuted">New email address</Text>
            <TextInput accessibilityLabel="New email address" keyboardType="email-address" autoCapitalize="none"
              autoCorrect={false} maxLength={254} style={field} value={newEmail}
              onChangeText={setNewEmail} placeholder="new@example.com" />
            <Button block disabled={busy} onPress={requestNew}>Send code to new email</Button>
          </>
        ) : null}
        {stage === 'new_code' ? (
          <>
            <Text variant="bodySm" color="inkMuted">Code delivered to your new email</Text>
            <TextInput accessibilityLabel="New email verification code" keyboardType="number-pad"
              autoComplete="one-time-code" maxLength={6} style={field} value={newCode}
              onChangeText={setNewCode} placeholder="Six-digit verification code" />
            <Button block disabled={busy} onPress={confirm}>Confirm and update email</Button>
          </>
        ) : null}
        {stage === 'complete' ? (
          <Button block disabled={busy} onPress={() => void finish()}>Sign out and sign in again</Button>
        ) : null}
        {busy ? <ActivityIndicator color={c.cobalt} /> : null}
        {stage !== 'start' && stage !== 'complete' ? (
          <Button block variant="ghost" disabled={busy} onPress={() => {
            setCurrentCode(''); setNewCode(''); setNewEmail('');
            setNotice(''); setError(''); setStage('start');
          }}>Restart email verification</Button>
        ) : null}
      </Card>
      <Text variant="caption" color="inkMuted">
        Profile updates do not grant financial posting privileges or change assigned tenant permissions.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3], paddingBottom: spacing[8] },
  section: { gap: spacing[3] },
  field: { minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
});
