import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type ApiError, type FeeItem } from '@/api';
import { BackHeader, Banner, Button, Icon, ProofUpload, Screen, SuccessScreen, Text, TextField, type PickedFile } from '@/components/ui';
import { formatPeso } from '@/lib/money';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

// Values exactly as the API expects; the pills show a shorter word for the bank.
const CHANNELS = ['GCash', 'Maya', 'Bank transfer'] as const;
const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = { GCash: 'GCash', Maya: 'Maya', 'Bank transfer': 'Bank' };
const MAX_BYTES = 5 * 1024 * 1024; // server limit (413 payload_too_large above this)
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']; // what the server accepts (checked by file contents)

/** A student's online remittance: channel, reference, fee item and receipt. */
export default function SubmitProof() {
  const params = useLocalSearchParams<{ dept: string; studentId?: string }>();
  const dept = params.dept;
  const router = useRouter();
  const fees = useAsync<FeeItem[]>(() => api.listFeeItems(dept), dept);

  const [studentId, setStudentId] = useState(params.studentId ?? '');
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('GCash');
  const [reference, setReference] = useState('');
  const [feeId, setFeeId] = useState<string>();
  const [file, setFile] = useState<PickedFile>();
  const [fileError, setFileError] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();

  const fee = fees.data?.find((f) => f.id === feeId);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled) return;
    const a = res.assets[0];
    const mimeType = a.mimeType ?? 'image/jpeg';
    if (!ACCEPTED.includes(mimeType)) {
      setFile(undefined);
      setFileError('Use a JPG, PNG or WebP screenshot. HEIC photos must be converted first.');
      return;
    }
    if (a.fileSize && a.fileSize > MAX_BYTES) {
      setFile(undefined);
      setFileError('This file is over 5 MB. Choose a smaller screenshot.');
      return;
    }
    setFileError(undefined);
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    setFile({ uri: a.uri, name: a.fileName ?? `receipt.${ext}`, mimeType, sizeBytes: a.fileSize });
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!studentId.trim()) e.studentId = 'Enter your student ID.';
    if (!reference.trim()) e.reference = 'Enter the reference number shown on your receipt.';
    if (!fee) e.fee = 'Choose what you paid for.';
    setErrors(e);
    if (!file) setFileError('Add a screenshot of your receipt.');
    if (Object.keys(e).length || !file || !fee) return;

    setBusy(true);
    try {
      const { submissionId } = await api.submitProof(dept, {
        studentId, paymentChannel: channel, referenceNumber: reference.trim(),
        amountCentavos: fee.amountCentavos, itemDescription: fee.name,
        file: { uri: file.uri, name: file.name, mimeType: file.mimeType },
      });
      setDone(submissionId);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'payload_too_large') setFileError(e.message);
      else if (e.code === 'invalid_student') setErrors({ studentId: e.message });
      // period_closed, overpayment, rate_limited and the rest: the server's message, at the top.
      else setErrors({ form: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SuccessScreen
        tone="mint"
        title="Receipt sent!"
        body="An officer will check it and email your official receipt. Your clearance updates once it’s verified."
        refLabel="Keep this reference"
        refValue={done}
        actions={<Button block variant="ink" onPress={() => router.back()}>Done</Button>}
      />
    );
  }

  return (
    <Screen
      header={<BackHeader title="Send your receipt" />}
      footer={
        <Button block onPress={submit} loading={busy} loadingLabel="Uploading receipt…">
          Send for checking
        </Button>
      }>
      {errors.form ? <Banner tone="danger" title="Couldn’t submit">{errors.form}</Banner> : null}
      <TextField
        label="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        placeholder="Your student ID"
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.studentId}
      />

      <View style={styles.group}>
        <Text variant="label" style={styles.legend}>Paid through</Text>
        <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Paid through">
          {CHANNELS.map((ch) => (
            <ChannelPill
              key={ch}
              value={ch}
              label={CHANNEL_LABEL[ch]}
              selected={channel === ch}
              onPress={() => setChannel(ch)}
              grow={ch === 'Bank transfer' ? 1.2 : 1}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Reference number"
        value={reference}
        onChangeText={setReference}
        placeholder="e.g. 7731 0042 1188"
        mono
        autoCorrect={false}
        helper="The transaction or reference number printed on the receipt."
        error={errors.reference}
      />

      <View style={styles.group}>
        <Text variant="label" style={styles.legend}>What you paid for</Text>
        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="What you paid for">
          {fees.data?.map((f) => (
            <FeeRow
              key={f.id}
              label={f.name}
              amount={formatPeso(f.amountCentavos / 100)}
              selected={feeId === f.id}
              onPress={() => setFeeId(f.id)}
            />
          ))}
        </View>
        {errors.fee ? (
          <View style={styles.help}>
            <Icon name="alert" size={14} color="dangerInk" />
            <Text variant="bodySm" color="dangerInk" style={{ flex: 1 }}>{errors.fee}</Text>
          </View>
        ) : null}
      </View>

      <ProofUpload file={file} error={fileError} onPick={pick} onRemove={() => setFile(undefined)} />
    </Screen>
  );
}

/** A channel as a segmented pill; selected is cobalt with a tick. `value` is what the API stores. */
function ChannelPill({ value, label, selected, onPress, grow }: {
  value: string; label: string; selected: boolean; onPress: () => void; grow: number;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={value}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.pill,
        { flexGrow: grow, backgroundColor: selected ? c.cobalt : c.soft, opacity: pressed && !selected ? 0.8 : 1 },
      ]}>
      {selected ? <Icon name="check" size={16} color="onAccent" /> : null}
      <Text variant="bodyStrong" color={selected ? 'onAccent' : 'ink'} numberOfLines={1} style={{ fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A fee item as a selectable row; selected is ink with white text and a tick. */
function FeeRow({ label, amount, selected, onPress }: { label: string; amount: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.fee,
        { backgroundColor: selected ? c.inkBlock : c.soft, opacity: pressed && !selected ? 0.8 : 1 },
      ]}>
      {selected ? <Icon name="check" size={18} color="onAccent" /> : null}
      <Text variant="bodyStrong" color={selected ? 'onAccent' : 'ink'} style={{ flex: 1, fontSize: 15 }}>{label}</Text>
      <Text variant="figureSm" color={selected ? 'onAccent' : 'ink'} style={{ fontFamily: 'BricolageGrotesque_800ExtraBold' }}>
        {amount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[2] },
  legend: { paddingLeft: 6 },
  // No flexWrap: with wrapping, Yoga reserved height for phantom extra lines and
  // left a blank gap under the channel buttons on Android.
  segment: { flexDirection: 'row', gap: spacing[2] },
  pill: {
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: spacing[2],
    borderRadius: 999,
  },
  fee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  help: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
});
