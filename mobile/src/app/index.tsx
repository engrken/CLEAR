import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Button, ColorHeader, Icon, OrgMark, Screen, Text } from '@/components/ui';
import { PRIVACY_URL, openWebPage } from '@/lib/links';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

/** Gateway: pick the department or organization to enter. */
export default function Gateway() {
  const router = useRouter();
  const { c } = useTheme();
  const orgs = useAsync(() => api.listOrganizations(), 'orgs');

  // Light status-bar icons over the cobalt header; every other screen is dark on white.
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
          back={false}
          title="Which department are you in?"
          body="Students check clearance and send payment proof. Officers sign in to manage the ledger."
        />
      }>
      {orgs.error ? <Banner tone="danger" title="Couldn’t load departments">{orgs.error.message}</Banner> : null}
      {orgs.loading && !orgs.data ? <ActivityIndicator color={c.cobalt} style={{ paddingVertical: spacing[4] }} /> : null}

      {orgs.data?.map((org, i) => (
        <Pressable
          key={org.subdomain}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/d/[dept]', params: { dept: org.subdomain } })}
          style={({ pressed }) => [
            styles.org,
            { backgroundColor: i === 0 ? c.cobaltTint : c.soft, opacity: pressed ? 0.8 : 1 },
          ]}>
          <OrgMark name={org.name} logoUri={org.logoUrl} size={52} tone={i % 2 === 1 ? 'sun' : 'cobalt'} />
          <View style={styles.orgText}>
            <Text variant="bodyStrong" numberOfLines={2} style={{ fontSize: 17 }}>{org.name}</Text>
            <Text variant="caption" color="inkMuted">{org.type} · {org.activeTerm}</Text>
          </View>
          <Icon name="forward" size={18} color="ink" />
        </Pressable>
      ))}

      <Button
        block
        variant="secondary"
        icon="shield"
        onPress={() => router.push('/global/sign-in')}>
        Global administrator sign-in
      </Button>

      <View style={styles.spacer} />

      <View style={styles.note}>
        <Text variant="caption" color="inkMuted" style={styles.noteText}>
          Not an official Filamer Christian University app. Your data is processed under the Data Privacy Act of 2012
          (RA 10173).
        </Text>
      </View>

      <Button variant="ghost" size="sm" style={styles.privacy} onPress={() => openWebPage(PRIVACY_URL)}>
        Privacy policy
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 20, gap: 10 },
  org: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 80,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  orgText: { flex: 1, minWidth: 0, gap: 2 },
  spacer: { flex: 1, minHeight: spacing[2] },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[2] },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  privacy: { alignSelf: 'center', minHeight: 48 },
});
