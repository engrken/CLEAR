import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

// Status strings exactly as the CLEAR database stores them.
const STATUS_TONE: Record<string, Tone> = {
  'valid': 'success', 'verified': 'success', 'cleared': 'success', 'settled': 'success',
  'liquidated': 'success', 'audited & verified': 'success',
  'pending verification': 'warning', 'unsettled': 'warning', 'active (unliquidated)': 'warning',
  'outstanding': 'warning', 'partial': 'warning',
  'voided': 'danger', 'invalidated': 'danger', 'on hold': 'danger', 'rejected': 'danger',
  'remitted': 'accent', 'deposit': 'accent',
  'enrolled': 'info',
  'dropped': 'neutral', 'inactive': 'neutral', 'draft': 'neutral',
};

const TONE_ICON: Record<Tone, IconName> = {
  success: 'check', warning: 'clock', danger: 'alert', accent: 'wallet', info: 'people', neutral: 'more',
};

export function toneFor(status: string): Tone {
  return STATUS_TONE[status.toLowerCase()] ?? 'neutral';
}

export function toneColors(tone: Tone): { fg: keyof ColorTokens; bg: keyof ColorTokens } {
  return {
    success: { fg: 'successInk', bg: 'successTint' },
    warning: { fg: 'warningInk', bg: 'warningTint' },
    danger: { fg: 'dangerInk', bg: 'dangerTint' },
    info: { fg: 'infoInk', bg: 'infoTint' },
    accent: { fg: 'accentInk', bg: 'accentTint' },
    neutral: { fg: 'neutralInk', bg: 'neutralTint' },
  }[tone] as { fg: keyof ColorTokens; bg: keyof ColorTokens };
}

/** A record's status as a word and an icon on a tinted ground. */
export function StatusPill({ status, tone }: { status: string; tone?: Tone }) {
  const { c } = useTheme();
  const t = tone ?? toneFor(status);
  const { fg, bg } = toneColors(t);
  return (
    <View style={[styles.pill, { backgroundColor: c[bg] }]} accessibilityLabel={`Status: ${status}`}>
      <Icon name={TONE_ICON[t]} size={12} color={fg} />
      <Text variant="caption" color={fg} style={styles.label}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.pill,
  },
  label: { fontFamily: 'IBMPlexSans_600SemiBold' },
});
