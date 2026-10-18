import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { radius, spacing, useTheme } from '@/theme';
import { Card, TermChip } from './cards';
import { Icon } from './icon';
import { Money } from './money';
import { StatusPill } from './status-pill';
import { Text } from './text';

// ------------------------------------------------------------------ ClearanceCard
/** One unpaid item on an on-hold clearance, in pesos. `period` marks arrears from an earlier term. */
export type UnpaidLine = { label: string; amount: number; period?: string };

type ClearanceProps = {
  orgName: string;
  studentName: string;
  studentId: string;
  status: 'cleared' | 'hold';
  /** Pesos due; null on public lookups, which show status only. */
  outstanding?: number | null;
  /** Signed, organization-bound token from the API. Never built on the device. */
  qrToken?: string;
  ay: string;
  term: string;
  /** What is still unpaid, when the server lists it. */
  unpaidItems?: UnpaidLine[];
};

/** What a student sees after a clearance lookup. Shows status and total only. */
export function ClearanceCard({ orgName, studentName, studentId, status, outstanding = null, qrToken, ay, term, unpaidItems }: ClearanceProps) {
  const { c } = useTheme();
  const cleared = status === 'cleared';
  const items = unpaidItems?.length ? unpaidItems : null;
  return (
    <Card style={{ gap: spacing[4] }}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color="inkMuted" numberOfLines={1}>{orgName}</Text>
          <Text variant="title">{studentName}</Text>
          <Text variant="code" color="inkMuted">{studentId}</Text>
        </View>
        <StatusPill status={cleared ? 'Cleared' : 'On Hold'} />
      </View>

      {cleared ? (
        <View style={styles.qrRow}>
          <View
            style={[styles.qr, { backgroundColor: c.qrGround, borderColor: c.border }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Clearance QR code">
            {qrToken ? <QRCode value={qrToken} size={104} color={c.qrInk} backgroundColor={c.qrGround} /> : null}
          </View>
          <Text variant="bodySm" color="inkMuted" style={{ flex: 1 }}>
            Show this code to your adviser. It is checked live against the department ledger.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing[1] }}>
          <Text variant="label" color="inkMuted">Outstanding balance</Text>
          {outstanding === null ? (
            <Text variant="bodySm" color="inkMuted">
              {items
                ? 'You have dues to settle. Pay your treasurer, or upload a GCash or Maya receipt below.'
                : 'You have dues to settle. Ask your treasurer for the amount, or upload a GCash or Maya receipt below.'}
            </Text>
          ) : (
            <>
              <Money value={outstanding} size="xl" tone="danger" />
              <Text variant="bodySm" color="inkMuted">
                Settle this with your treasurer, or upload a GCash or Maya receipt below.
              </Text>
            </>
          )}
          {items ? (
            <View style={[styles.items, { borderTopColor: c.border }]} accessibilityLabel="Unpaid items">
              {items.map((it, i) => (
                <View key={`${it.label}-${it.period ?? ''}-${i}`} style={styles.item}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodySm">{it.label}</Text>
                    {it.period ? <Text variant="caption" color="inkMuted">{it.period}</Text> : null}
                  </View>
                  <Money value={it.amount} size="sm" />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.foot, { borderTopColor: c.border }]}>
        <TermChip ay={ay} term={term} />
      </View>
    </Card>
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

/** A student's GCash or Maya receipt for an online remittance. */
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
          { backgroundColor: pressed ? c.accentTint : c.card, borderColor: error ? c.dangerInk : c.borderStrong },
        ]}>
        <Icon name="upload" size={28} color="accentInk" />
        <Text variant="bodyStrong">Add receipt screenshot</Text>
        <Text variant="bodySm" color={error ? 'dangerInk' : 'inkMuted'} style={{ textAlign: 'center' }}>
          {error ?? 'JPG or PNG, up to 4 MB. Hide your mobile number and wallet balance first.'}
        </Text>
      </Pressable>
    );
  }

  const uploading = progress !== undefined && progress < 100;
  return (
    <View style={[styles.picked, { backgroundColor: c.card, borderColor: error ? c.dangerInk : c.borderStrong }]}>
      <Image source={{ uri: file.uri }} alt="Selected receipt" style={[styles.thumb, { backgroundColor: c.accentTint }]} contentFit="cover" />
      <View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
        <Text variant="bodyStrong" numberOfLines={1}>{file.name}</Text>
        {uploading ? (
          <View
            style={[styles.track, { backgroundColor: c.neutralTint }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progress }}>
            <View style={[styles.bar, { width: `${progress}%`, backgroundColor: c.accent }]} />
          </View>
        ) : (
          <Text variant="bodySm" color={error ? 'dangerInk' : 'inkMuted'} numberOfLines={2}>
            {error ?? `${mb(file.sizeBytes)} · Ready to submit`}
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
/** A department logo in a circle, falling back to initials on accent-tint. */
export function OrgMark({ name, logoUri, size = 64 }: { name: string; logoUri?: string | null; size?: number }) {
  const { c } = useTheme();
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentTint }]}>
      {logoUri ? (
        <Image source={{ uri: logoUri }} alt={`${name} logo`} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text variant="headline" color="accentInk">{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  qr: { width: 120, height: 120, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[3] },
  items: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing[2], paddingTop: spacing[3], gap: spacing[2] },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  empty: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  remove: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
