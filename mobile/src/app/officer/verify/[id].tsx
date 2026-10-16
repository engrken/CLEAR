import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Banner, Button, Card, Icon, Money, Screen, StatusPill, Text } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** One online remittance: compare the receipt, then verify or invalidate. */
export default function ReviewRemittance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useOfficerSession();
  const router = useRouter();
  const { c } = useTheme();
  const entry = useAsync(async () => (await api.listLedger(session)).find((l) => l.id === id), `${id}:${session.token}`);
  const [busy, setBusy] = useState<'verify' | 'invalidate'>();
  const [confirmInvalidate, setConfirmInvalidate] = useState(false);
  const [outcome, setOutcome] = useState<string>();

  const decide = async (d: 'verify' | 'invalidate') => {
    setBusy(d);
    try {
      const r = await api.reviewRemittance(session, id, d);
      setOutcome(d === 'verify' ? `Verified. ${r.orNumber} was emailed to the student.` : 'Invalidated. The student will be asked to resubmit.');
    } finally {
      setBusy(undefined);
    }
  };

  const l = entry.data;
  if (!l) return <Screen><Text color="inkMuted">{entry.loading ? 'Loading…' : 'This record no longer exists.'}</Text></Screen>;

  if (outcome) {
    return (
      <Screen edges={['bottom']} footer={<Button block onPress={() => router.back()}>Back to queue</Button>}>
        <Banner tone={outcome.startsWith('Verified') ? 'success' : 'warning'} title={outcome.split('.')[0]}>{outcome.split('. ').slice(1).join('. ')}</Banner>
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        confirmInvalidate ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="bodySm" color="dangerInk">
              Invalidate {l.reference} for {l.title}? The student must resubmit.
            </Text>
            <View style={styles.actions}>
              <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmInvalidate(false)}>Keep</Button>
              <Button variant="danger" style={{ flex: 1 }} onPress={() => decide('invalidate')} loading={busy === 'invalidate'} loadingLabel="Invalidating…">
                Invalidate
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmInvalidate(true)} disabled={!!busy}>Invalidate</Button>
            <Button style={{ flex: 1 }} icon="check" onPress={() => decide('verify')} loading={busy === 'verify'} loadingLabel="Verifying…">
              Verify
            </Button>
          </View>
        )
      }>
      <Card style={{ gap: spacing[3] }}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{l.title}</Text>
            <Text variant="bodySm" color="inkMuted">{l.subtitle}</Text>
          </View>
          <StatusPill status={l.status} />
        </View>
        <Money value={fromCentavos(l.amountCentavos)} size="xl" />
        <View style={{ gap: 2 }}>
          <Text variant="label" color="inkMuted">Reference number</Text>
          <Text variant="code">{l.reference}</Text>
        </View>
      </Card>

      <View style={[styles.receipt, { backgroundColor: c.card, borderColor: c.border }]} accessibilityLabel="Receipt screenshot">
        <Icon name="image" size={32} color="inkMuted" />
        <Text variant="bodySm" color="inkMuted">The student’s receipt screenshot appears here.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[3] },
  receipt: {
    height: 280,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
});
