import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api, type LedgerEntry } from '@/api';
import { Avatar, Banner, Button, Screen, Text } from '@/components/ui';
import { OfficerPresence } from '@/components/collaboration/OfficerPresence';
import { formatWhen } from '@/lib/dates';
import { openDepartmentModule } from '@/lib/links';
import { formatPeso, fromCentavos } from '@/lib/money';
import { setPendingCount } from '@/lib/pending-count';
import { useOfficerSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** Queue of online remittances waiting for an officer to verify. */
export default function VerifyQueue() {
  const session = useOfficerSession();
  const router = useRouter();
  const { c } = useTheme();
  const queue = useAsync(() => api.listPendingRemittances(session), session.token);
  const { reload } = queue;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // The Verify tab badge shows this queue's length.
  const count = queue.data?.length;
  useEffect(() => {
    if (count !== undefined) setPendingCount(count);
  }, [count]);

  return (
    <Screen edges={['top']} bottomInset={TAB_BAR_SPACE} contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {count ? `${count} to check` : 'Verify'}
        </Text>
        <Text color="inkMuted" style={styles.lead}>
          Review submitted proofs here, or use the audited web workflow to verify and issue official receipts when your role permits.
        </Text>
      </View>
      <OfficerPresence page="remittances" session={session} />
      <Button block variant="secondary" onPress={() => void openDepartmentModule(session.org.subdomain, '/remittances')}>
        Verify or manage proofs on secure web
      </Button>
      {queue.error ? <Banner tone="danger" title="Couldn't load pending proofs">{queue.error.message}</Banner> : null}
      {!queue.data && queue.loading ? (
        <ActivityIndicator color={c.accent} />
      ) : queue.data?.length === 0 ? (
        <Banner tone="success" title="All caught up">No payment proofs are waiting.</Banner>
      ) : queue.data ? (
        <View style={styles.list}>
          {queue.data.map((l) => (
            <QueueRow
              key={l.id}
              entry={l}
              onPress={() => router.push({ pathname: '/officer/verify/[id]', params: { id: l.id } })}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

/** One pending proof: a sun block with the student, item, channel and time, the amount, and the reference chip. */
function QueueRow({ entry: l, onPress }: { entry: LedgerEntry; onPress: () => void }) {
  const { c } = useTheme();
  const amount = formatPeso(fromCentavos(l.amountCentavos));
  const details = [l.subtitle, formatWhen(l.at)].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${l.title}, ${amount}, ${details}, reference ${l.reference}, ${l.status}`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.sunTint, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.rowTop}>
        <Avatar name={l.title} tone="warning" size={44} />
        <View style={styles.rowMain}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>{l.title}</Text>
          <Text variant="caption" color="sunInkSoft" numberOfLines={1} style={styles.details}>{details}</Text>
        </View>
        <Text variant="figure" numberOfLines={1} style={styles.amount}>{amount}</Text>
      </View>
      <View style={styles.refChip}>
        <Text variant="code" style={styles.refText}>Ref {l.reference}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  header: { gap: 6, paddingTop: 10, paddingHorizontal: 4, paddingBottom: 6 },
  title: { fontSize: 30, lineHeight: 34 },
  lead: { fontSize: 15, lineHeight: 21 },
  list: { gap: 10 },
  row: { gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.lg },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowMain: { flex: 1, minWidth: 0 },
  name: { fontSize: 17 },
  details: { fontFamily: 'Figtree_500Medium' },
  amount: { fontSize: 20, lineHeight: 26 },
  refChip: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill },
  refText: { fontSize: 12, lineHeight: 16 },
});
