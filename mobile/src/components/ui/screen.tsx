import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { radius, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon } from './icon';
import { Text } from './text';

type Props = {
  children: ReactNode;
  /** Above the scroll area: a BackHeader or ColorHeader. */
  header?: ReactNode;
  /** Pinned below the scroll area, above the safe-area inset: the primary action. */
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Screen ground; coloured success screens set it. */
  ground?: keyof ColorTokens;
  /** Extra bottom padding, e.g. room for the floating tab bar. */
  bottomInset?: number;
};

/** A screen with the 16px gutter and safe-area handling. */
export function Screen({
  children, header, footer, scroll = true, edges = ['top', 'bottom'], contentStyle, ground = 'canvas', bottomInset = 0,
}: Props) {
  const { c } = useTheme();
  const body = [styles.content, { paddingBottom: spacing[4] + bottomInset }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: c[ground] }]}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[body, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline">{title}</Text>
      {action}
    </View>
  );
}

/** Back arrow, optional title, optional right-hand element (usually the department chip). */
export function BackHeader({ title, right, onBack, tint }: {
  title?: string; right?: ReactNode; onBack?: () => void; tint?: string;
}) {
  const { c } = useTheme();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.header}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={4} style={styles.back}>
        <Icon name="back" size={22} tint={tint ?? c.ink} />
      </Pressable>
      {title ? (
        <Text variant="headline" numberOfLines={1} style={{ flex: 1, color: tint ?? c.ink }}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}

/** The department name as a cobalt-tint chip. */
export function OrgChip({ name }: { name: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.orgChip, { backgroundColor: c.cobaltTint }]}>
      <Text variant="caption" color="cobalt" numberOfLines={1} style={{ fontFamily: 'Figtree_700Bold' }}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  footer: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[4], gap: 10 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], paddingHorizontal: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8, paddingLeft: 4, paddingRight: 12, paddingBottom: 4 },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  orgChip: { maxWidth: 220, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill },
});
