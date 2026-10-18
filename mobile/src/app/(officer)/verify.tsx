import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';

import { api } from '@/api';
import { Banner, LedgerList, LedgerRow, Screen, Text } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { useTheme } from '@/theme';

/** Queue of online remittances waiting for an officer to verify. */
export default function VerifyQueue() {
  const session = useOfficerSession();
  const router = useRouter();
  const { c } = useTheme();
  const queue = useAsync(() => api.listLedger(session, { status: 'Pending Verification' }), session.token);
  const { reload } = queue;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <Screen edges={[]}>
      <Text color="inkMuted">
        Check each receipt against the GCash or Maya account before verifying. Verifying issues an OR and emails it to the student.
      </Text>
      {!queue.data ? (
        <ActivityIndicator color={c.accent} />
      ) : queue.data.length === 0 ? (
        <Banner tone="success" title="All caught up">No payment proofs are waiting.</Banner>
      ) : (
        <LedgerList>
          {queue.data.map((l, i) => (
            <LedgerRow
              key={l.id}
              first={i === 0}
              title={l.title}
              reference={l.reference}
              subtitle={l.subtitle}
              amount={fromCentavos(l.amountCentavos)}
              status={l.status}
              onPress={() => router.push({ pathname: '/officer/verify/[id]', params: { id: l.id } })}
            />
          ))}
        </LedgerList>
      )}
    </Screen>
  );
}
