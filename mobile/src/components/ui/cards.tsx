import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { Icon, type IconName } from './icon';
import { Money } from './money';
import { StatusPill, toneColors, type Tone } from './status-pill';
import { Text } from './text';

/** A bordered group on `card`. Separates by hairline, not shadow. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, padded && { padding: spacing[4] }, style]}>
      {children}
    </View>
  );
}

// ------------------------------------------------------------------ StatTile
type StatTileProps = {
  label: string;
  value: number;
  caption?: string;
  icon?: IconName;
  tone?: Extract<Tone, 'accent' | 'success' | 'warning' | 'danger'>;
  onPress?: () => void;
};

/** One KPI on the officer home screen. Tone colours the icon only. */
export function StatTile({ label, value, caption, icon = 'wallet', tone = 'accent', onPress }: StatTileProps) {
  const { c } = useTheme();
  const { fg, bg } = toneColors(tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.stat, { backgroundColor: c.stat, borderColor: pressed ? c.accent : c.border }]}>
      <View style={styles.statHead}>
        <View style={[styles.statIcon, { backgroundColor: c[bg] }]}>
          <Icon name={icon} size={18} color={fg} />
        </View>
        <Text variant="label" color="inkMuted" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Money value={value} />
      {caption ? (
        <Text variant="caption" color="inkMuted" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
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
  first?: boolean;
};

/** One collection, remittance, penalty or advance in a list. */
export function LedgerRow({ title, reference, subtitle, amount, status, onPress, first }: LedgerRowProps) {
  const { c } = useTheme();
  const voided = !!status && /void|invalid|reject/i.test(status);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={onPress ? { color: c.accentTint } : undefined}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.accentTint : c.card },
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
      ]}>
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1}>
          {reference ? <Text variant="code" color="inkMuted">{reference}</Text> : null}
          {reference && subtitle ? ' · ' : null}
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        {amount !== undefined ? <Money value={amount} tone={voided ? 'struck' : 'default'} /> : null}
        {status ? <StatusPill status={status} /> : null}
      </View>
    </Pressable>
  );
}

/** A `Card` that holds LedgerRows edge to edge. */
export function LedgerList({ children }: { children: ReactNode }) {
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {children}
    </Card>
  );
}

// ------------------------------------------------------------------ Banner
type BannerTone = 'info' | 'success' | 'warning' | 'danger';
const BANNER_ICON: Record<BannerTone, IconName> = { info: 'people', success: 'check', warning: 'clock', danger: 'alert' };

/** Inline notice; replaces the web app's SweetAlert popups. */
export function Banner({ tone = 'info', title, children }: { tone?: BannerTone; title?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const { fg, bg } = toneColors(tone);
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      style={[styles.banner, { backgroundColor: c[bg] }]}>
      <Icon name={BANNER_ICON[tone]} size={18} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="bodySm" style={{ fontFamily: 'IBMPlexSans_600SemiBold' }}>{title}</Text> : null}
        {children ? <Text variant="bodySm">{children}</Text> : null}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ TermChip
export function TermChip({ ay, term, onPress }: { ay: string; term: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Viewing ${ay}, ${term}. Change term`}
      hitSlop={6}
      style={[styles.chip, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <Text variant="caption">{ay}</Text>
      <View style={[styles.dot, { backgroundColor: c.accent }]} />
      <Text variant="caption">{term}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  stat: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[2],
  },
  statHead: { gap: spacing[2] },
  statIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: 72,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  rowEnd: { alignItems: 'flex-end', gap: spacing[1] },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[2],
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
