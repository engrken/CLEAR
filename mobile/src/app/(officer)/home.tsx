import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api, type DashboardSummary, type LedgerEntry } from '@/api';
import { PAYMENT_WRITES_ENABLED } from '@/api/config';
import { Banner, Button, ColorTile, HeroStat, LedgerList, LedgerRow, Screen, SectionHeader, TermChip, Text } from '@/components/ui';
import { FinancialOverview } from '@/components/overview/FinancialOverview';
import { OfficerPresence } from '@/components/collaboration/OfficerPresence';
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
  const canOverview = can('tab-overview');
  const canRemittances = can('tab-remittances');
  const canRoster = can('tab-students') || can('tab-payment');
  const canPayment = can('tab-payment');

  // Do not even request financial data for users without the web tab-overview grant.
  const summary = useAsync<DashboardSummary | null>(
    () => canOverview ? api.getDashboard(session) : Promise.resolve(null),
    `${session.token}:overview:${canOverview}`
  );
  const ledger = useAsync<LedgerEntry[] | null>(
    () => canOverview ? api.listLedger(session) : Promise.resolve(null),
    `${session.token}:ledger:${canOverview}`
  );

  const { reload: reloadSummary } = summary;
  const { reload: reloadLedger } = ledger;
  useFocusEffect(useCallback(() => { reloadSummary(); reloadLedger(); }, [reloadSummary, reloadLedger]));

  const stats = summary.data;

  useEffect(() => {
    if (canOverview && stats?.pendingCount !== undefined) {
      setPendingCount(stats.pendingCount);
    }
  }, [canOverview, stats?.pendingCount]);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1} style={styles.greeting}>
          Hi, {session.officer.fullName} · {session.officer.role}
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
      <OfficerPresence page="overview" session={session} />
      {!canOverview ? (
        <Banner tone="info" title="Your assigned workspace">
          Your role does not include the financial overview. Only the modules authorized for this department are available.
        </Banner>
      ) : null}

      {canOverview && summary.error ? (
        <Banner tone="danger" title="Unable to load overview">{summary.error.message}</Banner>
      ) : null}

      {canOverview && stats && canRemittances && stats.pendingCount > 0 ? (
        <Banner tone="warning" title={plural(stats.pendingCount, 'proof') + ' waiting'}>
          Review submitted payment proofs. Receipt issuance remains paused during financial verification.
        </Banner>
      ) : null}

      {canOverview && summary.loading && !stats ? <ActivityIndicator color={c.cobalt} /> : null}

      {canOverview && stats ? (
        <>
          <HeroStat
            label="Cash on hand"
            value={fromCentavos(stats.cashOnHandCentavos)}
            caption={plural(stats.collectionsToday, 'collection') + ' today'}
          />
          <View style={styles.tiles}>
            <ColorTile label="Safekeeping" value={fromCentavos(stats.safekeepingCentavos)} tone="mint" />
            <ColorTile
              label={`Pending · ${stats.pendingCount}`}
              value={fromCentavos(stats.pendingCentavos)}
              tone="sun"
              onPress={canRemittances ? () => router.push('/verify') : undefined}
            />
            <ColorTile label={`Owed · ${stats.outstandingStudents}`} value={fromCentavos(stats.outstandingCentavos)} tone="coral" />
          </View>
        </>
      ) : null}

      {canOverview && stats ? <FinancialOverview stats={stats} /> : null}

      {canRemittances ? (
        <Button block variant="secondary" icon="shield" onPress={() => router.push('/verify')}>
          Review pending payment proofs
        </Button>
      ) : null}
      {canRoster ? (
        <Button block variant="secondary" icon="people" onPress={() => router.push('/students')}>
          View students
        </Button>
      ) : null}
      {canPayment && PAYMENT_WRITES_ENABLED ? (
        <Button block variant="ink" icon="plus" onPress={() => router.push('/collect')}>Record a payment</Button>
      ) : null}
      {canPayment && !PAYMENT_WRITES_ENABLED ? (
        <Banner tone="info" title="Financial posting paused">
          Your role has payment permission, but Android posting is disabled until receipt sequencing and accounting parity are verified.
        </Banner>
      ) : null}

      {canOverview ? (
        <View style={{ gap: spacing[2], marginTop: 6 }}>
          <SectionHeader title="Recent activity" />
          {ledger.error ? <Banner tone="danger" title="Couldn't load activity">{ledger.error.message}</Banner> : null}
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
                    l.kind === 'online-remittance' && l.status === 'Pending Verification' && canRemittances
                      ? () => router.push({ pathname: '/officer/verify/[id]', params: { id: l.id } })
                      : undefined
                  }
                />
              ))}
            </LedgerList>
          ) : ledger.loading ? (
            <ActivityIndicator color={c.cobalt} />
          ) : null}
        </View>
      ) : null}
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
