import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import fcuSeal from '@/assets/images/fcu-seal.png';
import { Banner, Button, Card, Icon, OrgMark, Screen, Text } from '@/components/ui';
import { PRIVACY_URL, openWebPage } from '@/lib/links';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** Gateway: pick the department or organization to enter. */
export default function Gateway() {
  const router = useRouter();
  const { c } = useTheme();
  const orgs = useAsync(() => api.listOrganizations(), 'orgs');

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: c.accentTint }]}>
          <Icon name="shield" size={22} color="accentInk" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">CLEAR System</Text>
          <Text variant="caption" color="inkMuted">Centralized Liquidation of Expenses & Audit Records</Text>
        </View>
      </View>

      <View style={{ gap: spacing[2] }}>
        <Text variant="display">Choose your department</Text>
        <Text color="inkMuted">
          Students check clearance and submit payment proof. Officers sign in to manage the ledger.
        </Text>
      </View>

      {orgs.error ? <Banner tone="danger" title="Couldn’t load departments">{orgs.error.message}</Banner> : null}
      {orgs.loading && !orgs.data ? <ActivityIndicator color={c.accent} /> : null}

      <View style={{ gap: spacing[3] }}>
        {orgs.data?.map((org) => (
          <Pressable
            key={org.subdomain}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/d/[dept]', params: { dept: org.subdomain } })}
            style={({ pressed }) => [styles.org, { backgroundColor: pressed ? c.accentTint : c.card, borderColor: c.border }]}>
            <OrgMark name={org.name} logoUri={org.logoUrl} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" numberOfLines={2}>{org.name}</Text>
              <Text variant="caption" color="inkMuted">{org.type} · {org.activeTerm}</Text>
            </View>
            <Icon name="forward" size={16} color="inkMuted" />
          </Pressable>
        ))}
      </View>

      <Card style={styles.fcu}>
        <Image source={fcuSeal} alt="Filamer Christian University seal" style={styles.seal} contentFit="contain" />
        <Text variant="bodySm" color="inkMuted" style={{ flex: 1 }}>
          Filamer Christian University, Inc. Your data is processed under the Data Privacy Act of 2012 (RA 10173).
        </Text>
      </Card>

      <Button variant="ghost" size="sm" icon="shield" style={{ alignSelf: 'center' }} onPress={() => openWebPage(PRIVACY_URL)}>
        Privacy policy
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  mark: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  org: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fcu: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  seal: { width: 40, height: 40 },
});
