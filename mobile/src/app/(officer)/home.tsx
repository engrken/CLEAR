import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Button, LedgerList, LedgerRow, Screen, SectionHeader, StatTile, TermChip, Text } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useOfficerSession, useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

export default function Home() {
  const session = useOfficerSession();
  const { can } = useSession();
  const router = useRouter();
  const { c } = useTheme();
  const summary = useAsync(() => api.getDashboard(session), session.token);
  const ledger = useAsync(() => api.listLedger(session), session.token);

  // Refresh when returning from Collect or a review.
  const { reload: reloadSummary } = summary;
  const { reload: reloadLedger } = ledger;
  useFocusEffect(useCallback(() => { reloadSummary(); reloadLedger(); }, [reloadSummary, reloadLedger]));

  const s = summary.data;
  return (
    <Screen edges={[]}>
      <View style={{ gap: spacing[2] }}>
        <Text variant="caption" color="inkMuted">{session.officer.fullName} · {session.officer.role}</Text>
        <Text variant="display">{session.org.name}</Text>
        <TermChip ay={session.org.activeAy} term={session.org.activeTerm} />
      </View>

      {s && s.pendingCount > 0 && can('tab-remittances') ? (
        <Banner tone="warning" title={plural(s.pendingCount, 'proof') + ' waiting'}>
          Verify online remittances so students get their official receipts.
        </Banner>
      ) : null}

      {!s ? (
        <ActivityIndicator color={c.accent} />
      ) : (
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatTile label="Cash on hand" value={fromCentavos(s.cashOnHandCentavos)} caption={plural(s.collectionsToday, 'collection') + ' today'} icon="wallet" />
            <StatTile label="Safekeeping" value={fromCentavos(s.safekeepingCentavos)} caption="With the university cashier" icon="safe" tone="success" />
          </View>
          <View style={styles.gridRow}>
            <StatTile
              label="Pending"
              value={fromCentavos(s.pendingCentavos)}
              caption={plural(s.pendingCount, 'proof') + ' to verify'}
              icon="clock"
              tone="warning"
              onPress={can('tab-remittances') ? () => router.push('/verify') : undefined}
            />
            <StatTile label="Outstanding" value={fromCentavos(s.outstandingCentavos)} caption={`${s.outstandingStudents} students`} icon="alert" tone="danger" />
          </View>
        </View>
      )}

      {can('tab-payment') ? (
        <Button block icon="receipt" onPress={() => router.push('/collect')}>Record payment</Button>
      ) : null}

      <View style={{ gap: spacing[3] }}>
        <SectionHeader title="Today’s activity" />
        {ledger.data ? (
          <LedgerList>
            {ledger.data.map((l, i) => (
              <LedgerRow
                key={l.id}
                first={i === 0}
                title={l.title}
                reference={l.reference}
                subtitle={`${l.subtitle} · ${time(l.at)}`}
                amount={fromCentavos(l.amountCentavos)}
                status={l.status}
                onPress={
                  l.kind === 'online-remittance' && l.status === 'Pending Verification' && can('tab-remittances')
                    ? () => router.push({ pathname: '/officer/verify/[id]', params: { id: l.id } })
                    : undefined
                }
              />
            ))}
          </LedgerList>
        ) : (
          <ActivityIndicator color={c.accent} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing[3] },
  gridRow: { flexDirection: 'row', gap: spacing[3] },
});
