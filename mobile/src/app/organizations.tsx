import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Button, ColorHeader, Icon, OrgMark, Screen, Text } from '@/components/ui';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

/** Organization selector retained as the second step after the native landing page. */
export default function Organizations() {
  const router = useRouter();
  const { c } = useTheme();
  const orgs = useAsync(() => api.listOrganizations(), 'orgs');

  // The top header is cobalt, so use light system icons while it is focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [])
  );

  return (
    <Screen
      edges={['bottom']}
      contentStyle={styles.content}
      header={
        <ColorHeader
          tone="cobalt"
          brand
          title="Choose your organization"
          body="Students can inquire about clearance. Officers and tenant administrators sign in to view the data their roles permit."
        />
      }>
      {orgs.error ? (
        <Banner tone="danger" title="Could not load organizations">
          {orgs.error.message}
        </Banner>
      ) : null}
      {orgs.loading && !orgs.data ? (
        <ActivityIndicator color={c.cobalt} style={{ paddingVertical: spacing[4] }} />
      ) : null}

      {orgs.data?.length === 0 ? (
        <Banner tone="info" title="No organizations available">
          No organizations are published in this environment.
        </Banner>
      ) : null}

      {orgs.data?.map((org, i) => (
        <Pressable
          key={org.subdomain}
          accessibilityRole="button"
          accessibilityLabel={org.name}
          accessibilityHint="Open this organization's clearance and sign-in portal"
          onPress={() => router.push({ pathname: '/d/[dept]', params: { dept: org.subdomain } })}
          style={({ pressed }) => [
            styles.org,
            { backgroundColor: i === 0 ? c.cobaltTint : c.soft, opacity: pressed ? 0.8 : 1 },
          ]}>
          <OrgMark name={org.name} logoUri={org.logoUrl} size={52} tone={i % 2 === 1 ? 'sun' : 'cobalt'} />
          <View style={styles.orgText}>
            <Text variant="bodyStrong" numberOfLines={2} style={{ fontSize: 17 }}>{org.name}</Text>
            <Text variant="caption" color="inkMuted">{org.type + ' · ' + org.activeTerm}</Text>
          </View>
          <Icon name="forward" size={18} color="ink" />
        </Pressable>
      ))}

      {orgs.error ? (
        <Button block variant="secondary" onPress={orgs.reload}>Retry loading</Button>
      ) : null}

      <View style={styles.spacer} />
      <Button block variant="secondary" icon="shield" onPress={() => router.push('/global/sign-in')}>
        Global Superadmin sign-in
      </Button>
      <Text variant="caption" color="inkMuted" style={styles.note}>
        This mobile release is for viewing permitted information only. Payments, provisioning, and other business transactions are disabled.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 20, gap: 10 },
  org: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 80, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24 },
  orgText: { flex: 1, minWidth: 0, gap: 2 },
  spacer: { flex: 1, minHeight: spacing[2] },
  note: { paddingHorizontal: spacing[2], textAlign: 'center', fontSize: 12, lineHeight: 17 },
});
