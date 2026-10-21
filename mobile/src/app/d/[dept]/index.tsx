import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { BackHeader, Banner, Button, IconWell, OrgMark, Screen, TermChip, Text, type IconName } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme, type ColorTokens } from '@/theme';

/** A department's portal: the student path or the officer path. */
export default function Portal() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { session, globalSession } = useSession();
  const org = useAsync(() => api.getOrganization(dept), dept);

  if (org.loading && !org.data) {
    return (
      <Screen header={<BackHeader />}>
        <ActivityIndicator color={c.cobalt} style={{ paddingVertical: spacing[6] }} />
      </Screen>
    );
  }
  if (org.error || !org.data) {
    return (
      <Screen header={<BackHeader />}>
        <Banner tone="danger" title="Department not found">{org.error?.message}</Banner>
      </Screen>
    );
  }

  const o = org.data;
  const signedInHere = session?.org.subdomain === o.subdomain;

  return (
    <Screen header={<BackHeader />} contentStyle={styles.content}>
      <View style={styles.hero}>
        <OrgMark name={o.name} logoUri={o.logoUrl} size={72} />
        <Text variant="display" accessibilityRole="header" style={styles.orgName}>{o.name}</Text>
        <TermChip ay={o.activeAy} term={o.activeTerm} />
      </View>

      <Text variant="label" color="inkMuted" style={styles.label}>{'I’m a student'}</Text>
      <Choice
        icon="qr"
        title="Check my clearance"
        body="See if you’re cleared and get your QR code"
        bg="mint"
        bodyColor="mintInk"
        wellBg={c.inkBlock}
        wellFg={c.mint}
        onPress={() => router.push({ pathname: '/d/[dept]/clearance', params: { dept } })}
      />
      <Choice
        icon="upload"
        title="I paid by GCash or Maya"
        body="Upload the receipt for checking"
        bg="sunTint"
        bodyColor="sunInkSoft"
        wellBg={c.sun}
        wellFg={c.ink}
        onPress={() => router.push({ pathname: '/d/[dept]/submit-proof', params: { dept } })}
      />

      <View style={styles.spacer} />

      {signedInHere ? (
        <Text variant="bodySm" color="inkMuted" style={styles.signedIn}>{`Signed in as ${session!.officer.fullName}.`}</Text>
      ) : null}
      {globalSession ? (
        <Button
          block
          variant="secondary"
          icon="shield"
          onPress={() => router.push({
            pathname: '/global/tenant/[org]',
            params: { org: o.subdomain },
          })}>
          Open {o.name} as Global Superadmin
        </Button>
      ) : (
        <>
          <Button
            block
            variant="secondary"
            icon="shield"
            onPress={() => signedInHere
              ? router.replace('/home')
              : router.push({ pathname: '/d/[dept]/sign-in', params: { dept } })}>
            {signedInHere ? 'Open officer workspace' : 'Officer sign-in'}
          </Button>
          <Button
            block
            variant="ghost"
            icon="shield"
            onPress={() => router.push('/global/sign-in')}>
            Global Superadmin sign-in — access any tenant
          </Button>
        </>
      )}
    </Screen>
  );
}

function Choice({ icon, title, body, bg, bodyColor, wellBg, wellFg, onPress }: {
  icon: IconName;
  title: string;
  body: string;
  bg: keyof ColorTokens;
  bodyColor: keyof ColorTokens;
  wellBg: string;
  wellFg: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.choice, { backgroundColor: c[bg], opacity: pressed ? 0.85 : 1 }]}>
      <IconWell icon={icon} bg={wellBg} fg={wellFg} size={52} />
      <View style={styles.choiceText}>
        <Text variant="headline">{title}</Text>
        <Text variant="bodySm" color={bodyColor}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 12, paddingBottom: spacing[6] },
  hero: { alignItems: 'flex-start', gap: 10, paddingHorizontal: 6, paddingBottom: 10 },
  orgName: { fontSize: 34, lineHeight: 36, letterSpacing: -0.68 },
  label: { paddingHorizontal: 6 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: radius.lg,
  },
  choiceText: { flex: 1, minWidth: 0, gap: 2 },
  spacer: { flex: 1, minHeight: spacing[4] },
  signedIn: { textAlign: 'center' },
});
