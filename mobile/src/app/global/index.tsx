import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { useGlobalSession, useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

export default function GlobalDashboard() {
  const global = useGlobalSession();
  const { signOut } = useSession();
  const { c } = useTheme();
  const overview = useAsync(() => api.getGlobalOverview(global), global.token);
  const { reload } = overview;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const totalStudents = overview.data?.organizations.reduce((n, o) => n + o.studentsCount, 0) ?? 0;

  return (
    <Screen edges={['top']} contentStyle={styles.content}>
      <View style={styles.heading}>
        <Text variant="caption" color="inkMuted">CLEAR System</Text>
        <Text variant="display" accessibilityRole="header">Global administration</Text>
        <Text variant="bodySm" color="inkMuted">{global.admin.fullName} · {global.admin.email}</Text>
      </View>

      <Banner tone="info" title="Global Superadmin · read-only Android access">
        Your global role is separate from departmental roles. You can review organizations and role counts; provisioning, account suspension, impersonation, financial changes and official receipts remain in the audited web portal.
      </Banner>

      {overview.error ? (
        <Banner tone="danger" title="Unable to load overview">{overview.error.message}</Banner>
      ) : null}
      {overview.loading && !overview.data ? <ActivityIndicator color={c.cobalt} /> : null}

      {overview.data ? (
        <>
          <View style={styles.metrics}>
            <View style={[styles.metric, { backgroundColor: c.cobaltTint }]}>
              <Text variant="caption" color="inkMuted">Organizations</Text>
              <Text variant="headline">{overview.data.organizations.length}</Text>
            </View>
            <View style={[styles.metric, { backgroundColor: c.mint }]}>
              <Text variant="caption" color="inkMuted">Students</Text>
              <Text variant="headline">{totalStudents}</Text>
            </View>
          </View>
          <Card>
            <View style={{ gap: 6 }}>
              <Text variant="bodyStrong">Global administrator registry</Text>
              <Text variant="bodySm" color="inkMuted">Active registered accounts: {overview.data.globalAdmins.active}</Text>
              <Text variant="bodySm" color="inkMuted">Pending invitations: {overview.data.globalAdmins.pending}</Text>
            </View>
          </Card>

          <SectionHeader title="Organizations" />
          {overview.data.organizations.map((org) => (
            <Card key={org.subdomain}>
              <View style={{ gap: 7 }}>
                <Text variant="bodyStrong">{org.name}</Text>
                <Text variant="caption" color="inkMuted">{org.subdomain} · {org.type}</Text>
                <Text variant="bodySm" color="inkMuted">
                  {org.status} · {org.activeAy} · {org.activeTerm}
                </Text>
                <Text variant="bodySm">{org.studentsCount} students · {org.officersCount} officers</Text>
                {org.activeRoles?.length ? (
                  <View style={{ gap: 4 }}>
                    <Text variant="caption" color="inkMuted">Active department roles (not global administrator grants)</Text>
                    {org.activeRoles.map((entry) => (
                      <Text key={entry.role} variant="bodySm" color="inkMuted">
                        {entry.role}: {entry.count}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </Card>
          ))}
        </>
      ) : null}
      <Button block variant="secondary" onPress={reload}>Refresh overview</Button>
      <Button block variant="ink" onPress={() => void signOut()}>Sign out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3], paddingTop: spacing[5], paddingBottom: spacing[8] },
  heading: { gap: 5, paddingHorizontal: 4, paddingBottom: 6 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, borderRadius: 22, padding: 18, gap: 8 },
});
