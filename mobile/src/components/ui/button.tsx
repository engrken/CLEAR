import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, size, spacing, type, useTheme } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

/**
 * primary: cobalt fill · ink: dark fill (home and success actions) · secondary: ink outline ·
 * danger: coral-ink fill · light: white fill on a coloured screen · ghost: text only.
 */
type Variant = 'primary' | 'ink' | 'secondary' | 'danger' | 'light' | 'ghost';

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
  /** Text colour for `ghost` on a coloured ground. */
  ghostTint?: string;
  style?: ViewStyle;
};

/** A full pill. One primary per screen. */
export function Button({
  children, onPress, variant = 'primary', size: s = 'md', block, icon, loading, loadingLabel, disabled, ghostTint, style,
}: Props) {
  const { c } = useTheme();
  const palette = {
    primary: { bg: c.cobalt, fg: c.onAccent, border: c.cobalt },
    ink: { bg: c.inkBlock, fg: '#FFFFFF', border: c.inkBlock },
    secondary: { bg: c.ground, fg: c.ink, border: c.ink },
    danger: { bg: c.coralInk, fg: c.onDanger, border: c.coralInk },
    light: { bg: '#FFFFFF', fg: c.ink, border: '#FFFFFF' },
    ghost: { bg: 'transparent', fg: ghostTint ?? c.cobalt, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  const small = s === 'sm';

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
          minHeight: small ? 44 : size.buttonHeight,
          paddingHorizontal: small ? 18 : spacing[6],
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
          <Icon name={icon} size={small ? 16 : 20} tint={palette.fg} />
        ) : null}
        <Text variant="button" style={{ color: palette.fg, fontSize: small ? 14 : type.button.fontSize }}>
          {loading ? loadingLabel ?? 'Working…' : children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  block: { alignSelf: 'stretch' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
