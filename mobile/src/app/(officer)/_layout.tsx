import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text, type IconName } from '@/components/ui';
import { usePendingCount } from '@/lib/pending-count';
import { useSession } from '@/lib/session';
import { radius, size, useTheme } from '@/theme';

type TabDef = { name: string; title: string; icon: IconName; allowed: (can: (tab: string) => boolean) => boolean };

const TABS: TabDef[] = [
  { name: 'home', title: 'Home', icon: 'home', allowed: () => true },
  { name: 'collect', title: 'Collect', icon: 'receipt', allowed: (can) => can('tab-payment') },
  { name: 'verify', title: 'Verify', icon: 'shield', allowed: (can) => can('tab-remittances') },
  { name: 'students', title: 'Students', icon: 'people', allowed: (can) => can('tab-students') || can('tab-payment') },
  { name: 'more', title: 'More', icon: 'more', allowed: () => true },
];

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

/** The floating ink pill. A tab the role can't use has no button at all. */
function FloatingTabBar({ state, navigation }: BarProps) {
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
          const route = state.routes.find((r) => r.name === t.name);
          const badge = t.name === 'verify' && pending ? pending : 0;
          return (
            <Pressable
              key={t.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${t.title}, ${badge} pending` : t.title}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route?.key ?? t.name, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(t.name);
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
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, href: t.allowed(can) ? undefined : null }} />
      ))}
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
