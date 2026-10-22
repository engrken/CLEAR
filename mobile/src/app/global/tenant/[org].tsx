import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type LedgerEntry, type Student } from '@/api';
import { BackHeader, Banner, Button, Card, LedgerList, LedgerRow, Screen, Text } from '@/components/ui';
import { FinancialOverview } from '@/components/overview/FinancialOverview';
import { formatWhen } from '@/lib/dates';
import { fromCentavos } from '@/lib/money';
import { useGlobalSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

type Section = 'overview' | 'students' | 'activity' | 'remittances';
const SECTIONS: { key: Section; title: string }[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'students', title: 'Students' },
  { key: 'activity', title: 'Activity' },
  { key: 'remittances', title: 'Remittances' },
];

export default function GlobalTenantReadOnly() {
  const params = useLocalSearchParams<{ org: string }>();
  const slug = typeof params.org === 'string' ? params.org : '';
  const global = useGlobalSession();
  const router = useRouter();
  const { c } = useTheme();
  const [section, setSection] = useState<Section>('overview');

  const summary = useAsync(
    () => api.getGlobalTenantDashboard(global, slug),
    `${global.token}:${slug}:summary`,
  );
  const students = useAsync<Student[]>(
    () => section === 'students' ? api.listGlobalTenantStudents(global, slug) : Promise.resolve([]),
    `${global.token}:${slug}:students:${section === 'students'}`,
  );
  const activity = useAsync<LedgerEntry[]>(
    () => section === 'activity' ? api.listGlobalTenantLedger(global, slug) : Promise.resolve([]),
    `${global.token}:${slug}:activity:${section === 'activity'}`,
  );
  const remittances = useAsync<LedgerEntry[]>(
    () => section === 'remittances' ? api.listGlobalTenantRemittances(global, slug) : Promise.resolve([]),
    `${global.token}:${slug}:remittances:${section === 'remittances'}`,
  );

  const { reload: refreshSummary } = summary;
  useFocusEffect(useCallback(() => { refreshSummary(); }, [refreshSummary]));

  const selected = section === 'students' ? students : section === 'activity' ? activity : remittances;
  const refresh = () => {
    if (section === 'overview') refreshSummary();
    else selected.reload();
  };
  const financials = summary.data?.dashboard;

  return (
    <Screen
      edges={['top', 'bottom']}
      header={<BackHeader title="Global tenant access" onBack={() => router.replace('/global')} />}
      contentStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          {summary.data?.organization.name || slug}
        </Text>
        <Text variant="bodySm" color="inkMuted">
          {summary.data?.organization.status || 'Loading'} · {summary.data?.organization.type || 'Tenant'}
        </Text>
        <Text variant="caption" color="inkMuted">
          Global Superadmin access · {summary.data?.organization.activeAy || ''} {summary.data?.organization.activeTerm || ''}
        </Text>
      </View>

      <Banner tone="info" title="All-tenant read-only access">
        Your verified Global Superadmin role permits viewing this tenant, even when archived. Transactions, receipts, account changes and verification actions remain disabled in Android.
      </Banner>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {SECTIONS.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.key === section }}
            onPress={() => setSection(tab.key)}
            style={[styles.tab, { backgroundColor: tab.key === section ? c.inkBlock : c.soft }]}>
            <Text variant="bodyStrong" style={{ color: tab.key === section ? c.onAccent : c.ink }}>
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {summary.error ? <Banner tone="danger" title="Tenant overview unavailable">{summary.error.message}</Banner> : null}

      {section === 'overview' ? (
        <>
          {summary.loading && !financials ? <ActivityIndicator color={c.cobalt} /> : null}
          {financials ? (
            <>
              <FinancialOverview stats={financials} />
              <Card style={styles.compact}>
                <Text variant="bodyStrong">Pending payment proofs</Text>
                <Text variant="figure">{financials.pendingCount}</Text>
                <Text variant="bodySm" color="inkMuted">Review only; mobile financial actions remain disabled.</Text>
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <>
          {selected.loading ? <ActivityIndicator color={c.cobalt} /> : null}
          {selected.error ? <Banner tone="danger" title="Unable to load records">{selected.error.message}</Banner> : null}

          {section === 'students' && students.data && !students.loading ? (
            <>
              <Text variant="caption" color="inkMuted">Student roster · first {students.data.length} records</Text>
              {students.data.map((student) => (
                <Card key={student.id} style={styles.compact}>
                  <View style={{ gap: 4 }}>
                    <Text variant="bodyStrong">{student.fullName}</Text>
                    <Text variant="bodySm" color="inkMuted">
                      {student.studentId} · {student.yearLevel} · {student.enrollmentStatus}
                    </Text>
                  </View>
                </Card>
              ))}
              {students.data.length === 0 ? <Text color="inkMuted">No students found.</Text> : null}
            </>
          ) : null}

          {section !== 'students' && selected.data && !selected.loading ? (
            <>
              <Text variant="caption" color="inkMuted">
                {section === 'activity' ? 'Latest tenant financial activity' : 'Pending payment proofs'} · read-only
              </Text>
              <LedgerList>
                {(selected.data as LedgerEntry[]).map((item) => (
                  <LedgerRow
                    key={item.id}
                    title={item.title}
                    reference={item.reference}
                    subtitle={`${item.subtitle} · ${formatWhen(item.at)}`}
                    amount={fromCentavos(item.amountCentavos)}
                    status={item.status}
                  />
                ))}
              </LedgerList>
              {selected.data.length === 0 ? <Text color="inkMuted">No records for this term.</Text> : null}
            </>
          ) : null}
        </>
      )}
      <Button block variant="secondary" onPress={refresh}>{`Refresh ${section}`}</Button>
      <Button block variant="ghost" onPress={() => router.replace('/global')}>Back to all tenants</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3], paddingBottom: spacing[8] },
  head: { paddingHorizontal: 4, gap: 5 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4 },
  tab: { paddingVertical: 11, paddingHorizontal: 17, borderRadius: radius.pill },
  compact: { paddingVertical: 12, paddingHorizontal: 16 },
});
