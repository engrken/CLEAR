import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, IconWell, Screen, Text, type IconName } from '@/components/ui';
import { PRIVACY_URL, openWebPage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Native welcome page inspired by the CLEAR web landing page.
 * All entry points remain navigational: access checks live in protected routes
 * and server APIs, never in these public-facing cards.
 */
export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  const { session, globalSession } = useSession();
  const signedIn = !!session || !!globalSession;

  const openOrganizations = () => router.push('/organizations');
  const openWorkspace = () => {
    if (globalSession) router.push('/global');
    else if (session) router.push('/home');
    else openOrganizations();
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <IconWell icon="shield" bg={c.cobaltTint} fg={c.cobalt} size={44} />
        <View style={styles.brandText}>
          <Text variant="headline">CLEAR System</Text>
          <Text variant="caption" color="inkMuted" style={styles.brandSubtitle}>
            CENTRALIZED LIQUIDATION OF EXPENSES & AUDIT RECORDS
          </Text>
        </View>
      </View>

      <View style={[styles.hero, { backgroundColor: c.inkBlock }]}>
        <View pointerEvents="none" style={[styles.halo, { backgroundColor: c.cobalt }]} />
        <View style={[styles.heroTag, { backgroundColor: c.cobalt }]}>
          <Icon name="shield" size={15} tint="#FFFFFF" />
          <Text variant="caption" style={styles.tagText}>SECURE CAMPUS PORTAL</Text>
        </View>
        <Text variant="display" accessibilityRole="header" style={styles.heroTitle}>
          Financial accountability & campus clearance.
        </Text>
        <Text variant="body" style={styles.heroBody}>
          One place to find your organization, inquire about clearance, and view the information your role is authorized to see.
        </Text>
        <Button block variant="light" icon="arrowRight" onPress={openWorkspace}>
          {signedIn ? 'Open my workspace' : 'Enter organization portal'}
        </Button>
        <View style={styles.heroFoot}>
          <Icon name="shield" size={15} tint={c.onCobaltMuted} />
          <Text variant="caption" style={styles.heroFootText}>
            Role-scoped access · Read-only Android viewer
          </Text>
        </View>
      </View>

      <View style={styles.intro}>
        <Text variant="title">Choose how to enter</Text>
        <Text variant="bodySm" color="inkMuted">
          Select your path. Your organization and verified permissions determine the information you can access.
        </Text>
      </View>

      <View style={styles.cards}>
        <AccessCard
          icon="qr"
          title="Students"
          description="Find your organization and start a clearance inquiry."
          onPress={openOrganizations}
        />
        <AccessCard
          icon="people"
          title="Officers"
          description="Sign in with your registered officer email."
          onPress={session ? openWorkspace : openOrganizations}
        />
        <AccessCard
          icon="bank"
          title="Tenant administrators"
          description="Review your own tenant portal after authorized sign-in."
          onPress={session ? openWorkspace : openOrganizations}
        />
        <AccessCard
          icon="shield"
          title="Global Superadmin"
          description="Access the global overview and authorized tenants."
          onPress={() => router.push(globalSession ? '/global' : '/global/sign-in')}
        />
      </View>

      <View style={[styles.highlights, { backgroundColor: c.soft }]}>
        <Text variant="headline">Built for academic accountability</Text>
        <Feature icon="search" title="Clearance inquiry" body="Student record access is subject to identity and privacy safeguards." />
        <Feature icon="shield" title="Tenant isolation" body="Officer and administrator views follow their assigned permissions." />
        <Feature icon="receipt" title="Financial transparency" body="Authorized users can review records without posting transactions." />
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color="inkMuted" style={styles.disclaimer}>
          Personal data is handled in accordance with the Data Privacy Act of 2012 (RA 10173).
        </Text>
        <Button variant="ghost" size="sm" onPress={() => void openWebPage(PRIVACY_URL)}>
          Privacy policy
        </Button>
      </View>
    </Screen>
  );
}

function AccessCard({ icon, title, description, onPress }: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [
        styles.accessCard,
        { backgroundColor: c.ground, borderColor: c.border, opacity: pressed ? 0.75 : 1 },
      ]}>
      <IconWell icon={icon} bg={c.cobaltTint} fg={c.cobalt} size={48} />
      <View style={styles.accessText}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="bodySm" color="inkMuted">{description}</Text>
      </View>
      <Icon name="forward" size={18} color="inkMuted" />
    </Pressable>
  );
}

function Feature({ icon, title, body }: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.feature}>
      <Icon name={icon} size={22} color="cobalt" />
      <View style={styles.featureText}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="bodySm" color="inkMuted">{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[8] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[1], paddingBottom: spacing[1] },
  brandText: { flex: 1, minWidth: 0, gap: 1 },
  brandSubtitle: { fontSize: 9, lineHeight: 13, letterSpacing: 0.4 },
  hero: { borderRadius: radius.xl, padding: spacing[6], gap: spacing[5], overflow: 'hidden' },
  halo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, top: -120, right: -100, opacity: 0.6 },
  heroTag: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', borderRadius: radius.pill, gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 0.6 },
  heroTitle: { color: '#FFFFFF', fontSize: 37, lineHeight: 40 },
  heroBody: { color: '#DDE2FF', lineHeight: 24 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFootText: { color: '#DDE2FF', fontSize: 12, flexShrink: 1 },
  intro: { gap: spacing[2], paddingHorizontal: spacing[1], paddingTop: spacing[2] },
  cards: { gap: spacing[3] },
  accessCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1, borderRadius: radius.md, padding: spacing[4], minHeight: 86 },
  accessText: { flex: 1, minWidth: 0, gap: 3 },
  highlights: { borderRadius: radius.lg, gap: spacing[4], padding: spacing[5] },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  featureText: { flex: 1, gap: 3 },
  footer: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  disclaimer: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
