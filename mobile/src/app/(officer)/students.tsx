import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api } from '@/api';
import { LedgerList, LedgerRow, Screen, TextField } from '@/components/ui';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { spacing, useTheme } from '@/theme';

/** The department roster for the active term. */
export default function Students() {
  const session = useOfficerSession();
  const { c } = useTheme();
  const students = useAsync(() => api.listStudents(session), session.token);
  const [q, setQ] = useState('');

  const list = (students.data ?? []).filter(
    (s) => !q.trim() || s.fullName.toLowerCase().includes(q.toLowerCase()) || s.studentId.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Screen edges={[]}>
      <TextField label="Search roster" value={q} onChangeText={setQ} placeholder="Name or student ID" autoCorrect={false} />
      <View style={{ gap: spacing[3] }}>
        {students.loading && !students.data ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <LedgerList>
            {list.map((s, i) => (
              <LedgerRow key={s.id} first={i === 0} title={s.fullName} reference={s.studentId} subtitle={s.yearLevel} status={s.enrollmentStatus} />
            ))}
          </LedgerList>
        )}
      </View>
    </Screen>
  );
}
