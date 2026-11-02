import { api } from '@/api';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, Card, Icon, Screen, Text } from '@/components/ui';
import { DataPrivacyNotice } from '@/components/privacy/DataPrivacyNotice';
import { ACCOUNT_DELETION_URL, PRIVACY_URL, openWebPage, openDepartmentModule, switchToDepartmentWebPortal, openVerifiedWebHandoff } from '@/lib/links';
import { grantedModules, type MobileAvailability } from '@/lib/module-access';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { radius, spacing, useTheme } from '@/theme';

const LINKS = [
  { url: PRIVACY_URL, title: 'Privacy policy' },
  { url: ACCOUNT_DELETION_URL, title: 'Delete my account or data' },
];

const state: Record<MobileAvailability, string> = {
  available: 'In app',
  'review-only': 'Review in app',
  paused: 'Unavailable on Android',
  'web-only': 'Secure web',
};

/** Grouping is presentation only. Effective tab grants still come from the server. */
const GROUPS = [
  { title: 'Students & clearance', tabs: ['tab-students', 'tab-clearance', 'tab-collectibles', 'tab-penalties'] },
  { title: 'Payments & finance', tabs: ['tab-overview', 'tab-payment', 'tab-remittances', 'tab-advances', 'tab-audit', 'tab-void', 'tab-transfer'] },
  { title: 'Reports & administration', tabs: ['tab-reports', 'tab-report', 'tab-users', 'tab-setup'] },
] as const;

const initials = (name: string) =>
  name.replace(/[^A-Za-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean)
    .slice(0, 2).map((word) => word[0].toUpperCase()).join('') || '·';

export default function More() {
  const session = useOfficerSession();
  const { signOut, refreshPermissions } = useSession();
  const router = useRouter();
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const isTenantAdmin = ['admin', 'administrator', 'master'].includes(String(session.officer.role).trim().toLowerCase());
  const modules = grantedModules(session.officer.allowedTabs);
  const ready = modules.filter(m => m.availability === 'available' || m.availability === 'review-only' || (m.availability === 'web-only' && !!m.webPath));
  const normalized = query.trim().toLowerCase();
  const filtered = modules.filter(m => {
    if (!showAll && !normalized && m.availability === 'paused') return false;
    return !normalized || [m.name, m.detail, state[m.availability]].some(value => value.toLowerCase().includes(normalized));
  });
  const groups = GROUPS.map(group => ({
    title: group.title,
    items: filtered.filter(m => (group.tabs as readonly string[]).includes(m.tab)),
  })).filter(group => group.items.length > 0);

  useFocusEffect(useCallback(() => { void refreshPermissions(); }, [refreshPermissions]));

  const actionFor = (tab: string): { text: string; open: () => void } | null => {
    if (tab === 'tab-overview') return { text: 'Open overview', open: () => router.push('/home') };
    if (tab === 'tab-students') return { text: 'Open student roster', open: () => router.push('/students') };
    if (tab === 'tab-clearance') return {
      text: 'Open clearance lookup',
      open: () => router.push({ pathname: '/d/[dept]/clearance', params: { dept: session.org.subdomain } }),
    };
    if (tab === 'tab-remittances') return { text: 'Review payment proofs', open: () => router.push('/verify') };
    if (tab === 'tab-void') return { text: 'Browse Void audit', open: () => router.push('/void-audit') };
    const financeKinds: Record<string, string> = {
      'tab-penalties': 'penalties',
      'tab-advances': 'advances',
      'tab-audit': 'liquidations',
      'tab-payment': 'collections',
    };
    if (financeKinds[tab]) return {
      text: 'Review recent records',
      open: () => router.push({ pathname: '/finance-review', params: { kind: financeKinds[tab] } }),
    };
    return null;
  };

  const moduleRow = (m: (typeof modules)[number]) => {
    const action = m.availability === 'available' || m.availability === 'review-only' ? actionFor(m.tab) : null;
    const webAction = m.webPath && m.availability !== 'paused' ?
      { text: 'Open secure web module', open: () => void openDepartmentModule(session.org.subdomain, m.webPath!) } : null;
    return (
      <Card key={m.tab} style={styles.module}>
        <View style={styles.moduleBody}>
          <View style={styles.moduleTitle}>
            <Text variant="bodyStrong" style={styles.grow}>{m.name}</Text>
            <View style={[styles.badge, { backgroundColor: action || webAction ? c.mint : c.soft }]}>
              <Text variant="caption" color={action || webAction ? 'mintInk' : 'inkMuted'}>{state[m.availability]}</Text>
            </View>
          </View>
          <Text variant="bodySm" color="inkMuted">{m.detail}</Text>
          {action ? (
            <Button size="sm" variant="secondary" onPress={action.open}>{action.text}</Button>
          ) : null}
          {webAction ? (
            <Button size="sm" variant="secondary" onPress={webAction.open}>{webAction.text}</Button>
          ) : null}
          {webAction ? (
            <Text variant="caption" color="inkMuted">
              The web portal asks you to sign in separately and enforces the latest tenant permissions.
            </Text>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <>
      <Screen edges={['top']} bottomInset={TAB_BAR_SPACE + spacing[8]}
        contentStyle={styles.content}>
        <View style={[styles.profile, { backgroundColor: c.inkBlock }]}>
          <View style={[styles.profileAvatar, { backgroundColor: c.sun }]}>
            <Text variant="headline" style={{ fontSize: 18, lineHeight: 22 }}>{initials(session.officer.fullName)}</Text>
          </View>
          <View style={styles.grow}>
            <Text variant="headline" color="onAccent" numberOfLines={2}>{session.officer.fullName}</Text>
            <Text variant="caption" style={{ color: c.tabInactive }} numberOfLines={1}>{session.org.name}</Text>
            <Text variant="caption" style={{ color: c.tabInactive }}>{session.officer.role} · Authorized workspace</Text>
          </View>
        </View>

        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">My modules</Text>
          <Text variant="bodySm" color="inkMuted">
            {ready.length} available in app or secure web · {modules.length} assigned to your role.
          </Text>
        </View>

        <View style={[styles.search, { backgroundColor: c.soft }]}>
          <Icon name="search" size={19} color="inkMuted" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Find an assigned module"
            placeholder="Search my modules"
            placeholderTextColor={c.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: c.ink }]}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear module search"
              hitSlop={10} onPress={() => setQuery('')}>
              <Icon name="close" size={20} color="inkMuted" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.selector}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !showAll }}
            onPress={() => setShowAll(false)}
            style={[styles.segment, { backgroundColor: !showAll ? c.inkBlock : c.soft }]}>
            <Text variant="bodySm" color={!showAll ? 'onAccent' : 'ink'}>Available now</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: showAll }}
            onPress={() => setShowAll(true)}
            style={[styles.segment, { backgroundColor: showAll ? c.inkBlock : c.soft }]}>
            <Text variant="bodySm" color={showAll ? 'onAccent' : 'ink'}>All assigned</Text>
          </Pressable>
        </View>

        <Banner tone="info" title="Your permissions stay protected">
          Only your server-assigned modules appear. Audited transactions are accessible through a fresh web login; native financial posting remains blocked until its separate safety checks pass.
        </Banner>

        {groups.map(group => (
          <View key={group.title} style={styles.group}>
            <Text variant="headline" accessibilityRole="header">{group.title}</Text>
            {group.items.map(moduleRow)}
          </View>
        ))}
        {!groups.length ? (
          <Banner tone="info" title="No matching modules">
            Try a different search, or choose All assigned to view your web-only modules.
          </Banner>
        ) : null}

        <Text variant="headline" accessibilityRole="header">Account & help</Text>
        <Button block variant="secondary" icon="forward" onPress={() => void api.requestOfficerWebHandoff(session).then(({ url }) => openVerifiedWebHandoff(url)).catch(() => switchToDepartmentWebPortal(session.org.subdomain))}>
          Switch to Web Portal
        </Button>
        <Text variant="caption" color="inkMuted">
          Opens your tenant portal in a browser. Secure automatic sign-in is attempted when enabled; otherwise the browser opens the standard web sign-in.
        </Text>
        <Button block variant="secondary" icon="people" onPress={() => router.push('/officer/profile')}>
          My profile · Edit email
        </Button>
        {isTenantAdmin ? (
          <Button block variant="secondary" icon="people" onPress={() => router.push('/officer/tenant-portal')}>
            My tenant portal and settings
          </Button>
        ) : null}
        <Button block variant="secondary" icon="shield" onPress={() => router.push('/officer/walkthrough')}>
          Replay first-time guide
        </Button>
        <Button block variant="secondary" icon="shield" onPress={() => setPrivacyOpen(true)}>
          View data privacy notice
        </Button>
        <Button block variant="secondary" icon="shield" onPress={() => router.push('/global/sign-in')}>
          Sign in as Global Administrator
        </Button>
        <Text variant="caption" color="inkMuted">
          Global Administrator requires a separate OTP and independently verified permission.
        </Text>
        {LINKS.map(link => (
          <Pressable key={link.url} accessibilityRole="link" accessibilityHint="Opens in the browser"
            onPress={() => void openWebPage(link.url)}
            style={({ pressed }) => [styles.link, { backgroundColor: pressed ? c.cobaltTint : c.soft }]}>
            <Text variant="bodyStrong" style={styles.grow}>{link.title}</Text>
            <Icon name="forward" size={16} color="ink" />
          </Pressable>
        ))}
        <Button block variant="ink" onPress={() => void signOut()}>Sign out</Button>
      </Screen>
      <DataPrivacyNotice visible={privacyOpen} onDismiss={() => setPrivacyOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, gap: 12 },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.lg,
  },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0 },
  intro: { gap: 4, paddingTop: 4 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md,
    minHeight: 54, paddingHorizontal: 16,
  },
  searchInput: { flex: 1, minWidth: 0, minHeight: 50, fontFamily: 'Figtree_600SemiBold', fontSize: 16 },
  selector: { flexDirection: 'row', gap: spacing[2] },
  segment: { flex: 1, minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  group: { gap: spacing[2], marginTop: spacing[2] },
  module: { paddingVertical: 14, paddingHorizontal: 16 },
  moduleBody: { gap: spacing[2] },
  moduleTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    minHeight: 52, paddingHorizontal: 18, borderRadius: radius.md,
  },
});
