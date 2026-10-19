import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { radius, spacing, useTheme } from '@/theme';
import { IconWell, ResultBlock } from './blocks';
import { TermChip } from './cards';
import { Icon } from './icon';
import { Money } from './money';
import { Text } from './text';

// ------------------------------------------------------------------ ClearanceCard
/** One unpaid item on an on-hold clearance, in pesos. `period` marks arrears from an earlier term. */
export type UnpaidLine = { label: string; amount: number; period?: string };

type ClearanceProps = {
  /** Kept for API compatibility; the department shows in the screen header now. */
  orgName?: string;
  studentName: string;
  studentId: string;
  status: 'cleared' | 'hold';
  /** Pesos due; null on public lookups, which show status only. */
  outstanding?: number | null;
  /** Signed, organization-bound token from the API. Never built on the device. */
  qrToken?: string;
  ay: string;
  term: string;
  /** What is still unpaid, when the server lists it (officer lookups). */
  unpaidItems?: UnpaidLine[];
};

/** The lookup result as a full-colour block: mint when cleared (with the QR), coral when on hold. */
export function ClearanceCard({ studentName, studentId, status, outstanding = null, qrToken, ay, term, unpaidItems }: ClearanceProps) {
  const { c } = useTheme();
  const cleared = status === 'cleared';
  const items = unpaidItems?.length ? unpaidItems : null;

  if (cleared) {
    return (
      <ResultBlock tone="mint" label="Clearance result: cleared">
        <IconWell icon="checkLg" bg={c.inkBlock} fg={c.mint} size={64} round />
        <View style={{ gap: 6 }}>
          <Text variant="display" accessibilityRole="header" style={{ fontSize: 40, lineHeight: 42 }}>
            {`You're cleared, ${studentName}!`}
          </Text>
          <Text variant="bodyStrong" color="mintInk" style={{ fontSize: 15 }}>{studentId}</Text>
        </View>
        <View style={styles.inset}>
          <View style={[styles.qr, { backgroundColor: c.qrGround }]} accessible accessibilityRole="image" accessibilityLabel="Clearance QR code">
            {qrToken ? <QRCode value={qrToken} size={112} color={c.qrInk} backgroundColor={c.qrGround} /> : null}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="headline" style={{ fontSize: 18, lineHeight: 23 }}>Show this to your adviser</Text>
            <Text variant="bodySm" color="inkMuted">{"It's checked live against the department ledger."}</Text>
          </View>
        </View>
        <TermChip ay={ay} term={term} onColor />
      </ResultBlock>
    );
  }

  return (
    <ResultBlock tone="coral" label="Clearance result: on hold">
      <IconWell icon="exclaim" bg={c.inkBlock} fg={c.coral} size={64} round />
      <Text variant="display" accessibilityRole="header">{`Almost there, ${studentName}`}</Text>
      <Text variant="bodyStrong" color="coralInk" style={{ fontSize: 15 }}>{`${studentId} · On hold`}</Text>
      {outstanding === null ? (
        <Text variant="body" color="coralDeep">
          {"You still have dues to settle. Ask your treasurer for the amount, or send a GCash or Maya receipt if you've already paid."}
        </Text>
      ) : (
        <View style={{ gap: 2 }}>
          <Text variant="label" color="coralDeep">Outstanding balance</Text>
          <Money value={outstanding} size="xl" tone="danger" />
        </View>
      )}
      {items ? (
        <View style={[styles.inset, styles.items]} accessibilityLabel="Unpaid items">
          {items.map((it, i) => (
            <View key={`${it.label}-${it.period ?? ''}-${i}`} style={styles.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" style={{ fontSize: 15 }}>{it.label}</Text>
                {it.period ? <Text variant="caption" color="inkMuted">{it.period}</Text> : null}
              </View>
              <Money value={it.amount} size="sm" />
            </View>
          ))}
        </View>
      ) : null}
      <TermChip ay={ay} term={term} onColor />
    </ResultBlock>
  );
}

// ------------------------------------------------------------------ ProofUpload
export type PickedFile = { uri: string; name: string; mimeType: string; sizeBytes?: number };

type UploadProps = {
  file?: PickedFile;
  progress?: number;
  error?: string;
  onPick: () => void;
  onRemove: () => void;
};

const mb = (b?: number) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '');

/** A student's GCash or Maya receipt for an online remittance: a dashed cobalt drop area. */
export function ProofUpload({ file, progress, error, onPick, onRemove }: UploadProps) {
  const { c } = useTheme();

  if (!file) {
    return (
      <Pressable
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel="Add receipt screenshot"
        style={({ pressed }) => [
          styles.empty,
          { backgroundColor: error ? c.coral : pressed ? c.soft : c.cobaltTint, borderColor: error ? c.coralInk : c.cobalt },
        ]}>
        <IconWell icon="plus" bg={c.cobalt} fg="#FFFFFF" size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Add receipt screenshot</Text>
          <Text variant="caption" color={error ? 'dangerInk' : 'inkMuted'}>
            {error ?? 'JPG, PNG or WebP, up to 5 MB. Hide your number and balance first.'}
          </Text>
        </View>
      </Pressable>
    );
  }

  const uploading = progress !== undefined && progress < 100;
  return (
    <View style={[styles.picked, { backgroundColor: error ? c.coral : c.soft }]}>
      <Image source={{ uri: file.uri }} alt="Selected receipt" style={[styles.thumb, { backgroundColor: c.cobaltTint }]} contentFit="cover" />
      <View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
        <Text variant="bodyStrong" numberOfLines={1}>{file.name}</Text>
        {uploading ? (
          <View style={[styles.track, { backgroundColor: c.ground }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }}>
            <View style={[styles.bar, { width: `${progress}%`, backgroundColor: c.cobalt }]} />
          </View>
        ) : (
          <Text variant="bodySm" color={error ? 'dangerInk' : 'inkMuted'} numberOfLines={2}>
            {error ?? `${mb(file.sizeBytes)} · Ready to send`}
          </Text>
        )}
      </View>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove file" style={styles.remove}>
        <Icon name="close" size={18} color="inkMuted" />
      </Pressable>
    </View>
  );
}

// ------------------------------------------------------------------ OrgMark
/** A department logo on a rounded square, falling back to initials on cobalt (or sun). */
export function OrgMark({ name, logoUri, size = 64, tone = 'cobalt' }: {
  name: string; logoUri?: string | null; size?: number; tone?: 'cobalt' | 'sun';
}) {
  const { c } = useTheme();
  const words = name.split(/[\s–-]+/).filter((w) => /^[A-Za-z]/.test(w));
  const caps = words.filter((w) => /^[A-Z]/.test(w));
  const initials = (caps.length ? caps : words).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const bg = tone === 'sun' ? c.sun : c.cobalt;
  const fg = tone === 'sun' ? c.ink : '#FFFFFF';
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: Math.round(size / 3), backgroundColor: logoUri ? c.soft : bg }]}>
      {logoUri ? (
        <Image source={{ uri: logoUri }} alt={`${name} logo`} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text variant="headline" style={{ color: fg, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) }}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inset: { backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  qr: { width: 120, height: 120, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  items: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 24,
  },
  picked: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: 12, borderRadius: radius.md },
  thumb: { width: 48, height: 48, borderRadius: 14 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  remove: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
});
