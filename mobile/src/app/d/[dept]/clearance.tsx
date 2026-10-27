import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api, type ClearanceResult, type Organization, type UnpaidItem } from '@/api';
import { MOBILE_BUSINESS_WRITES_ENABLED } from '@/api/config';
import { BackHeader, Banner, Button, ClearanceCard, Icon, OrgChip, Screen, Text, type UnpaidLine } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useSession } from '@/lib/session';
import { StudentClearanceGuide } from '@/components/student/StudentClearanceGuide';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

function unpaidLines(items: UnpaidItem[] | null | undefined, ay: string, term: string): UnpaidLine[] | undefined {
  if (!items?.length) return undefined;
  return items.map((it) => {
    const earlier = (it.academicYear && it.academicYear !== ay) || (it.term && it.term !== term);
    const period = earlier ? [it.academicYear, it.term].filter(Boolean).join(' · ') : undefined;
    return { label: it.label, amount: fromCentavos(it.amount), period: period || undefined };
  });
}

/**
 * Students need BOTH an exact school ID and an OTP delivered to the address
 * registered in the selected tenant. Merely knowing somebody's ID is never
 * enough to query the private mobile API.
 *
 * An authorized officer continues to use a separately guarded tenant lookup.
 */
export default function Clearance() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { session, can } = useSession();
  const officerMode = session?.org.subdomain === dept && can('tab-clearance');
  const org = useAsync<Organization>(() => api.getOrganization(dept), dept);

  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [officerQuery, setOfficerQuery] = useState('');
  const [result, setResult] = useState<ClearanceResult | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  async function requestCode() {
    if (!studentId.trim() || !email.trim().includes('@')) {
      setError('Enter your exact school ID and the email registered with your department.');
      return;
    }
    setBusy(true); setError(undefined); setResult(null);
    try {
      await api.requestStudentClearanceCode(dept, studentId, email);
      setCodeRequested(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndCheck() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the six-digit code from your registered email.');
      return;
    }
    setBusy(true); setError(undefined); setResult(null);
    try {
      const verified = await api.verifyStudentClearanceCode(dept, studentId, email, code);
      // This token is held only in React memory, never persisted in storage.
      setStudentToken(verified.token);
      setResult(await api.getOwnClearance(dept, verified.token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkOfficer() {
    if (!officerQuery.trim() || !session) {
      setError('Enter a school ID or registered email.');
      return;
    }
    setBusy(true); setError(undefined); setResult(null);
    try {
      // The server revalidates the officer's role and tab-clearance every time.
      setResult(await api.lookupClearance(dept, officerQuery, session));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    if (studentToken) void api.revokeStudentClearance(dept, studentToken);
    setStudentToken(null); setStudentId(''); setEmail(''); setCode('');
    setCodeRequested(false); setOfficerQuery(''); setResult(null); setError(undefined);
  }

  const fieldStyle = [styles.field, { backgroundColor: c.soft, color: c.ink }];

  return (
    <Screen
      header={<BackHeader right={org.data ? <OrgChip name={org.data.name} /> : null} />}
      contentStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">
        {officerMode ? 'Officer clearance lookup' : 'Check your clearance'}
      </Text>
      <Banner tone="info" title="Secure live clearance · Read-only">
        {officerMode
          ? 'Only your assigned department records are accessible. All actions are read-only.'
          : 'Verify using the email on your own student record. Your status is read live from CLEAR; payment details are not shown.'}
      </Banner>
      {!officerMode ? <StudentClearanceGuide department={dept} /> : null}

      {officerMode ? (
        <View style={{ gap: spacing[2] }}>
          <View style={[styles.search, { backgroundColor: c.soft, borderColor: focused ? c.cobalt : 'transparent' }]}>
            <TextInput
              value={officerQuery}
              onChangeText={(value) => { setOfficerQuery(value); setResult(null); setError(undefined); }}
              accessibilityLabel="School ID or email for officer lookup"
              placeholder="School ID or registered email"
              placeholderTextColor={c.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => void checkOfficer()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.input, { color: c.ink }]}
            />
            <Pressable disabled={busy} onPress={() => void checkOfficer()} accessibilityRole="button"
              accessibilityLabel="Check clearance" style={[styles.check, { backgroundColor: c.cobalt }]}>
              {busy ? <ActivityIndicator color={c.onAccent} /> : <Text variant="button" color="onAccent">Check</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing[2] }}>
          {!codeRequested ? (
            <>
              <Text variant="bodySm" color="inkMuted">
                Your Student ID and registered email must match the same tenant roster.
              </Text>
              <TextInput
                value={studentId}
                onChangeText={(v) => { setStudentId(v); setResult(null); }}
                placeholder="Your school / student ID"
                placeholderTextColor={c.inkMuted}
                accessibilityLabel="Your school ID"
                autoCapitalize="characters"
                autoCorrect={false}
                style={fieldStyle}
              />
              <TextInput
                value={email}
                onChangeText={(v) => { setEmail(v); setResult(null); }}
                placeholder="Your registered email"
                placeholderTextColor={c.inkMuted}
                accessibilityLabel="Your registered email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={fieldStyle}
              />
              <Button block disabled={busy} loading={busy} onPress={() => void requestCode()}>
                Email verification code
              </Button>
            </>
          ) : !result ? (
            <>
              <Text variant="bodySm" color="inkMuted">
                If the ID and email match, a six-digit code has been sent. Check your inbox.
                The code expires in five minutes. For unregistered email addresses, contact your tenant administrator.
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => { setCode(v); setError(undefined); }}
                placeholder="Six-digit verification code"
                placeholderTextColor={c.inkMuted}
                accessibilityLabel="Six-digit verification code"
                keyboardType="number-pad"
                maxLength={6}
                style={fieldStyle}
              />
              <Button block disabled={busy} loading={busy} onPress={() => void verifyAndCheck()}>
                Verify and view my clearance
              </Button>
              <Button block variant="secondary" disabled={busy} onPress={restart}>
                Use another registered email
              </Button>
            </>
          ) : null}
        </View>
      )}

      {error ? (
        <View style={styles.help} accessibilityLiveRegion="polite">
          <Icon name="alert" size={14} color="dangerInk" />
          <Text variant="bodySm" color="dangerInk" style={{ flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      {result && org.data ? (
        <>
          <ClearanceCard
            orgName={org.data.name}
            studentName={result.studentName || ''}
            studentId={result.studentId || ''}
            status={result.status}
            outstanding={result.outstandingCentavos === null ? null : fromCentavos(result.outstandingCentavos)}
            qrToken={result.qrToken ?? undefined}
            ay={result.ay}
            term={result.term}
            unpaidItems={unpaidLines(result.unpaidItems, result.ay, result.term)}
          />
          {!officerMode ? (
            <Button block variant="secondary" onPress={restart}>Finish secure inquiry</Button>
          ) : null}
        </>
      ) : null}

      <View style={styles.spacer} />

      {officerMode && result && org.data && result.status === 'hold' && MOBILE_BUSINESS_WRITES_ENABLED ? (
        <Button block icon="upload" onPress={() => router.push({
          pathname: '/d/[dept]/submit-proof', params: { dept, studentId: result.studentId || '' },
        })}>Submit payment proof</Button>
      ) : null}

      <Text variant="caption" color="inkMuted" style={styles.note}>
        Students see only their clearance status, not roster identities or payment amounts.
        Ask your department treasury office if a result looks incorrect. All transactions remain on the CLEAR web application.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: spacing[1], gap: spacing[2] },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 3, paddingRight: 3, paddingLeft: 15,
    borderWidth: 3, borderRadius: radius.pill,
  },
  field: {
    borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16,
    minHeight: 52, fontSize: 16, fontFamily: 'Figtree_600SemiBold',
  },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: 'Figtree_600SemiBold', fontSize: 16 },
  check: {
    minHeight: 48, minWidth: 88, paddingHorizontal: 20, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  help: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  spacer: { flex: 1, minHeight: 0 },
  note: { paddingHorizontal: 6 },
});
