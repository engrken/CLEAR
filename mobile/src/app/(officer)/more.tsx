import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Screen, Text, type IconName } from '@/components/ui';
import { useOfficerSession, useSession } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

// Web modules that don't fit the tab bar, each gated by its permission tab.
const MODULES: { tab: string; title: string; body: string; icon: IconName }[] = [
  { tab: 'tab-advances', title: 'Cash advances', body: 'Issue and track unliquidated advances', icon: 'cash' },
  { tab: 'tab-audit', title: 'Liquidations', body: 'Audit expenses against advances', icon: 'receipt' },
  { tab: 'tab-penalties', title: 'Penalties', body: 'Fines and community service', icon: 'clock' },
  { tab: 'tab-payment', title: 'University cashier', body: 'Safekeeping deposits and withdrawals', icon: 'bank' },
  { tab: 'tab-transfer', title: 'Fund realignment', body: 'Transfers and term carry-over', icon: 'transfer' },
  { tab: 'tab-void', title: 'Void center', body: 'Reverse ORs and penalties', icon: 'alert' },
  { tab: 'tab-reports', title: 'Reports', body: 'Financial summary and exports', icon: 'wallet' },
  { tab: 'tab-users', title: 'Officers', body: 'Accounts and permissions', icon: 'people' },
];

export default function More() {
  const session = useOfficerSession();
  const { can, signOut } = useSession();
  const { c } = useTheme();
  const modules = MODULES.filter((m) => can(m.tab));

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 2 }}>
        <Text variant="bodyStrong">{session.officer.fullName}</Text>
        <Text variant="bodySm" color="inkMuted">{session.officer.email} · {session.officer.role}</Text>
      </Card>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        {modules.map((m, i) => (
          <Pressable
            key={m.tab + m.title}
            accessibilityRole="button"
            accessibilityHint="Coming in a later build"
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: pressed ? c.accentTint : c.card },
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
            ]}>
            <Icon name={m.icon} size={20} color="accentInk" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{m.title}</Text>
              <Text variant="bodySm" color="inkMuted">{m.body}</Text>
            </View>
            <Text variant="caption" color="inkMuted">Soon</Text>
          </Pressable>
        ))}
      </Card>

      <Button
        variant="secondary"
        block
        icon="logout"
        onPress={signOut}>
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 64, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
});
