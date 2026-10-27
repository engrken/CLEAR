// Authorized, read-only, current-term finance workspace for officers.
// No transaction action is available from this screen. Each API request is
// independently tenant/role-scoped even if a deep link is manually crafted.
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api, type FinanceReviewKind, type FinanceReviewResponse } from '@/api';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { openDepartmentModule } from '@/lib/links';
import { formatPeso, fromCentavos } from '@/lib/money';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

const MODES: ReadonlyArray<{ kind: FinanceReviewKind; tab: string; label: string; web: string }> = [
  { kind: 'penalties', tab: 'tab-penalties', label: 'Penalties', web: '/penalties' },
  { kind: 'advances', tab: 'tab-advances', label: 'Cash advances', web: '/advances' },
  { kind: 'liquidations', tab: 'tab-audit', label: 'Liquidations', web: '/liquidations' },
  { kind: 'collections', tab: 'tab-payment', label: 'Collections', web: '/collections/history' },
];

export default function FinanceReview() {
  const session = useOfficerSession();
  const { can } = useSession();
  const { kind: requestedKind } = useLocalSearchParams<{ kind?: string }>();
  const { c } = useTheme();
  const allowed = MODES.filter(m => can(m.tab));
  // Derive the requested module from the authenticated route rather than
  // synchronously resetting state in an effect. A previous tenant/session's
  // selection and search can never be reused on a new authenticated route.
  const routeKey = JSON.stringify([session.token, session.org.subdomain, requestedKind ?? null]);
  const [selection, setSelection] = useState<{ key: string; kind: FinanceReviewKind } | null>(null);
  const [filter, setFilter] = useState<{ key: string; query: string; limit: number }>({
    key: routeKey, query: '', limit: 20,
  });
  const query = filter.key === routeKey ? filter.query : '';
  const limit = filter.key === routeKey ? filter.limit : 20;
  const preferred = selection?.key === routeKey ? selection.kind : requestedKind;
  const mode = allowed.find(m => m.kind === preferred) ?? allowed[0];
  const authorized = !!mode && can(mode.tab);
  const review = useAsync<FinanceReviewResponse | null>(
    () => authorized && mode ? api.getFinanceReview(session, mode.kind, limit) : Promise.resolve(null),
    `${session.token}:${session.org.subdomain}:${mode?.kind ?? 'none'}:${limit}:${authorized}`
  );
  const { reload } = review;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Never show previous tab's private records while the new mode loads.
  const data = review.loading || dataBelongsElsewhere(review.data, mode?.kind) ? null : review.data;
  const needle = query.trim().toLowerCase();
  const visible = (data?.entries ?? []).filter(row =>
    !needle || [row.reference, row.title, row.subtitle, row.status]
      .some(value => value.toLowerCase().includes(needle))
  );

  return (
    <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
      contentStyle={{ gap: spacing[3], paddingTop: spacing[3] }}>
      <Text variant="title" accessibilityRole="header">Financial records</Text>
      <Banner tone="info" title="Authorized · read only">
        You can review assigned financial records for this department's active academic period.
        Posting, approval, settlement and liquidation changes remain on the audited web system.
      </Banner>
      {allowed.length === 0 ? (
        <Banner tone="warning" title="No financial access">
          Your department has not assigned a financial review module to this account.
        </Banner>
      ) : (
        <>
          <View style={styles.modes}>
            {allowed.map(item => (
              <Pressable key={item.kind} accessibilityRole="tab"
                accessibilityState={{ selected: mode?.kind === item.kind }}
                onPress={() => { setSelection({ key: routeKey, kind: item.kind }); setFilter({ key: routeKey, query: '', limit: 20 }); }}
                style={[styles.tab, { backgroundColor: mode?.kind === item.kind ? c.inkBlock : c.soft }]}>
                <Text variant="bodySm" color={mode?.kind === item.kind ? 'onAccent' : 'ink'}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color="inkMuted">
            {session.org.name} · {data ? `${data.term} · ${data.ay}` : `${session.org.activeTerm} · ${session.org.activeAy}`}
          </Text>
          {mode?.kind === 'collections' ? (
            <Banner tone="warning" title="Receipt allocation lines">
              Multiple rows can belong to one official receipt, including package suffixes.
              These are individual allocation amounts, NOT the total amount of a complete OR.
              Full official receipt groups are available in secure web Receipt History.
            </Banner>
          ) : null}
          {mode?.kind === 'advances' ? (
            <Banner tone="info" title="Approved amounts">
              The amount shown is the original approved cash advance, not its current unliquidated balance.
            </Banner>
          ) : null}
          <TextInput
            value={query} onChangeText={next => setFilter({ key: routeKey, query: next, limit })} maxLength={80}
            accessibilityLabel="Filter loaded financial records"
            placeholder="Filter loaded references, names or status"
            placeholderTextColor={c.inkMuted}
            autoCorrect={false} autoCapitalize="none"
            style={[styles.search, { backgroundColor: c.soft, color: c.ink }]}
          />
          {query ? <Button size="sm" variant="secondary" onPress={() => setFilter({ key: routeKey, query: '', limit })}>
            Clear filter
          </Button> : null}
          {review.loading ? <ActivityIndicator color={c.cobalt}/> : null}
          {review.error ? (
            <Banner tone="danger" title="Unable to load authorized records">
              {review.error.message}
            </Banner>
          ) : null}
          {data ? (
            <>
              <Text variant="caption" color="inkMuted">
                {visible.length} shown from {data.entries.length} most recent returned records · {data.amountMeaning}
              </Text>
              {data.entries.length === 0 ? (
                <Banner tone="info" title="No recent records">
                  There are no matching current-period records in this module.
                </Banner>
              ) : visible.length === 0 ? (
                <Banner tone="info" title="No matches in loaded records">
                  Try another filter or open the complete secure web module.
                </Banner>
              ) : (
                visible.map(row => (
                  <Card key={row.id} style={styles.entry}>
                    <Text variant="bodyStrong" numberOfLines={2}>{row.reference}</Text>
                    <Text variant="bodySm" numberOfLines={2}>{row.title}</Text>
                    <Text variant="caption" color="inkMuted" numberOfLines={3}>{row.subtitle}</Text>
                    <View style={styles.line}>
                      <Text variant="bodySm" color="inkMuted">{row.status}</Text>
                      <Text variant="bodyStrong">{formatPeso(fromCentavos(row.amountCentavos))}</Text>
                    </View>
                    <Text variant="caption" color="inkMuted">{formatDateTime(row.when)}</Text>
                  </Card>
                ))
              )}
              {data.hasMore ? (
                <Banner tone="info" title="More records available">
                  This is a bounded recent list, not complete financial history.
                  Open the secure web module for full records.
                </Banner>
              ) : null}
              {limit === 20 && data.hasMore ? (
                <Button block variant="secondary" onPress={() => setFilter({ key: routeKey, query: '', limit: 40 })}>
                  Show up to 40 recent records
                </Button>
              ) : null}
            </>
          ) : null}
          {mode ? (
            <Button block variant="secondary" onPress={() =>
              void openDepartmentModule(session.org.subdomain, mode.web)
            }>
              Open complete {mode.label} records (secure web)
            </Button>
          ) : null}
          <Text variant="caption" color="inkMuted">
            Web sign-in is separate. Your current role and tenant permissions
            are independently checked there; no mobile token is passed.
          </Text>
        </>
      )}
    </Screen>
  );
}

function dataBelongsElsewhere(data: FinanceReviewResponse | null | undefined, kind?: FinanceReviewKind) {
  return !!data && data.kind !== kind;
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tab: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: radius.pill },
  search: { borderRadius: radius.md, paddingHorizontal: 14, minHeight: 52, fontSize: 16 },
  entry: { gap: spacing[2], padding: 15 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
});
