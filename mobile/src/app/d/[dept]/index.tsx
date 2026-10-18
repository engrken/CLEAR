import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Icon, OrgMark, Screen, Text, type IconName } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** A department's portal: the student path or the officer path. */
export default function Portal() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { session } = useSession();
  const org = useAsync(() => api.getOrganization(dept), dept);

  if (org.loading && !org.data) {
    return <Screen><ActivityIndicator color={c.accent} /></Screen>;
  }
  if (org.error || !org.data) {
    return <Screen><Banner tone="danger" title="Department not found">{org.error?.message}</Banner></Screen>;
  }

  const o = org.data;
  const signedInHere = session?.org.subdomain === o.subdomain;

  return (
    <Screen edges={['bottom']}>
      <View style={styles.hero}>
        <OrgMark name={o.name} logoUri={o.logoUrl} />
        <Text variant="display" style={{ textAlign: 'center' }}>{o.name}</Text>
        <Text variant="caption" color="inkMuted">{o.activeAy} · {o.activeTerm}</Text>
      </View>

      <View style={{ gap: spacing[3] }}>
        <Choice
          icon="qr"
          title="Student clearance"
          body="Check whether you’re cleared and get your clearance QR code."
          onPress={() => router.push({ pathname: '/d/[dept]/clearance', params: { dept } })}
        />
        <Choice
          icon="upload"
          title="Submit payment proof"
          body="Paid through GCash or Maya? Upload the receipt for verification."
          onPress={() => router.push({ pathname: '/d/[dept]/submit-proof', params: { dept } })}
        />
        <Choice
          icon="shield"
          title={signedInHere ? 'Open officer workspace' : 'Officer sign-in'}
          body={signedInHere ? `Signed in as ${session!.officer.fullName}.` : 'Treasurers, auditors and admins sign in with an email code.'}
          accent
          onPress={() =>
            signedInHere ? router.replace('/home') : router.push({ pathname: '/d/[dept]/sign-in', params: { dept } })
          }
        />
      </View>
    </Screen>
  );
}

function Choice({ icon, title, body, onPress, accent }: { icon: IconName; title: string; body: string; onPress: () => void; accent?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: pressed ? c.accentTint : c.card, borderColor: accent ? c.accent : c.border },
      ]}>
      <View style={[styles.choiceIcon, { backgroundColor: c.accentTint }]}>
        <Icon name={icon} size={22} color="accentInk" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="bodySm" color="inkMuted">{body}</Text>
      </View>
      <Icon name="forward" size={16} color="inkMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing[2], paddingTop: spacing[4] },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
