import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api, type OrganizationStatus, type SubscriptionTier } from '@/api';
import { MOBILE_BUSINESS_WRITES_ENABLED } from '@/api/config';
import { BackHeader, Banner, Button, Card, Screen, Text, TextField } from '@/components/ui';
import { useGlobalSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

function SelectValue<T extends string>({ label, options, value, onSelect }: {
  label: string; options: readonly T[]; value: T; onSelect: (next: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="label">{label}</Text>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable key={option} onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: option === value }}
            style={[styles.option, { backgroundColor: option === value ? c.inkBlock : c.soft }]}>
            <Text variant="bodySm" style={{ color: option === value ? c.onAccent : c.ink }}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ManageTenant() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const global = useGlobalSession();
  const router = useRouter();
  const { c } = useTheme();
  const tenants = useAsync(() => api.listManagedTenants(global), global.token + ':management');
  const { reload } = tenants;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const org = tenants.data?.find((tenant) => tenant.id === id);

  const [tier, setTier] = useState<SubscriptionTier>();
  const [status, setStatus] = useState<OrganizationStatus>();
  const [group, setGroup] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function apply(action: 'tier' | 'status' | 'group', value: string) {
    if (busy || !org || confirmation !== `MANAGE ${org.subdomain}`) return;
    if (value === (action === 'tier' ? org.tier : action === 'status' ? org.status : org.schoolGroup)) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.manageTenant(global, {
        organizationId: org.id, action, value, confirmation,
      });
      setSuccess(`Updated ${org.name}. Change recorded in CLEAR's audit log.`);
      setConfirmation('');
      setTier(undefined); setStatus(undefined); setGroup('');
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tenant changes.');
    } finally {
      setBusy(false);
    }
  }

  if (!MOBILE_BUSINESS_WRITES_ENABLED) {
    return (
      <Screen edges={['top', 'bottom']}
        header={<BackHeader title="Tenant status" onBack={() => router.replace('/global/provisions')} />}>
        <Banner tone="info" title="Read-only tenant status">
          This viewer cannot modify tenant status, subscription tiers, school groups or records.
        </Banner>
        {tenants.loading && !tenants.data ? <ActivityIndicator color={c.cobalt} /> : null}
        {tenants.error ? <Banner tone="danger" title="Unable to load tenant">{tenants.error.message}</Banner> : null}
        {tenants.data && !org ? <Banner tone="danger" title="Tenant unavailable">This tenant was not found.</Banner> : null}
        {org ? (
          <Card>
            <View style={styles.section}>
              <Text variant="headline">{org.name}</Text>
              <Text variant="bodySm" color="inkMuted">{org.subdomain} · {org.type}</Text>
              <Text variant="bodyStrong">Status: {org.status}</Text>
              <Text variant="bodySm">Subscription tier: {org.tier}</Text>
              <Text variant="bodySm">School group: {org.schoolGroup}</Text>
              <Text variant="bodySm">Active period: {org.activeAy} · {org.activeTerm}</Text>
              <Text variant="caption" color="inkMuted">
                {org.studentsCount} students · {org.collectionsCount} collection entries · {org.officersCount} officers
              </Text>
            </View>
          </Card>
        ) : null}
        {org ? <Button block variant="secondary" onPress={() => router.push({
          pathname: '/global/tenant/[org]', params: { org: org.subdomain },
        })}>Open tenant overview</Button> : null}
        <Button block variant="secondary" onPress={reload}>Refresh live status</Button>
        <Button block variant="ghost" onPress={() => router.replace('/global/provisions')}>Back to tenants</Button>
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top','bottom']}
      header={<BackHeader title="Manage tenant" onBack={() => router.replace('/global/provisions')} />}>
      {tenants.loading && !tenants.data ? <ActivityIndicator color={c.cobalt} /> : null}
      {tenants.error ? <Banner tone="danger" title="Unable to read tenant">{tenants.error.message}</Banner> : null}
      {tenants.data && !org ? <Banner tone="danger" title="Tenant not found">Return to the tenant directory.</Banner> : null}
      {org ? (
        <>
          <Card>
            <View style={styles.section}>
              <Text variant="headline">{org.name}</Text>
              <Text variant="bodySm" color="inkMuted">{org.subdomain} · {org.type}</Text>
              <Text variant="bodySm">Current tier: {org.tier}</Text>
              <Text variant="bodySm">Current status: {org.status}</Text>
              <Text variant="caption" color="inkMuted">Group: {org.schoolGroup}</Text>
              <Text variant="caption" color="inkMuted">
                {org.studentsCount} students · {org.collectionsCount} collections
              </Text>
            </View>
          </Card>
          <Banner tone="warning" title="Changes affect access and subscriptions">
            Inactive or archived tenants may become inaccessible to officers. Tier changes apply to all members of a named school group. Group transfers can adopt a different tier. Nothing here deletes student or financial records.
          </Banner>
          {error ? <Banner tone="danger" title="Change rejected">{error}</Banner> : null}
          {success ? <Banner tone="success" title="Change saved">{success}</Banner> : null}

          <Card>
            <View style={styles.section}>
              <Text variant="bodyStrong">Confirm tenant identity before changes</Text>
              <Text variant="bodySm" color="inkMuted">
                Type MANAGE followed by {org.subdomain}. This is required for every operation.
              </Text>
              <Text variant="bodyStrong">{`MANAGE ${org.subdomain}`}</Text>
              <TextField label="Management confirmation" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
            </View>
          </Card>

          <SelectValue label="Subscription tier" options={['Freemium', 'Pro', 'Corporate'] as const}
            value={tier || org.tier} onSelect={setTier} />
          <Button block variant="secondary" disabled={busy || !tier || tier === org.tier || confirmation !== `MANAGE ${org.subdomain}`}
            loading={busy} onPress={() => void apply('tier', tier || org.tier)}>
            Save subscription tier
          </Button>

          <SelectValue label="Tenant status" options={['Active', 'Inactive', 'Archived'] as const}
            value={status || org.status} onSelect={setStatus} />
          <Button block variant="secondary" disabled={busy || !status || status === org.status || confirmation !== `MANAGE ${org.subdomain}`}
            loading={busy} onPress={() => void apply('status', status || org.status)}>
            Save tenant status
          </Button>

          <TextField label="School group ID" value={group || org.schoolGroup}
            onChangeText={(value) => setGroup(value.toLowerCase())} autoCapitalize="none"
            helper="Moving into an existing group applies that group's shared tier and limit." />
          <Button block variant="secondary" disabled={busy || !group || group === org.schoolGroup || confirmation !== `MANAGE ${org.subdomain}`}
            loading={busy} onPress={() => void apply('group', group || org.schoolGroup)}>
            Save school group
          </Button>

          <Button block variant="ghost" onPress={() => router.push({
            pathname: '/global/tenant/[org]',
            params: { org: org.subdomain },
          })}>Open tenant overview (read-only)</Button>
        </>
      ) : null}
      <Button block variant="secondary" onPress={() => router.replace('/global/provisions')}>
        Back to all tenants
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  option: { minHeight: 44, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center' },
});
