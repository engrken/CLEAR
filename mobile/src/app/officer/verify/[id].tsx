import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api, type ApiError, type RemittanceDetail } from '@/api';
import { Banner, Button, Card, Icon, Money, Screen, StatusPill, Text, TextField } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

type Outcome = { tone: 'success' | 'warning'; title: string; body: string };

/** One online remittance: compare the receipt, then verify with an OR number or invalidate. */
export default function ReviewRemittance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useOfficerSession();
  const router = useRouter();
  const { c } = useTheme();
  const entry = useAsync<RemittanceDetail>(() => api.getRemittance(session, id), `${id}:${session.token}`);

  const [orNumber, setOrNumber] = useState('');
  const [orError, setOrError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState<'verify' | 'invalidate'>();
  const [confirmInvalidate, setConfirmInvalidate] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();

  const verify = async () => {
    if (!orNumber.trim()) return setOrError('Enter the OR number from the receipt booklet.');
    setBusy('verify');
    setFormError(undefined);
    try {
      const r = await api.verifyRemittance(session, id, { orNumber });
      setOutcome({ tone: 'success', title: 'Verified', body: `${r.orNumber} was emailed to the student.` });
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'duplicate_or' || e.code === 'invalid') setOrError(e.message);
      else setFormError(e.message);
    } finally {
      setBusy(undefined);
    }
  };

  const invalidate = async () => {
    setBusy('invalidate');
    setFormError(undefined);
    try {
      await api.invalidateRemittance(session, id);
      setOutcome({ tone: 'warning', title: 'Invalidated', body: 'The student will be asked to resubmit.' });
    } catch (err) {
      setFormError((err as ApiError).message);
      setConfirmInvalidate(false);
    } finally {
      setBusy(undefined);
    }
  };

  const l = entry.data;
  if (!l) {
    return (
      <Screen>
        {entry.error ? (
          <Banner tone="danger" title="Couldn’t open this remittance">{entry.error.message}</Banner>
        ) : (
          <ActivityIndicator color={c.accent} />
        )}
      </Screen>
    );
  }

  if (outcome) {
    return (
      <Screen edges={['bottom']} footer={<Button block onPress={() => router.back()}>Back to queue</Button>}>
        <Banner tone={outcome.tone} title={outcome.title}>{outcome.body}</Banner>
      </Screen>
    );
  }

  const reviewed = l.status !== 'Pending Verification';

  return (
    <Screen
      edges={['bottom']}
      footer={
        reviewed ? null : confirmInvalidate ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="bodySm" color="dangerInk">
              Invalidate {l.reference} for {l.title}? The student must resubmit.
            </Text>
            <View style={styles.actions}>
              <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmInvalidate(false)}>Keep</Button>
              <Button variant="danger" style={{ flex: 1 }} onPress={invalidate} loading={busy === 'invalidate'} loadingLabel="Invalidating…">
                Invalidate
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmInvalidate(true)} disabled={!!busy}>Invalidate</Button>
            <Button style={{ flex: 1 }} icon="check" onPress={verify} loading={busy === 'verify'} loadingLabel="Verifying…">
              Verify
            </Button>
          </View>
        )
      }>
      {formError ? <Banner tone="danger" title="Couldn’t save the review">{formError}</Banner> : null}

      <Card style={{ gap: spacing[3] }}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{l.title}</Text>
            <Text variant="code" color="inkMuted">{l.studentId}</Text>
          </View>
          <StatusPill status={l.status} />
        </View>
        <Money value={fromCentavos(l.amountCentavos)} size="xl" />
        <View style={styles.facts}>
          <Fact label="Paid for" value={l.itemDescription} />
          <Fact label="Channel" value={l.paymentChannel} />
          <Fact label="Reference number" value={l.reference} mono />
          {l.studentEmail ? <Fact label="Student email" value={l.studentEmail} /> : null}
          {l.reviewedBy ? <Fact label="Reviewed by" value={l.reviewedBy} /> : null}
          {l.reviewNotes ? <Fact label="Notes" value={l.reviewNotes} /> : null}
        </View>
      </Card>

      {reviewed ? null : (
        <TextField
          label="OR number"
          value={orNumber}
          onChangeText={(t) => { setOrNumber(t); setOrError(undefined); }}
          placeholder="OR-2026-000185"
          mono
          autoCapitalize="characters"
          autoCorrect={false}
          helper="Type the number printed on the official receipt you are issuing."
          error={orError}
        />
      )}

      <View style={{ gap: spacing[2] }}>
        <Text variant="label" color="inkMuted">Receipt screenshot</Text>
        {l.proofDataUrl ? (
          <Image
            source={{ uri: l.proofDataUrl }}
            alt={`Receipt submitted by ${l.title}`}
            style={[styles.proof, { backgroundColor: c.card, borderColor: c.border }]}
            contentFit="contain"
          />
        ) : (
          <View style={[styles.proof, styles.noProof, { backgroundColor: c.card, borderColor: c.border }]}>
            <Icon name="image" size={32} color="inkMuted" />
            <Text variant="bodySm" color="inkMuted">No screenshot was attached.</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="label" color="inkMuted">{label}</Text>
      <Text variant={mono ? 'code' : 'body'}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  facts: { gap: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[3] },
  proof: { height: 320,borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  noProof: { alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
});
