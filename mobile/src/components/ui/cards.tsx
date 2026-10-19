import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './icon';
import { Money } from './money';
import { StatusPill, toneColors, toneFor, type Tone } from './status-pill';
import { Text } from './text';

/** A filled block on `soft` (Bright Campus cards have no borders). */
export function Card({ children, style, padded = true, tone = 'soft' }: {
  children: ReactNode; style?: ViewStyle; padded?: boolean; tone?: keyof ColorTokens;
}) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c[tone] }, padded && { padding: 20 }, style]}>{children}</View>;
}

// ------------------------------------------------------------------ HeroStat
/** The cobalt "cash on hand" block on the officer home screen. */
export function HeroStat({ label, value, caption }: { label: string; value: number; caption?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: c.cobalt }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="bodySm" style={{ color: c.onCobaltMuted, fontFamily: 'Figtree_600SemiBold' }}>{label}</Text>
      <Money value={value} size="xl" tone="inverse" />
      {caption ? <Text variant="caption" style={{ color: c.onCobaltMuted }}>{caption}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------ ColorTile
const TILE: Record<'mint' | 'sun' | 'coral', { bg: keyof ColorTokens; fg: keyof ColorTokens }> = {
  mint: { bg: 'mint', fg: 'mintInk' },
  sun: { bg: 'sun', fg: 'sunInk' },
  coral: { bg: 'coral', fg: 'coralInk' },
};

/** A small coloured KPI tile in whole pesos (Safekeeping, Pending, Owed). */
export function ColorTile({ label, value, tone, onPress, accessibilityLabel, accessibilityHint }: {
  label: string; value: number; tone: keyof typeof TILE; onPress?: () => void;
  /** Full spoken text, e.g. "Pending, 2 proofs to verify, ₱550". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
  const t = TILE[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.tile, { backgroundColor: c[t.bg], opacity: pressed ? 0.85 : 1 }]}>
      <Text variant="caption" color={t.fg} numberOfLines={1} style={{ fontFamily: 'Figtree_700Bold', fontSize: 12 }}>
        {label}
      </Text>
      <Money value={value} whole />
    </Pressable>
  );
}

// ------------------------------------------------------------------ Avatar
const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '·';

/** Initials in a circle, coloured by the row's tone. */
export function Avatar({ name, tone = 'success', size = 42 }: { name: string; tone?: Tone; size?: number }) {
  const { c } = useTheme();
  const { fg, bg } = toneColors(tone);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c[bg] }]}>
      <Text variant="caption" color={fg} style={{ fontFamily: 'Figtree_700Bold', fontSize: size > 44 ? 16 : 14 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ LedgerRow
type LedgerRowProps = {
  title: string;
  reference?: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  onPress?: () => void;
  /** Kept for API compatibility with 1.0.x lists; rows are separate blocks now. */
  first?: boolean;
};

/** One collection, remittance, penalty or advance: a rounded row with an initials avatar; pending rows are sun. */
export function LedgerRow({ title, reference, subtitle, amount, status, onPress }: LedgerRowProps) {
  const { c } = useTheme();
  const tone = status ? toneFor(status) : 'success';
  const pending = tone === 'warning';
  const voided = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pending ? c.sunTint : c.soft, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Avatar name={title} tone={pending ? 'warning' : voided ? 'danger' : 'success'} />
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySm" color={pending ? 'sunInkSoft' : 'inkMuted'} numberOfLines={1}>
          {reference ? <Text variant="code" color={pending ? 'sunInkSoft' : 'inkMuted'}>{reference}</Text> : null}
          {reference && subtitle ? ' · ' : null}
          {subtitle}
        </Text>
        {status && (pending || voided) ? <StatusPill status={status} /> : null}
      </View>
      {amount !== undefined ? <Money value={amount} tone={voided ? 'struck' : 'default'} /> : null}
    </Pressable>
  );
}

/** LedgerRows stacked with an 8px gap. */
export function LedgerList({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

// ------------------------------------------------------------------ Banner
type BannerTone = 'info' | 'success' | 'warning' | 'danger';
const BANNER_ICON: Record<BannerTone, IconName> = { info: 'people', success: 'checkLg', warning: 'hourglass', danger: 'exclaim' };
const BANNER: Record<BannerTone, { bg: keyof ColorTokens; fg: keyof ColorTokens; well: keyof ColorTokens }> = {
  info: { bg: 'cobaltTint', fg: 'cobalt', well: 'cobalt' },
  success: { bg: 'mint', fg: 'mintInk', well: 'inkBlock' },
  warning: { bg: 'sunTint', fg: 'sunInk', well: 'sun' },
  danger: { bg: 'coral', fg: 'coralDeep', well: 'inkBlock' },
};

/** Inline notice on a tinted block; replaces the web app's SweetAlert popups. */
export function Banner({ tone = 'info', title, children }: { tone?: BannerTone; title?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const b = BANNER[tone];
  const wellInk = b.well === 'inkBlock' ? c[b.bg] : b.well === 'cobalt' ? '#FFFFFF' : c.ink;
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : 'summary'} style={[styles.banner, { backgroundColor: c[b.bg] }]}>
      <View style={[styles.well, { backgroundColor: c[b.well] }]}>
        <Icon name={BANNER_ICON[tone]} size={16} tint={wellInk} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="bodyStrong" color={b.fg}>{title}</Text> : null}
        {children ? <Text variant="bodySm" color={b.fg}>{children}</Text> : null}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ TermChip
/**
 * The academic year (dark pill) and term (light pill), shown as given:
 * "1st Sem", "3rd Trimester", "Full Year" and so on. `onColor` puts the term pill on white for coloured blocks.
 */
export function TermChip({ ay, term, onPress, onColor }: { ay: string; term: string; onPress?: () => void; onColor?: boolean }) {
  const { c } = useTheme();
  const body = (
    <View style={styles.chips}>
      <View style={[styles.chip, { backgroundColor: c.inkBlock }]}>
        <Text variant="caption" style={styles.chipText} color="onAccent">{ay}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: onColor ? '#FFFFFF' : c.soft }]}>
        <Text variant="caption" style={styles.chipText}>{term}</Text>
        {onPress ? <Icon name="chevronDown" size={10} color="ink" /> : null}
      </View>
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={`${ay}, ${term}`}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Viewing ${ay}, ${term}. Change term`} hitSlop={6}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
  hero: { borderRadius: radius.lg, paddingVertical: 20, paddingHorizontal: 22, gap: 4 },
  tile: { flex: 1, minWidth: 0, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
  avatar: { alignItems: 'center', justifyContent: 'center', flex: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  list: { gap: spacing[2] },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  well: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill },
  chipText: { fontFamily: 'Figtree_700Bold', fontSize: 13 },
});
