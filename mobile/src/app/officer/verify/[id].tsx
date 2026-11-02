import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { api, type ApiError, type RemittanceDetail } from '@/api';
import { REMITTANCE_WRITES_ENABLED } from '@/api/config';
import {
  Avatar, BackHeader, Banner, Button, Icon, Money, Screen, StatusPill, SuccessScreen, Text, TextField, toneFor,
} from '@/components/ui';
import { formatPeso, fromCentavos } from '@/lib/money';
import { setPendingCount } from '@/lib/pending-count';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

type Outcome = { tone: 'success' | 'warning'; title: string; body: string; orNumber?: string };
/** The next pending proof after a verify: undefined while loading, null when the queue is empty. */
type Next = { id: string; left: number } | null | undefined;

const TITLE = 'Check this payment';

/** One online remittance: compare the receipt, then verify with an OR number or invalidate. */
export default function ReviewRemittance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // "Next proof" replaces this screen with the next id; the key gives each proof fresh state.
  return <Review key={id} id={id} />;
}

function Review({ id }: { id: string }) {
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
  const [next, setNext] = useState<Next>();

  /** Loads the queue the Verify tab shows, to offer the next proof (and refresh the tab badge). */
  const findNext = () => {
    setNext(undefined);
    api
      .listPendingRemittances(session)
      .then((list) => {
        const rest = list.filter((x) => x.id !== id);
        setPendingCount(rest.length);
        setNext(rest.length ? { id: rest[0].id, left: rest.length } : null);
      })
      .catch(() => setNext(null));
  };

  const verify = async () => {
    if (!orNumber.trim()) return setOrError('Enter the OR number from the receipt booklet.');
    setBusy('verify');
    setFormError(undefined);
    try {
      const r = await api.verifyRemittance(session, id, { orNumber });
      setOutcome({ tone: 'success', title: 'Verified', body: `${r.orNumber} was queued for receipt delivery.`, orNumber: r.orNumber });
      findNext();
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
      <Screen header={<BackHeader title={TITLE} />}>
        {entry.error ? (
          <Banner tone="danger" title="Couldn’t open this remittance">{entry.error.message}</Banner>
        ) : (
          <ActivityIndicator color={c.accent} />
        )}
      </Screen>
    );
  }

  const amount = fromCentavos(l.amountCentavos);

  if (outcome?.tone === 'success') {
    return (
      <>
        <StatusBar style="light" />
        <SuccessScreen
          tone="cobalt"
          title={outcome.title}
          body={`${l.title}’s ${formatPeso(amount)} for ${l.itemDescription} is recorded, and the official receipt was queued for delivery.`}
          refLabel="OR issued"
          refValue={outcome.orNumber}
          actions={
            <>
              {next === undefined ? (
                <Button variant="light" block loading loadingLabel="Finding the next proof…">Next proof</Button>
              ) : next ? (
                <Button
                  variant="light"
                  block
                  onPress={() => router.replace({ pathname: '/officer/verify/[id]', params: { id: next.id } })}>
                  {`Next proof (${next.left} left)`}
                </Button>
              ) : (
                <Button variant="light" block onPress={() => router.dismissTo('/verify')}>Back to queue</Button>
              )}
              <Button variant="ghost" ghostTint="#FFFFFF" block onPress={() => router.dismissTo('/home')}>Back to home</Button>
            </>
          }
        />
      </>
    );
  }

  if (outcome) {
    return (
      <Screen header={<BackHeader title={TITLE} />} footer={<Button block onPress={() => router.back()}>Back to queue</Button>}>
        <Banner tone={outcome.tone} title={outcome.title}>{outcome.body}</Banner>
      </Screen>
    );
  }

  const reviewed = l.status !== 'Pending Verification';
  const muted = reviewed ? 'inkMuted' : 'sunInkSoft';

  return (
    <Screen
      header={<BackHeader title={TITLE} />}
      contentStyle={{ gap: 12 }}
      footer={
        reviewed || !REMITTANCE_WRITES_ENABLED ? null : confirmInvalidate ? (
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
            <Button style={{ flex: 1.4 }} onPress={verify} loading={busy === 'verify'} loadingLabel="Verifying…">
              Verify & send OR
            </Button>
          </View>
        )
      }>
      {!REMITTANCE_WRITES_ENABLED && !reviewed ? (
        <Banner tone="info" title="Review-only access">
          You can inspect this proof, but issuing an official receipt or invalidating a remittance is disabled until Android financial integrity has been verified.
        </Banner>
      ) : null}
      {formError ? <Banner tone="danger" title="Couldn’t save the review">{formError}</Banner> : null}

      <View style={[styles.summary, { backgroundColor: reviewed ? c.soft : c.sunTint }]}>
        <View style={styles.who}>
          <Avatar name={l.title} tone={reviewed ? toneFor(l.status) : 'warning'} size={48} />
          <View style={styles.whoText}>
            <Text variant="bodyStrong" accessibilityRole="header" numberOfLines={2} style={styles.name}>{l.title}</Text>
            <Text variant="caption" color={muted} style={{ fontFamily: 'Figtree_500Medium' }}>
              <Text variant="caption" color={muted} style={styles.studentId}>{l.studentId}</Text>
              {` · ${l.itemDescription}`}
            </Text>
          </View>
        </View>
        {/* Own row: the stored wording ("Pending Verification") is too long to share the name line. */}
        <StatusPill status={l.status} />
        <Money value={amount} size="xl" />
        <View style={styles.chips}>
          <Chip label="Channel" value={l.paymentChannel} />
          <Chip label="Reference number" value={l.reference} prefix="Ref " mono />
          {l.studentEmail ? <Chip label="Student email" value={l.studentEmail} light /> : null}
        </View>
        {l.reviewedBy ? <Fact label="Reviewed by" value={l.reviewedBy} /> : null}
        {l.reviewNotes ? <Fact label="Notes" value={l.reviewNotes} /> : null}
      </View>

      {l.proofDataUrl ? (
        <Image
          source={{ uri: l.proofDataUrl }}
          alt={`Receipt submitted by ${l.title}`}
          style={[styles.proof, { backgroundColor: c.soft }]}
          contentFit="contain"
        />
      ) : (
        <View style={[styles.proof, styles.noProof, { backgroundColor: c.soft }]}>
          <Icon name="image" size={32} color="inkMuted" />
          <Text variant="bodySm" color="inkMuted">No screenshot was attached.</Text>
        </View>
      )}

      {reviewed || !REMITTANCE_WRITES_ENABLED ? null : (
        <TextField
          label="OR number you’re issuing"
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
    </Screen>
  );
}

/** A white pill on the summary block; the label is read out, not shown. */
function Chip({ label, value, prefix, mono, light }: { label: string; value: string; prefix?: string; mono?: boolean; light?: boolean }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text
        variant={mono ? 'code' : 'caption'}
        numberOfLines={1}
        style={{ fontFamily: light ? 'Figtree_600SemiBold' : 'Figtree_700Bold', fontSize: 13, lineHeight: 18 }}>
        {prefix}
        {value}
      </Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="label" color="inkMuted">{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: radius.lg, paddingVertical: 18, paddingHorizontal: 20, gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  whoText: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, lineHeight: 24 },
  studentId: { fontFamily: 'Figtree_600SemiBold', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { maxWidth: '100%', backgroundColor: '#FFFFFF', paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill },
  actions: { flexDirection: 'row', gap: 10 },
  proof: { height: 320, borderRadius: radius.lg, overflow: 'hidden' },
  noProof: { alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
});
