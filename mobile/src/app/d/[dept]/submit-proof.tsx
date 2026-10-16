import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type FeeItem } from '@/api';
import { Banner, Button, ProofUpload, Screen, Text, TextField, type PickedFile } from '@/components/ui';
import { formatPeso } from '@/lib/money';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

const CHANNELS = ['GCash', 'Maya', 'Bank transfer'] as const;
const MAX_BYTES = 5 * 1024 * 1024;

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
    if (a.fileSize && a.fileSize > MAX_BYTES) {
      setFile(undefined);
      setFileError('This file is over 5 MB. Choose a smaller screenshot.');
      return;
    }
    setFileError(undefined);
    setFile({ uri: a.uri, name: a.fileName ?? 'receipt.jpg', sizeBytes: a.fileSize });
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
        amountCentavos: fee.amountCentavos, itemDescription: fee.name, fileUri: file.uri,
      });
      setDone(submissionId);
    } catch (err) {
      setErrors({ studentId: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen edges={['bottom']} footer={<Button block onPress={() => router.back()}>Done</Button>}>
        <Banner tone="success" title="Payment proof submitted">
          An officer will verify it and email your official receipt. Keep reference {done} for follow-ups.
        </Banner>
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button block icon="upload" onPress={submit} loading={busy} loadingLabel="Uploading receipt…">
          Submit payment proof
        </Button>
      }>
      <TextField
        label="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        placeholder="DEV-2026-0001"
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.studentId}
      />

      <View style={{ gap: spacing[2] }}>
        <Text variant="label" color="inkMuted">Paid through</Text>
        <View style={styles.segment}>
          {CHANNELS.map((ch) => (
            <Option key={ch} label={ch} selected={channel === ch} onPress={() => setChannel(ch)} />
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

      <View style={{ gap: spacing[2] }}>
        <Text variant="label" color="inkMuted">What you paid for</Text>
        <View style={{ gap: spacing[2] }}>
          {fees.data?.map((f) => (
            <Option
              key={f.id}
              label={f.name}
              detail={formatPeso(f.amountCentavos / 100)}
              selected={feeId === f.id}
              onPress={() => setFeeId(f.id)}
            />
          ))}
        </View>
        {errors.fee ? <Text variant="bodySm" color="dangerInk">{errors.fee}</Text> : null}
      </View>

      <View style={{ gap: spacing[2] }}>
        <Text variant="label" color="inkMuted">Receipt screenshot</Text>
        <ProofUpload file={file} error={fileError} onPick={pick} onRemove={() => setFile(undefined)} />
      </View>
    </Screen>
  );
}

function Option({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.option,
        { backgroundColor: selected ? c.accentTint : c.card, borderColor: selected ? c.accent : c.borderStrong },
      ]}>
      <Text variant="bodyStrong" color={selected ? 'accentInk' : 'ink'} style={{ flex: 1 }}>{label}</Text>
      {detail ? <Text variant="figureSm" color={selected ? 'accentInk' : 'inkMuted'}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  option: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[4],
    borderWidth: 1.5,
    borderRadius: radius.sm,
  },
});
