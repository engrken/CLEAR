import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, Screen, Text } from '@/components/ui';
import { ACCOUNT_DELETION_URL, PRIVACY_URL, openWebPage } from '@/lib/links';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { radius, spacing, useTheme, type ColorTokens } from '@/theme';

// Web modules that don't fit the tab bar, each gated by its permission tab.
const MODULES: { tab: string; title: string; body: string }[] = [
  { tab: 'tab-advances', title: 'Cash advances', body: 'Issue and track unliquidated advances' },
  { tab: 'tab-audit', title: 'Liquidations', body: 'Audit expenses against advances' },
  { tab: 'tab-penalties', title: 'Penalties', body: 'Fines and community service' },
  { tab: 'tab-payment', title: 'University cashier', body: 'Safekeeping deposits and withdrawals' },
  { tab: 'tab-transfer', title: 'Fund realignment', body: 'Transfers and term carry-over' },
  { tab: 'tab-void', title: 'Void center', body: 'Reverse ORs and penalties' },
  { tab: 'tab-reports', title: 'Reports', body: 'Financial summary and exports' },
  { tab: 'tab-users', title: 'Officers', body: 'Accounts and permissions' },
];

// Module tiles take these fills in turn.
const TILE_FILLS: (keyof ColorTokens)[] = ['cobaltTint', 'sunTint', 'mint', 'soft', 'coral'];

// Public web pages, opened in the browser.
const LINKS: { url: string; title: string }[] = [
  { url: PRIVACY_URL, title: 'Privacy policy' },
  { url: ACCOUNT_DELETION_URL, title: 'Delete my account or data' },
];

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '·';

export default function More() {
  const session = useOfficerSession();
  const { can, signOut } = useSession();
  const { c } = useTheme();
  const modules = MODULES.filter((m) => can(m.tab));

  return (
    <Screen edges={['top']} bottomInset={TAB_BAR_SPACE} contentStyle={{ paddingTop: 18, gap: 12 }}>
      <View style={[styles.profile, { backgroundColor: c.inkBlock }]}>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.profileAvatar, { backgroundColor: c.sun }]}>
          <Text variant="headline" style={{ fontSize: 18, lineHeight: 22 }}>{initials(session.officer.fullName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="headline" color="onAccent" numberOfLines={2}>{session.officer.fullName}</Text>
          <Text variant="caption" style={{ color: c.tabInactive }}>{session.officer.email} · {session.officer.role}</Text>
        </View>
      </View>

      {modules.length ? (
        <>
          <Text variant="headline" accessibilityRole="header" style={styles.sectionTitle}>Modules</Text>
          <View style={styles.grid}>
            {modules.map((m, i) => {
              const wide = modules.length % 2 === 1 && i === modules.length - 1;
              return (
                <Pressable
                  key={m.tab + m.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.title}. ${m.body}. Soon`}
                  accessibilityHint="Coming in a later build"
                  style={({ pressed }) => [
                    styles.tile,
                    wide ? styles.tileWide : styles.tileHalf,
                    { backgroundColor: c[TILE_FILLS[i % TILE_FILLS.length]], opacity: pressed ? 0.85 : 1 },
                  ]}>
                  <Text variant="bodyStrong" style={{ fontSize: 15, lineHeight: 20, flexShrink: 1 }}>{m.title}</Text>
                  <View style={[styles.soon, wide && { alignSelf: 'center' }]}>
                    <Text variant="caption" color="inkMuted" style={{ fontFamily: 'Figtree_700Bold', fontSize: 11, lineHeight: 14 }}>Soon</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={{ gap: 4, marginTop: 4 }}>
        {LINKS.map((l) => (
          <Pressable
            key={l.url}
            accessibilityRole="link"
            accessibilityHint="Opens in the browser"
            onPress={() => openWebPage(l.url)}
            style={({ pressed }) => [styles.link, { backgroundColor: pressed ? c.cobaltTint : c.soft }]}>
            <Text variant="bodyStrong" style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>{l.title}</Text>
            <Icon name="forward" size={16} color="ink" />
          </Pressable>
        ))}
      </View>

      <Button variant="secondary" block onPress={signOut}>Sign out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.lg },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, lineHeight: 24, marginTop: 4, paddingHorizontal: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: { borderRadius: 24, padding: 14 },
  tileHalf: { flexBasis: '40%', flexGrow: 1, minHeight: 92, justifyContent: 'space-between', gap: spacing[2] },
  tileWide: { flexBasis: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], paddingHorizontal: 16 },
  soon: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 52, paddingHorizontal: 18, borderRadius: 20 },
});
