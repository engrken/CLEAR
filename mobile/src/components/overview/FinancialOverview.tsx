import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DashboardSummary } from '@/api';
import { Banner, Card, Text } from '@/components/ui';
import { formatPeso, fromCentavos } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

const peso = (centavos: number | undefined): string =>
  typeof centavos === 'number' && Number.isFinite(centavos)
    ? formatPeso(fromCentavos(centavos))
    : 'Not available';

function Metric({ label, amount, accent }: {
  label: string;
  amount: number | undefined;
  accent?: 'positive' | 'warning';
}) {
  const { c } = useTheme();
  return (
    <Card style={styles.metric}>
      <Text variant="caption" color="inkMuted">{label}</Text>
      <Text
        variant="figure"
        numberOfLines={2}
        adjustsFontSizeToFit
        style={accent === 'positive' ? { color: c.mintInk } : accent === 'warning' ? { color: c.sunInk } : undefined}>
        {peso(amount)}
      </Text>
    </Card>
  );
}

function Detail({ label, amount }: { label: string; amount: number | undefined }) {
  return (
    <View style={styles.line}>
      <Text variant="bodySm" color="inkMuted" style={styles.lineLabel}>{label}</Text>
      <Text variant="bodyStrong" style={styles.lineValue}>{peso(amount)}</Text>
    </View>
  );
}

/** Web Overview amounts: the server supplies figures from the same financial engine. */
export function FinancialOverview({ stats }: { stats: DashboardSummary }) {
  const { c } = useTheme();
  const [tab, setTab] = useState<'funds' | 'advances'>('funds');
  const hasBreakdown = typeof stats.remainingBalanceCentavos === 'number' &&
    typeof stats.totalCollectedCentavos === 'number' &&
    typeof stats.totalExpensesCentavos === 'number' &&
    typeof stats.unliquidatedCentavos === 'number';
  const funds = stats.funds || [];
  const advances = stats.pendingAdvances || [];
  const flows = [
    { label: 'Total collections', amount: stats.totalCollectedCentavos, color: c.mintInk },
    { label: 'Audited expenses', amount: stats.totalExpensesCentavos, color: c.coralDeep },
    { label: 'Active unliquidated', amount: stats.unliquidatedCentavos, color: c.sunInk },
  ];
  const largestFlow = Math.max(1, ...flows.map((flow) => Math.abs(flow.amount ?? 0)));

  if (!hasBreakdown) {
    return (
      <Banner tone="info" title="Web Overview details unavailable">
        The current server has not supplied the expanded financial figures. Update the web backend before relying on the Android overview.
      </Banner>
    );
  }

  return (
    <View style={styles.root}>
      <Text variant="headline" accessibilityRole="header">Financial overview</Text>
      <Text variant="caption" color="inkMuted">
        {stats.term} · {stats.ay} · Live, read-only financial records
      </Text>
      {stats.periodClosed ? (
        <Banner tone="info" title="Period closed">This accounting period is closed. Figures are read-only.</Banner>
      ) : null}

      <View style={styles.grid}>
        <Metric label="Total collections" amount={stats.totalCollectedCentavos} />
        <Metric label="Active unliquidated" amount={stats.unliquidatedCentavos} accent="warning" />
        <Metric label="Audited expenses" amount={stats.totalExpensesCentavos} />
        <Metric label="Net treasury balance" amount={stats.remainingBalanceCentavos}
          accent={(stats.remainingBalanceCentavos ?? 0) >= 0 ? 'positive' : 'warning'} />
      </View>

      <Card>
        <Text variant="bodyStrong">University Cashier · Safekeeping</Text>
        <Text variant="figure">{peso(stats.safekeepingCentavos)}</Text>
        <Detail label="Deposited (in)" amount={stats.depositedCentavos} />
        <Detail label="Withdrawn (out)" amount={stats.withdrawnCentavos} />
      </Card>

      <Card>
        <Text variant="bodyStrong">Physical cash on hand</Text>
        <Text variant="figure">{peso(stats.cashOnHandCentavos)}</Text>
        <Text variant="bodySm" color="inkMuted">
          Net treasury balance minus University Cashier safekeeping
        </Text>
      </Card>

      {(stats.carriedInCentavos !== 0 || stats.carriedOutCentavos !== 0) ? (
        <Card>
          <Text variant="bodyStrong">Period carry-over (not new collections)</Text>
          <Detail label="Received from previous period" amount={stats.carriedInCentavos} />
          <Detail label="Forwarded to next period" amount={stats.carriedOutCentavos} />
        </Card>
      ) : null}

      <Card>
        <Text variant="bodyStrong">Cash flow velocity</Text>
        {flows.map((flow) => (
          <View key={flow.label} style={styles.flow}>
            <View style={styles.line}>
              <Text variant="bodySm" style={styles.lineLabel}>{flow.label}</Text>
              <Text variant="bodyStrong">{peso(flow.amount)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: c.border }]}>
              <View
                style={{
                  width: `${Math.max(0, Math.min(100, Math.abs(flow.amount ?? 0) / largestFlow * 100))}%` as `${number}%`,
                  height: '100%',
                  backgroundColor: flow.color,
                  borderRadius: radius.pill,
                }}
              />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="bodyStrong">Outstanding collectibles</Text>
        <Text variant="figure">{peso(stats.outstandingCentavos)}</Text>
        <Text variant="bodySm" color="inkMuted">
          {stats.outstandingStudents} students with outstanding mandatory package balances;
          other assessed collectibles may also contribute to the total
        </Text>
      </Card>

      <Card>
        <Text variant="bodyStrong">Available target funds</Text>
        {stats.funds === undefined ? (
          <Text variant="bodySm" color="inkMuted">Fund details unavailable from this server.</Text>
        ) : funds.length === 0 ? (
          <Text variant="bodySm" color="inkMuted">No fund activity recorded for this term.</Text>
        ) : funds.some((f) => f.balanceCentavos > 0) ? (
          funds.filter((f) => f.balanceCentavos > 0).map((f) => (
            <Detail key={f.name} label={f.name} amount={f.balanceCentavos} />
          ))
        ) : (
          <Text variant="bodySm" color="inkMuted">No positive fund balances to display.</Text>
        )}
      </Card>

      <View style={styles.toggle}>
        {(['funds', 'advances'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: item === tab }}
            onPress={() => setTab(item)}
            style={[styles.switch, { backgroundColor: item === tab ? c.inkBlock : c.soft }]}>
            <Text variant="bodyStrong" style={{ color: item === tab ? c.onAccent : c.ink }}>
              {item === 'funds' ? 'Fund balances' : 'Pending advances'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'funds' ? (
        <View style={styles.root}>
          <Text variant="bodyStrong">Detailed fund ledger</Text>
          {stats.funds === undefined ? (
            <Text color="inkMuted">Fund details unavailable.</Text>
          ) : funds.length === 0 ? (
            <Text color="inkMuted">No fund activity recorded.</Text>
          ) : funds.map((fund) => (
            <Card key={fund.name} style={styles.detailCard}>
              <Text variant="bodyStrong">{fund.name}</Text>
              <Detail label="Initial / rollover" amount={fund.initialCentavos} />
              <Detail label="Net transfers" amount={fund.transfersCentavos} />
              <Detail label="Collected" amount={fund.collectedCentavos} />
              <Detail label="Disbursed" amount={fund.disbursedCentavos} />
              <Detail label="Unliquidated advances" amount={fund.unliquidatedCentavos} />
              <Detail label="Available balance" amount={fund.balanceCentavos} />
            </Card>
          ))}
        </View>
      ) : (
        <View style={styles.root}>
          <Text variant="bodyStrong">Pending / unliquidated cash advances</Text>
          {stats.pendingAdvances === undefined ? (
            <Text color="inkMuted">Advance details unavailable.</Text>
          ) : advances.length === 0 ? (
            <Text color="inkMuted">No pending advances for this term.</Text>
          ) : advances.map((advance) => (
            <Card key={advance.id} style={styles.detailCard}>
              <Text variant="bodyStrong">{advance.advanceId || advance.id}</Text>
              <Text variant="bodySm">{advance.requestor}</Text>
              <Text variant="bodySm" color="inkMuted">
                {advance.fund} · {advance.status}
              </Text>
              {advance.due ? <Text variant="caption" color="inkMuted">Due: {advance.due}</Text> : null}
              <Text variant="figure">{peso(advance.amountCentavos)}</Text>
            </Card>
          ))}
        </View>
      )}
      <Text variant="caption" color="inkMuted">
        Figures are scoped to the selected tenant and active academic term. This screen cannot post collections, liquidate advances, or move funds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  metric: { width: '48%', flexGrow: 1, gap: spacing[2], padding: 14, minHeight: 100 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  lineLabel: { flex: 1 },
  lineValue: { flexShrink: 1, textAlign: 'right' },
  flow: { gap: spacing[1] },
  track: { height: 9, borderRadius: radius.pill, overflow: 'hidden' },
  toggle: { flexDirection: 'row', gap: spacing[2] },
  switch: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.pill },
  detailCard: { gap: spacing[2], padding: 16 },
});
