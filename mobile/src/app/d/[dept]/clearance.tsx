import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api, type ClearanceResult, type Organization, type UnpaidItem } from '@/api';
import { MOBILE_BUSINESS_WRITES_ENABLED } from '@/api/config';
import { BackHeader, Button, ClearanceCard, Icon, OrgChip, Screen, Text, type UnpaidLine } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** Items from the API in pesos; arrears from another A.Y. or term are labelled with their period. */
function unpaidLines(items: UnpaidItem[] | null | undefined, ay: string, term: string): UnpaidLine[] | undefined {
  if (!items?.length) return undefined;
  return items.map((it) => {
    const earlier = (it.academicYear && it.academicYear !== ay) || (it.term && it.term !== term);
    const period = earlier ? [it.academicYear, it.term].filter(Boolean).join(' · ') : undefined;
    return { label: it.label, amount: fromCentavos(it.amount), period: period || undefined };
  });
}

/** Student clearance lookup by exact student ID or registered email. */
export default function Clearance() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { session } = useSession();
  const org = useAsync<Organization>(() => api.getOrganization(dept), dept);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ClearanceResult | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const check = async () => {
    if (!query.trim()) return setError('Enter your student ID or the email registered with your department.');
    setBusy(true);
    setError(undefined);
    try {
      // An officer signed in to this department sees the amount due too.
      setResult(await api.lookupClearance(dept, query, session));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<BackHeader right={org.data ? <OrgChip name={org.data.name} /> : null} />}
      contentStyle={styles.content}>
      {!result ? (
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">Check your clearance</Text>
          <Text color="inkMuted">Enter your exact student ID or the email registered with your department.</Text>
        </View>
      ) : null}

      {/* The search pill: the field and an inline Check button. */}
      <View style={{ gap: 6 }}>
        <View
          style={[
            styles.search,
            {
              backgroundColor: error ? c.coral : focused ? c.ground : c.soft,
              borderColor: error ? c.coralInk : focused ? c.cobalt : 'transparent',
            },
          ]}>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); setError(undefined); }}
            accessibilityLabel="Student ID or email"
            accessibilityHint={error}
            placeholder="Student ID or email"
            placeholderTextColor={c.inkMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={check}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, { color: c.ink }]}
          />
          <Pressable
            onPress={check}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Checking…' : 'Check clearance'}
            accessibilityState={{ disabled: busy, busy }}
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            style={[styles.check, { backgroundColor: c.cobalt }]}>
            {busy ? (
              <ActivityIndicator color={c.onAccent} size="small" />
            ) : (
              <Text variant="button" color="onAccent" style={{ fontSize: 15 }}>Check</Text>
            )}
          </Pressable>
        </View>
        {error ? (
          <View style={styles.help} accessibilityLiveRegion="polite">
            <Icon name="alert" size={14} color="dangerInk" />
            <Text variant="bodySm" color="dangerInk" style={{ flex: 1 }}>{error}</Text>
          </View>
        ) : null}
      </View>

      {result && org.data ? (
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
      ) : null}

      <View style={styles.spacer} />

      {result && org.data && result.status === 'hold' && MOBILE_BUSINESS_WRITES_ENABLED ? (
        <Button
          block
          icon="upload"
          onPress={() => router.push({ pathname: '/d/[dept]/submit-proof', params: { dept, studentId: result.studentId || (query.includes('@') ? '' : query.trim()) } })}>
          I paid — send my receipt
        </Button>
      ) : null}

      <Text variant="caption" color="inkMuted" style={styles.note}>
        {result?.unpaidItems?.length
          ? 'Payment records and receipts stay with your officers. Ask your treasurer if an item looks wrong.'
          : (result?.outstandingCentavos ?? null) === null
            ? 'Only your clearance status is shown here. Your balance and records stay with your officers.'
            : 'Only your clearance status and total balance are shown here. Itemised records stay with your officers.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: spacing[1] },
  intro: { gap: spacing[2], paddingHorizontal: 6, paddingBottom: spacing[1] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 3,
    paddingRight: 3,
    paddingLeft: 15,
    borderWidth: 3,
    borderRadius: radius.pill,
  },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: 'Figtree_600SemiBold', fontSize: 17 },
  check: {
    minHeight: 48,
    minWidth: 88,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  help: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  spacer: { flex: 1, minHeight: 0 },
  note: { paddingHorizontal: 6 },
});
