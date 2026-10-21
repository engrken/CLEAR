import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
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
  available: 'Android: Read-only',
  'review-only': 'Android: Review-only',
  paused: 'Android: Temporarily disabled',
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
  const modules = grantedModules(session.officer.allowedTabs);
  useFocusEffect(useCallback(() => { void refreshPermissions(); }, [refreshPermissions]));

  return (
    <Screen edges={['top']} bottomInset={TAB_BAR_SPACE} contentStyle={{ paddingTop: 18, gap: 14 }}>
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

      <Banner tone="info" title="Your web-assigned role and permissions">
        This list reflects the effective permissions returned by CLEAR's server.
        A department role named superadmin is not the same as a Global Superadmin.
        Financial posting remains disabled on Android for every role.
      </Banner>

      <Text variant="headline" accessibilityRole="header">Assigned modules ({modules.length})</Text>

      {modules.length === 0 ? (
        <Banner tone="warning" title="No assigned modules">
          Contact your department administrator to configure your permissions on the web.
        </Banner>
      ) : (
        modules.map((module) => (
          <Card key={module.tab} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ gap: 4 }}>
              <Text variant="bodyStrong">{module.name}</Text>
              <Text variant="caption" color="inkMuted">{state[module.availability]}</Text>
              <Text variant="bodySm" color="inkMuted">{module.detail}</Text>
              {module.tab === 'tab-clearance' ? (
                <Button size="sm" variant="secondary" onPress={() => router.push({
                  pathname: '/d/[dept]/clearance',
                  params: { dept: session.org.subdomain },
                })}>
                  Open clearance lookup
                </Button>
              ) : null}
            </View>
          </Card>
        ))
      )}

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

      <Button variant="secondary" block onPress={() => void signOut()}>Sign out</Button>
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
  link: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    minHeight: 52, paddingHorizontal: 18, borderRadius: 20,
  },
});
