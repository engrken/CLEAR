import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';
import { Text } from './text';

type Props = {
  children: ReactNode;
  /** Pinned below the scroll area, above the safe-area inset: the primary action. */
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
};

/** A screen on `canvas` with the 16px gutter and safe-area handling. */
export function Screen({ children, footer, scroll = true, edges = ['top', 'bottom'], contentStyle }: Props) {
  const { c } = useTheme();
  const body = [styles.content, contentStyle];
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: c.canvas }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
          {children}
        </ScrollView>
      ) : (
        <View style={[body, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.canvas }]}>{footer}</View> : null}
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing[4], gap: spacing[6], maxWidth: 640, width: '100%', alignSelf: 'center' },
  footer: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderTopWidth: StyleSheet.hairlineWidth },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
});
