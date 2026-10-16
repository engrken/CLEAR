import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { api, type ClearanceResult, type Organization } from '@/api';
import { Banner, Button, ClearanceCard, Screen, Text, TextField } from '@/components/ui';
import { fromCentavos } from '@/lib/money';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { spacing } from '@/theme';

/** Student clearance lookup by exact student ID or registered email. */
export default function Clearance() {
  const { dept } = useLocalSearchParams<{ dept: string }>();
  const router = useRouter();
  const { session } = useSession();
  const org = useAsync<Organization>(() => api.getOrganization(dept), dept);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ClearanceResult | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (!query.trim()) return setError('Enter your student ID, for example DEV-2026-0001.');
    setBusy(true);
    setError(undefined);
    try {
      // An officer signed in to this department sees the amount due too.
      setResult(await api.lookupClearance(dept, query, session));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: spacing[2] }}>
        <Text variant="title">Check your clearance</Text>
        <Text color="inkMuted">Enter your exact student ID or the email registered with your department.</Text>
      </View>

      <View style={{ gap: spacing[4] }}>
        <TextField
          label="Student ID or email"
          value={query}
          onChangeText={(t) => { setQuery(t); setError(undefined); }}
          placeholder="DEV-2026-0001"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={check}
          error={error}
        />
        <Button block icon="search" onPress={check} loading={busy} loadingLabel="Checking…">
          Check clearance
        </Button>
      </View>

      {result && org.data ? (
        <View style={{ gap: spacing[4] }}>
          <ClearanceCard
            orgName={org.data.name}
            studentName={result.studentName}
            studentId={result.studentId}
            status={result.status}
            outstanding={result.outstandingCentavos === null ? null : fromCentavos(result.outstandingCentavos)}
            qrToken={result.qrToken ?? undefined}
            ay={result.ay}
            term={result.term}
          />
          {result.status === 'hold' ? (
            <Button
              block
              icon="upload"
              onPress={() => router.push({ pathname: '/d/[dept]/submit-proof', params: { dept, studentId: result.studentId } })}>
              Submit payment proof
            </Button>
          ) : null}
        </View>
      ) : null}

      <Banner tone="info">
        Only your clearance status and total balance are shown here. Itemised records stay with your officers.
      </Banner>
    </Screen>
  );
}
