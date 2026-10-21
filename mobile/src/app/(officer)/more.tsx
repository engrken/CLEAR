import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Icon, Screen, Text } from '@/components/ui';
import { ACCOUNT_DELETION_URL, PRIVACY_URL, openWebPage } from '@/lib/links';
import { grantedModules, type MobileAvailability } from '@/lib/module-access';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { radius, spacing, useTheme } from '@/theme';

const LINKS = [
  { url: PRIVACY_URL, title: 'Privacy policy' },
  { url: ACCOUNT_DELETION_URL, title: 'Delete my account or data' },
];

const state: Record<MobileAvailability, string> = {
  available: 'Read-only',
  'review-only': 'Review-only',
  paused: 'Temporarily disabled',
  'web-only': 'Web only',
};

const initials = (name: string) =>
  name.replace(/[^A-Za-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean)
    .slice(0, 2).map((word) => word[0].toUpperCase()).join('') || '·';

export default function More() {
  const session = useOfficerSession();
  const { signOut, refreshPermissions } = useSession();
  const router = useRouter();
  const { c } = useTheme();
  const [showWebOnly, setShowWebOnly] = useState(false);
  const isTenantAdmin = ['admin', 'administrator', 'master'].includes(String(session.officer.role).trim().toLowerCase());
  const modules = grantedModules(session.officer.allowedTabs);
  const available = modules.filter((m) => m.availability === 'available' || m.availability === 'review-only');
  const paused = modules.filter((m) => m.availability === 'paused');
  const webOnly = modules.filter((m) => m.availability === 'web-only');
  useFocusEffect(useCallback(() => { void refreshPermissions(); }, [refreshPermissions]));

  const moduleRow = (m: (typeof modules)[number]) => (
    <Card key={m.tab} style={styles.module}>
      <View style={{ gap: 3 }}>
        <View style={styles.moduleTitle}>
          <Text variant="bodyStrong" style={{ flex: 1 }}>{m.name}</Text>
          <Text variant="caption" color="inkMuted">{state[m.availability]}</Text>
        </View>
        <Text variant="bodySm" color="inkMuted">{m.detail}</Text>
        {m.tab === 'tab-clearance' ? (
          <Button size="sm" variant="secondary" onPress={() => router.push({
            pathname: '/d/[dept]/clearance',
            params: { dept: session.org.subdomain },
          })}>
            Open clearance lookup
          </Button>
        ) : null}
      </View>
    </Card>
  );

  return (
    <Screen
      edges={['top']}
      bottomInset={TAB_BAR_SPACE + spacing[8]}
      contentStyle={{ paddingTop: 18, gap: 12 }}>
      <View style={[styles.profile, { backgroundColor: c.inkBlock }]}>
        <View style={[styles.profileAvatar, { backgroundColor: c.sun }]}>
          <Text variant="headline" style={{ fontSize: 18, lineHeight: 22 }}>{initials(session.officer.fullName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text variant="headline" color="onAccent" numberOfLines={2}>{session.officer.fullName}</Text>
          <Text variant="caption" style={{ color: c.tabInactive }}>{session.officer.email}</Text>
          <Text variant="caption" style={{ color: c.tabInactive }}>
            Department role: {session.officer.role} · {session.org.subdomain}
          </Text>
        </View>
      </View>

      {isTenantAdmin ? (
        <Button block variant="secondary" icon="people" onPress={() => router.push('/officer/tenant-portal')}>
          My tenant portal (read-only)
        </Button>
      ) : null}
      <Button
        block
        variant="secondary"
        icon="shield"
        onPress={() => router.push('/global/sign-in')}>
        Sign in as Global Superadmin
      </Button>
      <Text variant="caption" color="inkMuted">
        Uses a separate Global Superadmin OTP. You can open JIECEP or another tenant after verification.
      </Text>
      <Button block variant="secondary" onPress={() => void signOut()}>Sign out</Button>
      <Banner tone="info" title="Your web-assigned permissions">
        Modules are based on your current department role and web assignments. Global Superadmin sign-in is separate. Android financial posting is disabled for every role.
      </Banner>

      <Text variant="headline" accessibilityRole="header">Available on Android ({available.length})</Text>
      {available.map(moduleRow)}
      {!available.length ? <Text variant="bodySm" color="inkMuted">No modules assigned for Android viewing.</Text> : null}

      {paused.length ? (
        <>
          <Text variant="headline" accessibilityRole="header">Temporarily disabled ({paused.length})</Text>
          {paused.map(moduleRow)}
        </>
      ) : null}

      {webOnly.length ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showWebOnly }}
            accessibilityLabel={showWebOnly ? 'Hide web-only modules' : 'Show web-only modules'}
            onPress={() => setShowWebOnly((v) => !v)}
            style={[styles.expand, { backgroundColor: c.soft }]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="bodyStrong">Web-only modules ({webOnly.length})</Text>
              <Text variant="bodySm" color="inkMuted">
                {showWebOnly ? 'Tap to hide these modules' : 'Tap to view your assigned web modules'}
              </Text>
            </View>
            <Icon name={showWebOnly ? 'chevronDown' : 'forward'} size={20} color="ink" />
          </Pressable>
          {showWebOnly ? webOnly.map(moduleRow) : null}
        </>
      ) : null}

      <Text variant="headline" accessibilityRole="header">Account and privacy</Text>
      {LINKS.map((link) => (
        <Pressable
          key={link.url}
          accessibilityRole="link"
          accessibilityHint="Opens in the browser"
          onPress={() => openWebPage(link.url)}
          style={({ pressed }) => [styles.link, { backgroundColor: pressed ? c.cobaltTint : c.soft }]}>
          <Text variant="bodyStrong" style={{ flex: 1, fontSize: 15 }}>{link.title}</Text>
          <Icon name="forward" size={16} color="ink" />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.lg,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
  },
  module: { paddingVertical: 12, paddingHorizontal: 16 },
  moduleTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expand: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 18, paddingHorizontal: 16, borderRadius: radius.lg,
  },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    minHeight: 52, paddingHorizontal: 18, borderRadius: 20,
  },
});
