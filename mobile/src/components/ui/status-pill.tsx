import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

// Status strings exactly as the CLEAR database stores them (plus the student-screen words).
const STATUS_TONE: Record<string, Tone> = {
  'valid': 'success', 'verified': 'success', 'cleared': 'success', 'settled': 'success',
  'liquidated': 'success', 'audited & verified': 'success',
  'pending verification': 'warning', 'pending': 'warning', 'unsettled': 'warning', 'active (unliquidated)': 'warning',
  'outstanding': 'warning', 'partial': 'warning',
  'voided': 'danger', 'invalidated': 'danger', 'on hold': 'danger', 'rejected': 'danger', 'not valid': 'danger',
  'remitted': 'accent', 'deposit': 'accent',
  'enrolled': 'info',
  'dropped': 'neutral', 'inactive': 'neutral', 'draft': 'neutral',
};

const TONE_ICON: Record<Tone, IconName> = {
  success: 'checkLg', warning: 'hourglass', danger: 'exclaim', accent: 'wallet', info: 'people', neutral: 'more',
};

export function toneFor(status: string): Tone {
  return STATUS_TONE[status.toLowerCase()] ?? 'neutral';
}

/** Bright Campus tones: sun (pending), mint (done), coral (problem), cobalt tint (info), soft (neutral). */
export function toneColors(tone: Tone): { fg: keyof ColorTokens; bg: keyof ColorTokens } {
  return {
    success: { fg: 'mintInk', bg: 'mint' },
    warning: { fg: 'sunInk', bg: 'sun' },
    danger: { fg: 'coralInk', bg: 'coral' },
    info: { fg: 'cobalt', bg: 'cobaltTint' },
    accent: { fg: 'cobalt', bg: 'cobaltTint' },
    neutral: { fg: 'inkMuted', bg: 'soft' },
  }[tone] as { fg: keyof ColorTokens; bg: keyof ColorTokens };
}

/** A record's status as a word and an icon on a coloured pill: never colour alone. */
export function StatusPill({ status, tone }: { status: string; tone?: Tone }) {
  const { c } = useTheme();
  const t = tone ?? toneFor(status);
  const { fg, bg } = toneColors(t);
  return (
    <View style={[styles.pill, { backgroundColor: c[bg] }]} accessibilityLabel={`Status: ${status}`}>
      <Icon name={TONE_ICON[t]} size={11} color={fg} />
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
    paddingVertical: 5,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: radius.pill,
  },
  label: { fontFamily: 'Figtree_700Bold', fontSize: 12, lineHeight: 16 },
});
