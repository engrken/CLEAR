import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, size, spacing, type, useTheme } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  children: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  block?: boolean;
  icon?: IconName;
  loading?: boolean;
  /** What is happening while loading, e.g. "Sending code…". */
  loadingLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

/** Thumb-sized action. One primary per screen. */
export function Button({
  children, onPress, variant = 'primary', size: s = 'md', block, icon, loading, loadingLabel, disabled, style,
}: Props) {
  const { c } = useTheme();
  const palette = {
    primary: { bg: c.accentFill, fg: c.onAccent, border: c.accentFill },
    secondary: { bg: 'transparent', fg: c.ink, border: c.borderStrong },
    danger: { bg: c.dangerFill, fg: c.onDanger, border: c.dangerFill },
    ghost: { bg: 'transparent', fg: c.accentInk, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      android_ripple={variant === 'ghost' ? undefined : { color: 'rgba(255,255,255,0.18)' }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: s === 'sm' ? size.touchMin : size.buttonHeight,
          paddingHorizontal: s === 'sm' || variant === 'ghost' ? spacing[4] : spacing[6],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.45 : pressed && Platform.OS === 'ios' ? 0.7 : 1,
        },
        block && styles.block,
        style,
      ]}>
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={palette.fg} size="small" />
        ) : icon ? (
          <Icon name={icon} size={18} tint={palette.fg} />
        ) : null}
        <Text variant="button" style={{ color: palette.fg, fontSize: s === 'sm' ? 14 : type.button.fontSize }}>
          {loading ? loadingLabel ?? 'Working…' : children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  block: { alignSelf: 'stretch' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
