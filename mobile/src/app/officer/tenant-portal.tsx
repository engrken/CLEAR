import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { api, type TenantPortalStatus } from '@/api';
import { BackHeader, Banner, Button, Card, Screen, Text } from '@/components/ui';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { useTheme } from '@/theme';

/** The authenticated tenant administrator can inspect only their own tenant. */
export default function TenantPortal() {
  const router = useRouter();
  const { c } = useTheme();
  const session = useOfficerSession();
  const portal = useAsync<TenantPortalStatus>(
    () => api.getTenantPortal(session),
    session.token + ':portal'
  );
  const { reload } = portal;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const org = portal.data?.organization;
  return (
    <Screen
      edges={['top', 'bottom']}
      header={<BackHeader title="Tenant portal" onBack={() => router.back()} />}>
      <Banner tone="info" title="Live production view · Read-only">
        These figures are served by CLEAR with your active tenant permissions.
        Payments, approvals, provisioning and other transactions are unavailable here.
      </Banner>
      {portal.loading && !portal.data ? <ActivityIndicator color={c.cobalt} /> : null}
      {portal.error ? (
        <Banner tone="danger" title="Unable to load tenant portal">{portal.error.message}</Banner>
      ) : null}
      {org ? (
        <>
          <Card>
            <View style={{ gap: 9 }}>
              <Text variant="headline">{org.name}</Text>
              <Text variant="bodySm" color="inkMuted">{org.subdomain} · {org.type}</Text>
              <Text variant="bodyStrong">Status: {org.status}</Text>
              <Text variant="bodySm">Subscription tier: {org.tier}</Text>
              <Text variant="bodySm">School group: {org.schoolGroup}</Text>
              <Text variant="bodySm">Active period: {org.activeAy} · {org.activeTerm}</Text>
              <Text variant="caption" color="inkMuted">Viewing only. Changes are made in the authorized CLEAR web portal.</Text>
            </View>
          </Card>
          <Card>
            <View style={{ gap: 10 }}>
              <Text variant="bodyStrong">Live tenant totals</Text>
              <Text variant="bodySm">Students: {portal.data?.studentsCount}</Text>
              <Text variant="bodySm">Active officers: {portal.data?.officersCount}</Text>
              <Text variant="bodySm">Current-term collection entries: {portal.data?.currentTermCollectionsCount}</Text>
              <Text variant="caption" color="inkMuted">As of: {portal.data?.asOf}</Text>
            </View>
          </Card>
        </>
      ) : null}
      <Button block variant="secondary" onPress={reload}>Refresh live status</Button>
      <Button block variant="ghost" onPress={() => router.back()}>Back to account</Button>
    </Screen>
  );
}
