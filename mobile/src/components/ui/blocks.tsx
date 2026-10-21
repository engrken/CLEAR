import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

// ------------------------------------------------------------------ IconWell
/** An icon on a rounded square or circle (headers, portal cards, results). */
export function IconWell({ icon, bg, fg, size = 56, round }: {
  icon: IconName; bg: string; fg: string; size?: number; round?: boolean;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size / 2 : Math.round(size / 3.1), backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={Math.round(size * 0.5)} tint={fg} />
    </View>
  );
}

/** Decorative circle behind coloured blocks. */
export function Halo({ color, size, style }: { color: string; size: number; style: object }) {
  return <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

// ------------------------------------------------------------------ ColorHeader
type HeaderTone = 'cobalt' | 'sun' | 'ink';

/** The coloured top block on the gateway and sign-in screens, rounded at the bottom. */
export function ColorHeader({ tone, title, body, icon, back = true, brand, children }: {
  tone: HeaderTone;
  title: string;
  body?: ReactNode;
  icon?: IconName;
  back?: boolean;
  /** Shows the CLEAR wordmark row instead of an icon well (gateway). */
  brand?: boolean;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  const t = {
    cobalt: { bg: c.cobalt, fg: '#FFFFFF', muted: c.onCobaltMuted, wellBg: c.sun, wellFg: c.ink, halo: c.cobaltHalo },
    sun: { bg: c.sun, fg: c.ink, muted: '#3A2E05', wellBg: c.inkBlock, wellFg: c.sun, halo: undefined },
    ink: { bg: c.inkBlock, fg: '#FFFFFF', muted: c.tabInactive, wellBg: c.sun, wellFg: c.ink, halo: undefined },
  }[tone];
  return (
    <View style={[styles.header, { backgroundColor: t.bg }]}>
      <SafeAreaView edges={['top']} style={{ gap: 14 }}>
        {t.halo ? <Halo color={t.halo} size={180} style={{ right: -50, top: -40 }} /> : null}
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}>
            <Icon name="back" size={22} tint={t.fg} />
          </Pressable>
        ) : null}
        {brand ? (
          <View style={styles.brand}>
            <IconWell icon="shield" bg={t.wellBg} fg={t.wellFg} size={40} />
            <Text variant="headline" style={{ color: t.fg }}>CLEAR</Text>
          </View>
        ) : icon ? (
          <IconWell icon={icon} bg={t.wellBg} fg={t.wellFg} />
        ) : null}
        <Text variant="display" accessibilityRole="header" style={{ color: t.fg }}>{title}</Text>
        {typeof body === 'string' ? <Text variant="body" style={{ color: t.muted }}>{body}</Text> : body}
        {children}
      </SafeAreaView>
    </View>
  );
}

// ------------------------------------------------------------------ SuccessScreen
/** Full-bleed success: mint for students (proof sent), cobalt for officers (verified). */
export function SuccessScreen({ tone, title, body, refLabel, refValue, actions }: {
  tone: 'mint' | 'cobalt';
  title: string;
  body: string;
  refLabel?: string;
  refValue?: string;
  actions: ReactNode;
}) {
  const { c } = useTheme();
  const mint = tone === 'mint';
  const bg = mint ? c.mint : c.cobalt;
  const fg = mint ? c.ink : '#FFFFFF';
  const muted = mint ? c.mintInk : c.onCobaltMuted;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.success, { backgroundColor: bg }]}>
      {mint ? (
        <>
          <Halo color={c.mintHalo} size={300} style={{ left: -80, top: -80 }} />
          <Halo color={c.sun} size={180} style={{ right: -60, bottom: 140 }} />
        </>
      ) : (
        <>
          <Halo color={c.cobaltHalo} size={300} style={{ right: -90, top: -70 }} />
          <Halo color={c.mint} size={160} style={{ left: -50, bottom: 170 }} />
        </>
      )}
      <View style={styles.successBody} accessibilityLiveRegion="polite">
        <IconWell icon="checkLg" bg={mint ? c.inkBlock : c.sun} fg={mint ? c.mint : c.ink} size={84} round />
        <Text variant="hero" accessibilityRole="header" style={{ color: fg }}>{title}</Text>
        <Text variant="body" style={{ color: muted, fontSize: 17, lineHeight: 25 }}>{body}</Text>
        {refValue ? (
          <View style={styles.refCard}>
            <Text variant="caption" color="inkMuted" style={{ fontFamily: 'Figtree_700Bold', fontSize: 12 }}>{refLabel}</Text>
            <Text variant="headline" selectable style={{ letterSpacing: 0.4 }}>{refValue}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.successActions}>{actions}</View>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------ ResultBlock
/** A full-colour rounded block with a halo (clearance results, the review summary). */
export function ResultBlock({ tone, children, label }: { tone: 'mint' | 'coral' | 'sunTint'; children: ReactNode; label?: string }) {
  const { c } = useTheme();
  const bg = { mint: c.mint, coral: c.coral, sunTint: c.sunTint }[tone] as string;
  const halo = { mint: c.mintHalo, coral: c.coralHalo, sunTint: undefined }[tone];
  return (
    <View accessibilityLabel={label} style={[styles.result, { backgroundColor: bg }]}>
      {halo ? <Halo color={halo} size={220} style={{ right: -60, top: -60 }} /> : null}
      {children}
    </View>
  );
}


const styles = StyleSheet.create({
  header: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  back: { width: 48, height: 48, marginLeft: -12, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  success: { flex: 1, overflow: 'hidden' },
  successBody: { flex: 1, paddingTop: 96, paddingHorizontal: 24, gap: 18 },
  refCard: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 18, gap: 2 },
  successActions: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: 10 },
  result: { borderRadius: radius.lg, paddingVertical: 24, paddingHorizontal: 22, gap: 14, overflow: 'hidden' },
});
