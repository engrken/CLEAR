import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useSession } from '@/lib/session';
import { radius, size, type, useTheme } from '@/theme';

/** Officer bottom tabs. A tab the role can't use is hidden, not disabled. */
export default function OfficerTabs() {
  const { c } = useTheme();
  const { can } = useSession();

  const icon = (name: IconName) =>
    function TabIcon({ focused }: { focused: boolean }) {
      return (
        <View style={[styles.indicator, focused && { backgroundColor: c.accentTint }]}>
          <Icon name={name} size={20} color={focused ? 'accentInk' : 'inkMuted'} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.ink,
        headerTitleStyle: type.headline,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, minHeight: size.tabbarHeight },
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.inkMuted,
        tabBarLabelStyle: { ...type.caption, marginTop: 2 },
        tabBarBadgeStyle: { backgroundColor: c.dangerFill, color: c.onDanger, fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 11 },
        sceneStyle: { backgroundColor: c.canvas },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="collect"
        options={{ title: 'Collect', tabBarIcon: icon('receipt'), href: can('tab-payment') ? undefined : null }}
      />
      <Tabs.Screen
        name="verify"
        options={{ title: 'Verify', tabBarIcon: icon('shield'), href: can('tab-remittances') ? undefined : null }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: 'Students', tabBarIcon: icon('people'), href: can('tab-students') || can('tab-payment') ? undefined : null }}
      />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('more') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  indicator: { width: 56, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
