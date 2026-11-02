// A compact authorized view of current-period collectible assessments.
// Financial changes, assessment edits and receipt linking remain web-only.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { api, type CollectiblePage, type CollectibleRecord } from '@/api';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { openDepartmentModule } from '@/lib/links';
import { formatPeso, fromCentavos } from '@/lib/money';
import { useOfficerSession, useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { spacing, useTheme } from '@/theme';

type Extra = { key: string; records: CollectibleRecord[]; cursor: string | null; more: boolean };
export default function Collectibles() {
  const session = useOfficerSession();
  const { can } = useSession();
  const { c } = useTheme();
  const authorized = can('tab-collectibles');
  const [version, setVersion] = useState(0);
  const key = session.org.subdomain + ':' + session.token + ':' + String(authorized) + ':' + version;
  const response = useAsync(
    () => authorized ? api.listCollectibles(session) : Promise.resolve(null),
    key,
  );
  const [extra, setExtra] = useState<Extra | null>(null);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState('');
  const busy = useRef(false);
  useFocusEffect(useCallback(() => setVersion(v => v + 1), []));
  const page: CollectiblePage | null = !response.loading ? response.data : null;
  const more = extra?.key === key ? extra : null;
  const records = page ? [...page.records, ...(more?.records || [])] : [];
  const cursor = more ? more.cursor : page?.nextCursor;
  const hasMore = more ? more.more : page?.hasMore;
  async function loadMore() {
    if (!authorized || !page || !hasMore || !cursor || busy.current) return;
    busy.current = true; setPaging(true); setPageError('');
    try {
      const next = await api.listCollectibles(session, cursor);
      if (next.scope !== page.scope || next.ay !== page.ay || next.term !== page.term) {
        throw new Error('The academic period changed. Refresh to review current records.');
      }
      setExtra(previous => {
        const earlier = previous?.key === key ? previous.records : [];
        const known = new Set([...page.records, ...earlier].map(x => x.id));
        return { key, records: [...earlier, ...next.records.filter(x => !known.has(x.id))],
          cursor: next.nextCursor, more: next.hasMore };
      });
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Could not load older records.');
    } finally {
      busy.current = false; setPaging(false);
    }
  }
  return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
    contentStyle={{ gap: spacing[3], paddingTop: spacing[3] }}>
    <Text variant="title" accessibilityRole="header">Collectibles</Text>
    <Banner tone="info" title="Current-term review only">
      Authorized tenant assessment summaries are available here. Changes to collectible
      amounts, student assessments, receipt matching and settlements require secure web access.
    </Banner>
    {!authorized ? <Banner tone="warning" title="Access not granted">
      This account does not have the Collectibles permission.
    </Banner> : <>
      {response.loading ? <ActivityIndicator color={c.cobalt} /> : null}
      {response.error ? <Banner tone="danger" title="Unable to load collectibles">
        {response.error.message}
      </Banner> : null}
      {page ? <>
        <Text variant="bodySm" color="inkMuted">
          {page.term} · {page.ay} · {records.length} loaded{hasMore ? ' · Older assessments available' : ''}
        </Text>
        {records.length === 0 ? <Banner tone="info" title="No assessments">
          No collectible assessments were recorded for the active academic period.
        </Banner> : records.map(item => <Card key={item.id} style={styles.card}>
          <Text variant="bodyStrong">{item.category}</Text>
          <View style={styles.row}>
            <Text variant="bodySm" color="inkMuted">{item.headcount} assessed</Text>
            <Text variant="bodyStrong">{formatPeso(fromCentavos(item.balanceCentavos))}</Text>
          </View>
          <Text variant="caption" color="inkMuted">{item.status}</Text>
        </Card>)}
        {pageError ? <Banner tone="danger" title="Could not load more">{pageError}</Banner> : null}
        {hasMore ? <Button block variant="secondary" disabled={paging} onPress={() => void loadMore()}>
          {paging ? 'Loading…' : 'Load more assessments'}
        </Button> : null}
        <Button block variant="secondary" onPress={() => { setVersion(v => v + 1); setExtra(null); }}>
          Refresh
        </Button>
      </> : null}
      <Button block variant="secondary"
        onPress={() => void openDepartmentModule(session.org.subdomain, '/collectibles')}>
        Open complete Collectibles ledger on secure web
      </Button>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  card: { padding: 14, gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
