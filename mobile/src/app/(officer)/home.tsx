import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Button, ColorTile, HeroStat, LedgerList, LedgerRow, Screen, SectionHeader, TermChip, Text } from '@/components/ui';
import { formatWhen } from '@/lib/dates';
import { fromCentavos } from '@/lib/money';
import { setPendingCount } from '@/lib/pending-count';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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

  // Feed the Verify tab badge from the dashboard already loaded here.
  const pendingCount = s?.pendingCount;
  useEffect(() => {
    if (pendingCount !== undefined) setPendingCount(pendingCount);
  }, [pendingCount]);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1} style={styles.greeting}>
          Hi, {session.officer.fullName}
        </Text>
        <TermChip ay={session.org.activeAy} term={session.org.activeTerm} />
      </View>
      <Text variant="headline" accessibilityRole="header" style={styles.orgName}>
        {session.org.name}
      </Text>
    </View>
  );

  return (
    <Screen edges={['top']} header={header} bottomInset={TAB_BAR_SPACE} contentStyle={{ gap: 12 }}>
      {s && s.pendingCount > 0 && can('tab-remittances') ? (
        <Banner tone="warning" title={plural(s.pendingCount, 'proof') + ' waiting'}>
          Verify online remittances so students get their official receipts.
        </Banner>
      ) : null}

      {!s ? (
        <ActivityIndicator color={c.cobalt} />
      ) : (
        <>
          <HeroStat
            label="Cash on hand"
            value={fromCentavos(s.cashOnHandCentavos)}
            caption={plural(s.collectionsToday, 'collection') + ' today'}
          />
          <View style={styles.tiles}>
            <ColorTile label="Safekeeping" value={fromCentavos(s.safekeepingCentavos)} tone="mint" />
            <ColorTile
              label={`Pending · ${s.pendingCount}`}
              value={fromCentavos(s.pendingCentavos)}
              tone="sun"
              onPress={can('tab-remittances') ? () => router.push('/verify') : undefined}
            />
            <ColorTile label={`Owed · ${s.outstandingStudents}`} value={fromCentavos(s.outstandingCentavos)} tone="coral" />
          </View>
        </>
      )}

      {can('tab-payment') ? (
        <Button block variant="ink" icon="plus" onPress={() => router.push('/collect')}>Record a payment</Button>
      ) : null}

      <View style={{ gap: spacing[2], marginTop: 6 }}>
        <SectionHeader title="Today" />
        {ledger.data ? (
          <LedgerList>
            {ledger.data.map((l, i) => (
              <LedgerRow
                key={l.id}
                first={i === 0}
                title={l.title}
                reference={l.reference}
                subtitle={`${l.subtitle} · ${formatWhen(l.at)}`}
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
          <ActivityIndicator color={c.cobalt} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 8, gap: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  greeting: { flex: 1, fontFamily: 'Figtree_600SemiBold' },
  orgName: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
  tiles: { flexDirection: 'row', gap: spacing[2] },
});
