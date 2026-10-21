import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api, type ManagedTenant } from '@/api';
import { BackHeader, Banner, Button, Card, Screen, Text, TextField } from '@/components/ui';
import { useGlobalSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

export default function TenantManagement() {
  const global = useGlobalSession();
  const router = useRouter();
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const tenants = useAsync(() => api.listManagedTenants(global), global.token);
  const { reload } = tenants;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const q = search.trim().toLowerCase();
  const filtered = (tenants.data || []).filter((org) =>
    !q || [org.name, org.subdomain, org.schoolGroup, org.tier, org.status]
      .some((s) => s.toLowerCase().includes(q)));
  const totals = {
    active: tenants.data?.filter((o) => o.status === 'Active').length ?? 0,
    inactive: tenants.data?.filter((o) => o.status !== 'Active').length ?? 0,
  };

  return (
    <Screen edges={['top','bottom']} header={<BackHeader title="Tenant management" onBack={() => router.replace('/global')} />}>
      <Banner tone="info" title="Global Superadmin portal">
        Review every tenant and its school group, subscription tier and status. Changes are audited. Permanent deletion and financial operations are not available on Android.
      </Banner>
      <View style={styles.metrics}>
        <Card style={styles.metric}>
          <Text variant="caption" color="inkMuted">Active tenants</Text>
          <Text variant="headline">{totals.active}</Text>
        </Card>
        <Card style={styles.metric}>
          <Text variant="caption" color="inkMuted">Inactive / archived</Text>
          <Text variant="headline">{totals.inactive}</Text>
        </Card>
      </View>
      <Button block icon="plus" onPress={() => router.push('/global/provisions/new')}>Provision new tenant</Button>
      <TextField label="Find tenant, group or tier" value={search} onChangeText={setSearch} placeholder="JIECEP, default-school, Pro..." autoCapitalize="none" autoCorrect={false} />
      {tenants.error ? <Banner tone="danger" title="Could not load tenants">{tenants.error.message}</Banner> : null}
      {tenants.loading && !tenants.data ? <ActivityIndicator color={c.cobalt} /> : null}
      <Text variant="headline">Registered tenants ({filtered.length})</Text>
      {filtered.map((org: ManagedTenant) => (
        <Card key={org.id} style={styles.tenant}>
          <View style={{ gap: 5 }}>
            <Text variant="bodyStrong">{org.name}</Text>
            <Text variant="bodySm" color="inkMuted">
              {org.subdomain} · {org.type}
            </Text>
            <Text variant="bodySm">
              {org.tier} · {org.status}
            </Text>
            <Text variant="caption" color="inkMuted">Group: {org.schoolGroup}</Text>
            <Text variant="caption" color="inkMuted">
              {org.studentsCount} students · {org.collectionsCount} collections · {org.officersCount} officers
            </Text>
            <Text variant="caption" color="inkMuted">{org.activeAy} · {org.activeTerm}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: '/global/tenant/[org]', params: { org: org.subdomain },
              })}
              style={[styles.action, { backgroundColor: c.cobaltTint }]}>
              <Text variant="bodySm" color="cobalt">Open overview</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: '/global/provisions/[id]', params: { id: org.id },
              })}
              style={[styles.action, { backgroundColor: c.soft }]}>
              <Text variant="bodySm">Manage tenant</Text>
            </Pressable>
          </View>
        </Card>
      ))}
      {tenants.data && filtered.length === 0 ? <Text variant="bodySm" color="inkMuted">No matching tenants.</Text> : null}
      <Button block variant="secondary" onPress={reload}>Refresh tenant directory</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: spacing[2] },
  metric: { flex: 1, padding: 16, gap: 8 },
  tenant: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  action: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
});
