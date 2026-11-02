import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type ApiError, type FeeItem, type Student } from '@/api';
import { PAYMENT_WRITES_ENABLED } from '@/api/config';
import { Avatar, Banner, Button, Icon, Screen, Text, TextField } from '@/components/ui';
import { isEnrolled } from '@/lib/enrollment';
import { formatPeso, fromCentavos } from '@/lib/money';
import { choosePendingPayment, parsePaymentCentavos, parsePendingPayment, paymentStorageKey, type PaymentDraft, type PendingPayment } from '@/lib/payment-pending';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

/** Record an in-person payment and issue an OR number. */
export default function Collect() {
  const session = useOfficerSession();
  const { can } = useSession();
  const students = useAsync<Student[]>(
    () => PAYMENT_WRITES_ENABLED && can('tab-payment') ? api.listStudents(session) : Promise.resolve([]),
    session.token + ':payment:' + PAYMENT_WRITES_ENABLED
  );
  const fees = useAsync<FeeItem[]>(
    () => PAYMENT_WRITES_ENABLED && can('tab-payment') ? api.listFeeItems(session.org.subdomain) : Promise.resolve([]),
    session.token + ':payment-fees:' + PAYMENT_WRITES_ENABLED
  );

  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState<string>();
  const [feeId, setFeeId] = useState<string>();
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Synchronous guard: state updates alone do not prevent rapid double taps.
  const submittingRef = useRef(false);
  // Each officer+tenant has one durable unresolved request. Never overwrite it.
  const pendingKey = paymentStorageKey(session.org.subdomain, session.officer.id);
  const canCollect = can('tab-payment');
  const [recovery, setRecovery] = useState<{
    storageKey: string; pending: PendingPayment | null; issue: string | null;
  }>();
  const recoveryReady = !PAYMENT_WRITES_ENABLED || !canCollect || recovery?.storageKey === pendingKey;
  const pending = recovery?.storageKey === pendingKey ? recovery.pending : null;
  const recoveryIssue = recovery?.storageKey === pendingKey ? recovery.issue : null;

  useEffect(() => {
    if (!PAYMENT_WRITES_ENABLED || !canCollect) return;
    let active = true;
    void SecureStore.getItemAsync(pendingKey)
      .then(raw => {
        if (!active) return;
        try {
          setRecovery({ storageKey: pendingKey, pending: parsePendingPayment(raw), issue: null });
        } catch (error) {
          setRecovery({ storageKey: pendingKey, pending: null, issue: (error as Error).message });
        }
      })
      .catch(() => {
        if (active) setRecovery({ storageKey: pendingKey, pending: null,
          issue: 'Secure payment recovery is unavailable. Do not start another payment until reconciled.' });
      });
    return () => { active = false; };
  }, [pendingKey, canCollect]);

  const [recorded, setRecorded] = useState<string>();

  const enrolled = (students.data ?? []).filter((s) => isEnrolled(s.enrollmentStatus));
  const q = search.trim().toLowerCase();
  const matches = q ? enrolled.filter((s) => s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)) : enrolled;
  const student = enrolled.find((s) => s.id === studentId);

  const chooseFee = (f: FeeItem) => {
    setFeeId(f.id);
    setAmount(fromCentavos(f.amountCentavos).toFixed(2));
  };

  const postPayment = async (draft: PaymentDraft) => {
    if (submittingRef.current) return;
    if (!PAYMENT_WRITES_ENABLED || !canCollect) {
      setErrors({ form: 'Native payment posting is not enabled. Use the audited CLEAR web application.' });
      return;
    }
    if (!recoveryReady || recoveryIssue) {
      setErrors({ form: recoveryIssue || 'Checking an earlier payment. Try again when recovery is ready.' });
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setErrors({});
    try {
      // Read secure storage again, not just React state: it is the recovery source of truth.
      const existing = parsePendingPayment(await SecureStore.getItemAsync(pendingKey));
      const attempt = choosePendingPayment(existing, draft, () =>
        globalThis.crypto?.randomUUID?.() ?? (() => { throw new Error('Secure request IDs unavailable; payment not submitted.'); })()
      );
      if (!existing) {
        // Must persist before the HTTP request. Failure forbids any posting.
        await SecureStore.setItemAsync(pendingKey, JSON.stringify(attempt));
      }
      setRecovery({ storageKey: pendingKey, pending: attempt, issue: null });
      const entry = await api.recordPayment(session, { ...draft, idempotencyKey: attempt.key });
      const cleared = await SecureStore.deleteItemAsync(pendingKey).then(() => true, () => false);
      if (cleared) setRecovery({ storageKey: pendingKey, pending: null, issue: null });
      const warning = cleared ? '' : ' Confirm this receipt in the ledger before starting another payment; secure recovery could not be cleared.';
      setRecorded(entry.reference + ' · ' + formatPeso(fromCentavos(draft.amountCentavos)) + ' from ' + entry.title + '.' + warning);
      setStudentId(undefined); setFeeId(undefined); setAmount(''); setSearch('');
    } catch (error) {
      const cause = error as ApiError;
      // Even a later validation failure does not prove an earlier timed-out
      // request with this key failed. Preserve it until a confirmed receipt.
      setErrors({ form: (cause?.message || 'Unable to confirm the payment.') +
        ' Check the receipt ledger. If the outcome is uncertain, retry the saved payment only.' });
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const submit = async () => {
    if (submittingRef.current) return;
    const e: Record<string, string> = {};
    const amountCentavos = parsePaymentCentavos(amount);
    if (!studentId) e.student = 'Choose the student who paid.';
    if (!feeId) e.fee = 'Choose the fee item.';
    if (amountCentavos === null) e.amount = 'Enter a valid amount with at most two decimal places (maximum ₱1,000,000.00).';
    if (pending) e.form = 'Resolve the saved payment first. Retrying it will reuse its receipt request ID.';
    setErrors(e);
    if (Object.keys(e).length) return;
    await postPayment({ studentId: studentId!, feeId: feeId!, amountCentavos: amountCentavos! });
  };

  const parsedAmount = parsePaymentCentavos(amount);
  const submitLabel = parsedAmount !== null ?
    'Record ' + formatPeso(fromCentavos(parsedAmount)) : 'Record payment';

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header" style={styles.heading}>Record a payment</Text>
    </View>
  );

  if (!can('tab-payment') || !PAYMENT_WRITES_ENABLED) {
    return (
      <Screen edges={['top']} header={header} bottomInset={TAB_BAR_SPACE}>
        <Banner tone={!can('tab-payment') ? 'danger' : 'info'} title={!can('tab-payment') ? 'Permission required' : 'Payment posting is paused'}>
          {!can('tab-payment')
            ? 'Your saved department permissions do not include payment collection.'
            : 'Your role includes payment collection, but the Android accounting and official receipt service is not ready. Use the audited CLEAR web application for payments.'}
        </Banner>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} header={header} bottomInset={TAB_BAR_SPACE}>
      {recorded ? <Banner tone="success" title="Receipt confirmed">{recorded}</Banner> : null}
      {errors.form ? <Banner tone="danger" title="Payment needs review">{errors.form}</Banner> : null}
      {recoveryIssue ? <Banner tone="danger" title="Recovery blocked">{recoveryIssue}</Banner> : null}
      {pending ? (
        <View style={{ gap: spacing[2] }}>
          <Banner tone="warning" title="Unconfirmed payment">
            {formatPeso(fromCentavos(pending.draft.amountCentavos))} · Student {pending.draft.studentId} · Fee {pending.draft.feeId}.
            An earlier request might already have posted. Retry the exact payment to recover its official receipt; do not start another transaction until it is reconciled.
          </Banner>
          <Button block variant="secondary" loading={busy} onPress={() => void postPayment(pending.draft)}>
            Retry exact payment
          </Button>
        </View>
      ) : null}

      {student ? (
        <View style={styles.group}>
          <Text variant="label" style={styles.groupLabel}>Student</Text>
          <Picked name={student.fullName} detail={`${student.studentId} · ${student.yearLevel}`} onClear={() => setStudentId(undefined)} />
        </View>
      ) : (
        <View style={{ gap: spacing[2] }}>
          <TextField label="Student" value={search} onChangeText={setSearch} placeholder="Search name or ID" autoCorrect={false} error={errors.student} />
          {matches.slice(0, 4).map((s) => (
            <StudentChoice key={s.id} name={s.fullName} detail={`${s.studentId} · ${s.yearLevel}`} onPress={() => setStudentId(s.id)} />
          ))}
        </View>
      )}

      <View style={{ gap: spacing[2] }}>
        <Text variant="label" style={styles.groupLabel}>Fee item</Text>
        {fees.data?.map((f) => (
          <FeeChoice
            key={f.id}
            title={f.name}
            detail={`${f.category} · ${f.targetFund}`}
            amount={formatPeso(fromCentavos(f.amountCentavos))}
            selected={feeId === f.id}
            onPress={() => chooseFee(f)}
          />
        ))}
        {errors.fee ? (
          <View style={styles.help}>
            <Icon name="alert" size={14} color="dangerInk" />
            <Text variant="bodySm" color="dangerInk" style={{ flex: 1 }}>{errors.fee}</Text>
          </View>
        ) : null}
      </View>

      <TextField label="Amount received" prefix="₱" mono inputMode="decimal" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" error={errors.amount} />
      <Banner tone="info" title="Official receipt">CLEAR automatically allocates the official receipt number after successful posting.</Banner>

      <Button block onPress={submit} disabled={!recoveryReady || !!pending || !!recoveryIssue}
        loading={busy} loadingLabel="Recording…">{submitLabel}</Button>
    </Screen>
  );
}

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '·';

/** A search result: soft row with an initials avatar. */
function StudentChoice({ name, detail, onPress }: { name: string; detail: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: false }}
      style={({ pressed }) => [styles.studentRow, { backgroundColor: pressed ? c.cobaltTint : c.soft }]}>
      <Avatar name={name} tone="info" size={44} />
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" numberOfLines={1}>{name}</Text>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1}>{detail}</Text>
      </View>
    </Pressable>
  );
}

/** The chosen student on cobalt tint, with a white "Change" pill. */
function Picked({ name, detail, onClear }: { name: string; detail: string; onClear: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.studentRow, styles.picked, { backgroundColor: c.cobaltTint }]}>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.pickedAvatar, { backgroundColor: c.cobalt }]}>
        <Text variant="caption" color="onAccent" style={{ fontFamily: 'Figtree_700Bold', fontSize: 14 }}>{initials(name)}</Text>
      </View>
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" numberOfLines={1}>{name}</Text>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1}>{detail}</Text>
      </View>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        hitSlop={4}
        style={({ pressed }) => [styles.change, { backgroundColor: '#FFFFFF', opacity: pressed ? 0.7 : 1 }]}>
        <Text variant="label" color="cobalt">Change</Text>
      </Pressable>
    </View>
  );
}

/** A fee option: soft row, ink when selected. */
function FeeChoice({ title, detail, amount, selected, onPress }: { title: string; detail: string; amount: string; selected?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.fee,
        { backgroundColor: selected ? c.inkBlock : pressed ? c.cobaltTint : c.soft },
      ]}>
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" color={selected ? 'onAccent' : 'ink'} style={{ fontSize: 15, lineHeight: 20 }}>{title}</Text>
        <Text variant="caption" style={{ fontSize: 12, lineHeight: 16, color: selected ? c.tabInactive : c.inkMuted }}>{detail}</Text>
      </View>
      <Text variant="figure" color={selected ? 'onAccent' : 'ink'} style={{ fontSize: 16 }}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 6 },
  heading: { fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  group: { gap: 6 },
  groupLabel: { paddingLeft: 6 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 24,
  },
  picked: { paddingRight: 10 },
  pickedAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, minWidth: 0, gap: 1 },
  change: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  help: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  pair: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  half: { flex: 1, minWidth: 0 },
});
