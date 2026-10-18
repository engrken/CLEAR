import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type ApiError, type FeeItem, type Student } from '@/api';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { isEnrolled } from '@/lib/enrollment';
import { formatPeso, fromCentavos } from '@/lib/money';
import { useOfficerSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** Record an in-person payment and issue an OR number. */
export default function Collect() {
  const session = useOfficerSession();
  const students = useAsync<Student[]>(() => api.listStudents(session), session.token);
  const fees = useAsync<FeeItem[]>(() => api.listFeeItems(session.org.subdomain), session.token);

  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState<string>();
  const [feeId, setFeeId] = useState<string>();
  const [amount, setAmount] = useState('');
  const [orNumber, setOrNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [recorded, setRecorded] = useState<string>();

  const enrolled = (students.data ?? []).filter((s) => isEnrolled(s.enrollmentStatus));
  const q = search.trim().toLowerCase();
  const matches = q ? enrolled.filter((s) => s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)) : enrolled;
  const student = enrolled.find((s) => s.id === studentId);

  const chooseFee = (f: FeeItem) => {
    setFeeId(f.id);
    setAmount(fromCentavos(f.amountCentavos).toFixed(2));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    const pesos = Number(amount.replace(/,/g, ''));
    if (!studentId) e.student = 'Choose the student who paid.';
    if (!feeId) e.fee = 'Choose the fee item.';
    if (!Number.isFinite(pesos) || pesos <= 0) e.amount = 'Enter the amount received, for example 150.00.';
    if (!orNumber.trim()) e.or = 'Enter the OR number printed on the receipt.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const entry = await api.recordPayment(session, {
        studentId: studentId!, feeId: feeId!, amountCentavos: Math.round(pesos * 100), orNumber,
      });
      setRecorded(`${entry.reference} · ${formatPeso(pesos)} from ${entry.title}`);
      setStudentId(undefined); setFeeId(undefined); setAmount(''); setOrNumber(''); setSearch('');
    } catch (err) {
      const e = err as ApiError;
      // A reused OR number or an amount over the balance belongs to that field; anything else
      // (closed term, inactive student, rate limit) is the form's. The message comes from the server.
      if (e.code === 'duplicate_or') setErrors({ or: e.message });
      else if (e.code === 'overpayment') setErrors({ amount: e.message });
      else setErrors({ form: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      edges={[]}
      footer={<Button block icon="receipt" onPress={submit} loading={busy} loadingLabel="Recording…">Record payment</Button>}>
      {recorded ? <Banner tone="success" title="Payment recorded">{recorded}. The receipt was emailed to the student.</Banner> : null}
      {errors.form ? <Banner tone="danger" title="Payment not recorded">{errors.form}</Banner> : null}

      <View style={{ gap: spacing[2] }}>
        {student ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="label" color="inkMuted">Student</Text>
            <Picked title={student.fullName} detail={student.studentId} onClear={() => setStudentId(undefined)} />
          </View>
        ) : (
          <>
            <TextField label="Student" value={search} onChangeText={setSearch} placeholder="Search name or ID" autoCorrect={false} error={errors.student} />
            <View style={{ gap: spacing[2] }}>
              {matches.slice(0, 4).map((s) => (
                <Choice key={s.id} title={s.fullName} detail={`${s.studentId} · ${s.yearLevel}`} onPress={() => setStudentId(s.id)} />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={{ gap: spacing[2] }}>
        <Text variant="label" color="inkMuted">Fee item</Text>
        {fees.data?.map((f) => (
          <Choice
            key={f.id}
            title={f.name}
            detail={`${f.category} · ${f.targetFund}`}
            amount={formatPeso(fromCentavos(f.amountCentavos))}
            selected={feeId === f.id}
            onPress={() => chooseFee(f)}
          />
        ))}
        {errors.fee ? <Text variant="bodySm" color="dangerInk">{errors.fee}</Text> : null}
      </View>

      <TextField label="Amount received" prefix="₱" mono inputMode="decimal" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" error={errors.amount} />
      <TextField label="OR number" mono autoCapitalize="characters" autoCorrect={false} value={orNumber} onChangeText={setOrNumber} placeholder="OR-2026-000185" error={errors.or} />
    </Screen>
  );
}

function Choice({ title, detail, amount, selected, onPress }: { title: string; detail: string; amount?: string; selected?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: selected || pressed ? c.accentTint : c.card, borderColor: selected ? c.accent : c.borderStrong },
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={selected ? 'accentInk' : 'ink'}>{title}</Text>
        <Text variant="bodySm" color="inkMuted">{detail}</Text>
      </View>
      {amount ? <Text variant="figureSm" color={selected ? 'accentInk' : 'ink'}>{amount}</Text> : null}
    </Pressable>
  );
}

function Picked({ title, detail, onClear }: { title: string; detail: string; onClear: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.choice, { backgroundColor: c.accentTint, borderColor: c.accent }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color="accentInk">{title}</Text>
        <Text variant="code" color="inkMuted">{detail}</Text>
      </View>
      <Button variant="ghost" size="sm" onPress={onClear}>Change</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderWidth: 1.5,
    borderRadius: radius.sm,
  },
});
