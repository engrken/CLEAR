import { router, Tabs, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text, type IconName } from '@/components/ui';
import { PAYMENT_WRITES_ENABLED } from '@/api/config';
import { usePendingCount } from '@/lib/pending-count';
import { useSession } from '@/lib/session';
import { radius, size, useTheme } from '@/theme';

type TabDef = { name: string; title: string; icon: IconName; allowed: (can: (tab: string) => boolean) => boolean };

const TABS: TabDef[] = [
  { name: 'home', title: 'Home', icon: 'home', allowed: () => true },
  { name: 'collect', title: 'Collect', icon: 'receipt', allowed: (can) => PAYMENT_WRITES_ENABLED && can('tab-payment') },
  { name: 'verify', title: 'Review', icon: 'shield', allowed: (can) => can('tab-remittances') },
  { name: 'students', title: 'Students', icon: 'people', allowed: (can) => can('tab-students') || can('tab-payment') },
  { name: 'more', title: 'Modules', icon: 'more', allowed: () => true },
];

type BarProps = { state: { index: number; routes: { key: string; name: string }[] } };

/** The floating ink pill. A tab the role can't use has no button at all. */
function FloatingTabBar({ state }: BarProps) {
  const { c } = useTheme();
  const { can } = useSession();
  const pending = usePendingCount();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const visible = TABS.filter((t) => t.allowed(can));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.inkBlock }]}>
        {visible.map((t) => {
          const focused = current === t.name;
          const badge = t.name === 'verify' && pending ? pending : 0;
          return (
            <Pressable
              key={t.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${t.title}, ${badge} pending` : t.title}
              onPress={() => {
                if (!focused) router.navigate(`/${t.name}` as Href);
              }}
              style={[styles.item, focused && { backgroundColor: '#FFFFFF' }]}>
              <Icon name={t.icon} size={20} tint={focused ? c.ink : c.tabInactive} />
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ fontSize: 11, lineHeight: 14, fontFamily: focused ? 'Figtree_700Bold' : 'Figtree_600SemiBold', color: focused ? c.ink : c.tabInactive }}>
                {t.title}
              </Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: c.sun }]}>
                  <Text variant="caption" style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Officer tabs with the Bright Campus floating bar. */
export default function OfficerTabs() {
  const { c } = useTheme();
  const { can } = useSession();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...(props as unknown as BarProps)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.canvas } }}>
      {/* Router guards block deep links too; hiding the tab bar alone is insufficient. */}
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Protected guard={can('tab-payment') && PAYMENT_WRITES_ENABLED}>
        <Tabs.Screen name="collect" options={{ title: 'Collect' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-remittances')}>
        <Tabs.Screen name="verify" options={{ title: 'Verify' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-students') || can('tab-payment')}>
        <Tabs.Screen name="students" options={{ title: 'Students' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-payment') || can('tab-void')}>
        <Tabs.Screen name="reference-search" options={{ title: 'Reference search' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-penalties') || can('tab-advances') || can('tab-audit') || can('tab-payment')}>
        <Tabs.Screen name="finance-review" options={{ title: 'Finance review' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-void')}>
        <Tabs.Screen name="void-audit" options={{ title: 'Void audit' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-reports') || can('tab-report')}>
        <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-transfer')}>
        <Tabs.Screen name="realign-review" options={{ title: 'Fund transfer history' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-clearance')}>
        <Tabs.Screen name="clearance-admin" options={{ title: 'Clearance' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-collectibles')}>
        <Tabs.Screen name="collectibles" options={{ title: 'Collectibles' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-users')}>
        <Tabs.Screen name="users" options={{ title: 'Officers' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={can('tab-setup')}>
        <Tabs.Screen name="academic-calendar" options={{ title: 'Calendar' }} />
      </Tabs.Protected>
      <Tabs.Screen name="more" options={{ title: 'Modules' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    height: size.tabbarHeight,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 2,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  item: { flex: 1, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 2 },
  badge: { position: 'absolute', top: 5, left: '54%', minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'Figtree_700Bold', fontSize: 11, lineHeight: 14 },
});
