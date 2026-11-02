import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api, type DashboardSummary } from '@/api';
import { PAYMENT_WRITES_ENABLED } from '@/api/config';
import { openDepartmentModule } from '@/lib/links';
import { Banner, Button, ColorTile, HeroStat, LedgerList, LedgerRow, Screen, SectionHeader, TermChip, Text } from '@/components/ui';
import { FinancialOverview } from '@/components/overview/FinancialOverview';
import { OfficerPresence } from '@/components/collaboration/OfficerPresence';
import { OfficerWalkthrough } from '@/components/collaboration/OfficerWalkthrough';
import { formatWhen } from '@/lib/dates';
import { fromCentavos } from '@/lib/money';
import { filterRecentActivity, type RecentActivityFilter } from '@/lib/recent-activity-search';
import { setPendingCount } from '@/lib/pending-count';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { useLedgerPages } from '@/lib/use-ledger-pages';
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
  const canVoid = can('tab-void');
  const canReports = can('tab-reports');
  const [selectedLedgerScope, setSelectedLedgerScope] = useState<'active' | 'all'>('active');
  const ledgerScope = canReports && selectedLedgerScope === 'all' ? 'all' : 'active';
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<RecentActivityFilter>('all');

  // Do not even request financial data for users without the web tab-overview grant.
  const summary = useAsync<DashboardSummary | null>(
    () => canOverview ? api.getDashboard(session) : Promise.resolve(null),
    `${session.token}:overview:${canOverview}`
  );
  const ledger = useLedgerPages(
    (cursor) => api.listLedgerPage(session, cursor, ledgerScope),
    `${session.org.subdomain}:${session.token}:ledger:${ledgerScope}`, canOverview,
  );

  const { reload: reloadSummary } = summary;
  const { reload: reloadLedger } = ledger;
  useFocusEffect(useCallback(() => { reloadSummary(); reloadLedger(); }, [reloadSummary, reloadLedger]));

  const stats = summary.data;
  const visibleActivity = filterRecentActivity(ledger.data ?? [], ledgerQuery, activityFilter);

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
      <OfficerWalkthrough auto />
      <OfficerPresence page="overview" session={session} />
      <Button block variant="secondary" icon="more" onPress={() => router.push('/more')}>
        Browse my assigned modules
      </Button>
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
      {canPayment ? (
        <>
          <Banner tone="info" title="Financial actions stay on web">
            Android v1.5.0 is read-only for collections and all other financial modules.
            Official payment posting and receipt issuance take place only in the role-protected web app.
          </Banner>
          <Button block variant="secondary" icon="receipt"
            onPress={() => void openDepartmentModule(session.org.subdomain, '/collections')}>
            Record payment on secure web
          </Button>
        </>
      ) : null}

      {canOverview ? (
        <View style={{ gap: spacing[2], marginTop: 6 }}>
          <SectionHeader title={ledgerScope === 'all' ? 'Activity · all academic periods' : 'Activity · current academic period'} />
          {canReports ? (
            <View style={styles.activityFilters}>
              {(['active', 'all'] as const).map(scope => (
                <Pressable key={scope} accessibilityRole="button"
                  accessibilityLabel={scope === 'all' ? 'All academic periods' : 'Current academic period'}
                  accessibilityState={{ selected: ledgerScope === scope }}
                  onPress={() => { setSelectedLedgerScope(scope); setLedgerQuery(''); setActivityFilter('all'); }}
                  style={[styles.activityChip, { backgroundColor: ledgerScope === scope ? c.inkBlock : c.soft }]}>
                  <Text variant="caption" style={{ color: ledgerScope === scope ? c.onAccent : c.ink }}>
                    {scope === 'all' ? 'All periods' : 'Current period'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput value={ledgerQuery} onChangeText={setLedgerQuery} autoCorrect={false}
            accessibilityLabel="Search recent authorized activity by student, OR or reference"
            placeholder="Search loaded names, ORs or references" placeholderTextColor={c.inkMuted}
            style={[styles.activitySearch, { color: c.ink, backgroundColor: c.soft }]} />
          <View style={styles.activityFilters}>
            {(['all', 'receipts', 'voided'] as const).map(mode => (
              <Pressable key={mode} accessibilityRole="button"
                accessibilityState={{ selected: activityFilter === mode }}
                onPress={() => setActivityFilter(mode)}
                style={[styles.activityChip, { backgroundColor: activityFilter === mode ? c.inkBlock : c.soft }]}>
                <Text variant="caption" style={{ color: activityFilter === mode ? c.onAccent : c.ink }}>
                  {mode === 'all' ? 'All' : mode === 'receipts' ? 'Receipts' : 'Voided receipts'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color="inkMuted">
            {visibleActivity.length} of {ledger.data?.length ?? 0} loaded Activity records{ledger.hasMore ? ' · Older records available' : ' · All available Activity pages loaded'}. Search covers loaded pages only; Void Center maintains a separate audit.
          </Text>
          {canPayment ? (
            <Button block variant="secondary" onPress={() => router.push({ pathname: '/reference-search', params: { kind: 'receipts' } })}>
              Search receipts (read-only)
            </Button>
          ) : null}
          {canVoid ? (
            <Button block variant="secondary" onPress={() => router.push({ pathname: '/reference-search', params: { kind: 'void' } })}>
              Search Void references (read-only)
            </Button>
          ) : null}
          {canVoid ? (
            <Button block variant="secondary" onPress={() => router.push('/void-audit')}>
              Browse Void audit history (read-only)
            </Button>
          ) : null}
          {ledger.error ? <Banner tone="danger" title="Couldn't load activity">{ledger.error.message}</Banner> : null}
          {ledger.data ? (
            <>
              <LedgerList>
              {visibleActivity.map((l, i) => (
                <LedgerRow
                  key={l.id}
                  first={i === 0}
                  title={l.title}
                  reference={l.reference}
                  subtitle={`${l.subtitle}${ledgerScope === 'all' && l.academicYear ? ` · ${l.academicYear} ${l.term ?? ''}` : ''} · ${formatWhen(l.at)}`}
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
              {ledger.pageError ? <Banner tone="danger" title="Could not load older Activity">{ledger.pageError.message}</Banner> : null}
              {ledger.hasMore ? <Button block variant="secondary" onPress={() => void ledger.loadMore()}>
                {ledger.loadingMore ? 'Loading older Activity…' : 'Load older Activity'}
              </Button> : null}
              {visibleActivity.length === 0 ? (
                <Text variant="bodySm" color="inkMuted">{activityFilter === 'voided' ? ledger.hasMore ? 'No voided receipts in the loaded pages. Load older Activity to search further.' : 'No voided receipts found in the complete loaded Activity history for this tenant.' : 'No matching records in loaded Activity.'}</Text>
              ) : null}
            </>
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
  activitySearch: { minHeight: 48, paddingHorizontal: 16, borderRadius: 16 },
  activityFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  activityChip: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
});
