import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { api, type ApiError, type Student, type StudentRosterMutation, type StudentRosterSnapshot } from '@/api';
import { Avatar, Banner, Button, Icon, Screen, StatusPill, Text, TextField, type Tone } from '@/components/ui';
import { OfficerPresence } from '@/components/collaboration/OfficerPresence';
import { STUDENT_ROSTER_WRITES_ENABLED } from '@/api/config';
import { enrollmentLabel, isEnrolled } from '@/lib/enrollment';
import { canOfferMobileWrite } from '@/lib/write-permissions';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, type, useTheme } from '@/theme';

const AVATAR_TONES: Tone[] = ['success', 'warning', 'info', 'danger'];
function avatarTone(name: string): Tone {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

type Selection = { sessionKey: string; student: Student | null };
const snapshot = (s: Student): StudentRosterSnapshot => ({
  studentId: s.studentId, fullName: s.fullName, yearLevel: s.yearLevel,
  email: s.email ?? null, enrollmentStatus: isEnrolled(s.enrollmentStatus) ? 'Enrolled' : 'Inactive',
});

/** Tenant-aware roster with independently server-granted, opt-in mutation controls. */
export default function Students() {
  const session = useOfficerSession();
  const { can } = useSession();
  const { c } = useTheme();
  const canView = can('tab-students');
  const [missingEmailOnly, setMissingEmailOnly] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState<string>();
  const students = useAsync(
    () => api.listStudents(session, undefined, canView && missingEmailOnly),
    session.token + ':' + session.org.subdomain + ':roster:' + String(canView && missingEmailOnly),
  );
  const capability = useAsync(
    () => STUDENT_ROSTER_WRITES_ENABLED && canView ? api.getWriteCapabilities(session) : Promise.resolve({ enabled: false, grants: [] }),
    session.token + ':' + session.org.subdomain + ':student-write:' + String(STUDENT_ROSTER_WRITES_ENABLED && canView),
  );
  const canAdd = canView && STUDENT_ROSTER_WRITES_ENABLED &&
    canOfferMobileWrite(capability.data, 'students.create', session.org.subdomain);
  const canEdit = canView && STUDENT_ROSTER_WRITES_ENABLED &&
    canOfferMobileWrite(capability.data, 'students.update', session.org.subdomain);

  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  // Never display previous tenant/filter data while a new roster loads.
  const current = students.loading ? undefined : students.data;
  const list = (current ?? []).filter(s =>
    !q.trim() || s.fullName.toLowerCase().includes(q.trim().toLowerCase()) ||
    s.studentId.toLowerCase().includes(q.trim().toLowerCase())
  );
  const editor = selection?.sessionKey === session.token ? selection.student : undefined;
  const editorOpen = selection !== null && selection.sessionKey === session.token &&
    (selection.student === null ? canAdd : canEdit);

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header" style={styles.heading}>Students</Text>
      {current ? <Text variant="label" color="inkMuted">{current.length} loaded</Text> : null}
    </View>
  );

  return (
    <Screen edges={['top']} header={header} bottomInset={TAB_BAR_SPACE} contentStyle={{ gap: 10 }}>
      <OfficerPresence page="students" session={session} />
      <View style={[styles.search, { backgroundColor: focused ? c.ground : c.soft, borderColor: focused ? c.cobalt : 'transparent' }]}>
        <Icon name="search" size={18} color="inkMuted" />
        <TextInput value={q} onChangeText={setQ} placeholder="Name or student ID" placeholderTextColor={c.inkMuted}
          autoCorrect={false} accessibilityLabel="Search loaded roster"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={[styles.searchInput, { color: c.ink }]} />
      </View>
      {notice ? <Banner tone="success" title="Roster updated">{notice}</Banner> : null}
      {canView ? (
        <View style={{ gap: spacing[2] }}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: missingEmailOnly }}
            onPress={() => { setMissingEmailOnly(v => !v); setQ(''); }}
            style={[styles.emailFilter, { backgroundColor: missingEmailOnly ? c.inkBlock : c.soft }]}>
            <Text variant="bodyStrong" color={missingEmailOnly ? 'onAccent' : 'ink'}>
              {missingEmailOnly ? 'Show all loaded students' : 'Students needing verified email'}
            </Text>
          </Pressable>
          {missingEmailOnly ? <Banner tone="info" title="Identity verification required">
            Registered email changes require school-policy identity review. The student must still verify their own email using OTP.
          </Banner> : null}
          {STUDENT_ROSTER_WRITES_ENABLED && capability.loading ? <ActivityIndicator color={c.cobalt} /> : null}
          {canAdd ? <Button block onPress={() => { setNotice(undefined); setSelection({ sessionKey: session.token, student: null }); }}>
            Add student
          </Button> : null}
          {STUDENT_ROSTER_WRITES_ENABLED && !capability.loading && !canAdd ?
            <Banner tone="info" title="Roster editing not authorized">
              Your current session has no server-approved roster write grant. You can continue reviewing records.
            </Banner> : null}
        </View>
      ) : null}
      {students.error ? <Banner tone="danger" title="Couldn't load student roster">{students.error.message}</Banner> : null}
      {students.loading ? <ActivityIndicator color={c.cobalt} /> : current ? (
        <View style={{ gap: 6 }}>
          {list.map(student => (
            <RosterRow key={student.id} student={student}
              onEdit={canEdit ? () => { setNotice(undefined); setSelection({ sessionKey: session.token, student }); } : undefined} />
          ))}
          {list.length === 0 ? <Banner tone="info" title="No matching records">
            Try another search or switch the email filter.
          </Banner> : null}
          {current.length >= 500 ? <Banner tone="info" title="Roster list is limited">
            Up to 500 students are loaded. Use the web roster for complete authorized search and pagination.
          </Banner> : null}
        </View>
      ) : null}
      <Banner tone="info" title="Record integrity">
        Only officers with Students permission and a separately approved roster-write grant may edit. Financial transactions and prior academic records are preserved.
      </Banner>
      {editorOpen ? <RosterEditor key={session.token + ':' + (editor?.id ?? 'new')} student={editor ?? null}
        onCancel={() => setSelection(null)}
        onSaved={(message) => { setSelection(null); setNotice(message); students.reload(); }}
        save={(change) => api.updateStudentRoster(session, change)} /> : null}
    </Screen>
  );
}

function RosterRow({ student: s, onEdit }: { student: Student; onEdit?: () => void }) {
  const { c } = useTheme();
  const active = isEnrolled(s.enrollmentStatus);
  return (
    <View style={[styles.row, active ? { backgroundColor: c.soft } :
      { backgroundColor: c.ground, borderWidth: 2, borderStyle: 'dashed', borderColor: c.border }]}>
      <Avatar name={s.fullName} tone={active ? avatarTone(s.fullName) : 'neutral'} size={44} />
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" color={active ? 'ink' : 'inkMuted'} numberOfLines={1}>{s.fullName}</Text>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1}>
          <Text variant="code" color="inkMuted" style={{ fontSize: 13 }}>{s.studentId}</Text> · {s.yearLevel}
        </Text>
        {s.email ? <Text variant="caption" color="inkMuted" numberOfLines={1}>{s.email}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <StatusPill status={enrollmentLabel(s.enrollmentStatus)} />
        {onEdit ? <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={'Edit ' + s.fullName}
          style={[styles.edit, { borderColor: c.cobalt }]}>
          <Text variant="bodySm" color="cobalt">Edit</Text>
        </Pressable> : null}
      </View>
    </View>
  );
}

function RosterEditor({ student, save, onCancel, onSaved }: {
  student: Student | null;
  save: (change: StudentRosterMutation) => Promise<unknown>;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { c } = useTheme();
  const [studentId, setStudentId] = useState(student?.studentId ?? '');
  const [fullName, setFullName] = useState(student?.fullName ?? '');
  const [yearLevel, setYearLevel] = useState(student?.yearLevel ?? '1st Year');
  const [email, setEmail] = useState(student?.email ?? '');
  const [enrollmentStatus, setEnrollmentStatus] = useState<'Enrolled' | 'Inactive'>(
    student && !isEnrolled(student.enrollmentStatus) ? 'Inactive' : 'Enrolled'
  );
  const [verifiedIdentity, setVerifiedIdentity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const emailChanged = Boolean(student && (student.email ?? '').trim().toLowerCase() !== email.trim().toLowerCase());

  const confirmSave = () => {
    if (busy) return;
    setError(undefined);
    const id = studentId.trim(), name = fullName.trim(), mailbox = email.trim().toLowerCase();
    if (!id || id.length > 100 || !name || name.length > 200 || !yearLevel.trim()) {
      setError('Provide a valid student ID, name and year level.'); return;
    }
    if (mailbox && (mailbox.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox))) {
      setError('Enter a valid email address.'); return;
    }
    if (emailChanged && !verifiedIdentity) {
      setError('Confirm that the student identity was checked under school policy before changing their email.'); return;
    }
    if (student && (student.email ?? '') && !mailbox) {
      setError('Registered emails cannot be cleared through roster editing.'); return;
    }
    const details = (student ? 'Update ' : 'Create ') + name + ' (' + id + ') as ' + enrollmentStatus +
      '? This may affect current-term enrollment and clearance. Prior financial records will be preserved.';
    Alert.alert(student ? 'Confirm student changes' : 'Confirm new student', details, [
      { text: 'Cancel', style: 'cancel' },
      { text: student ? 'Update' : 'Add', onPress: () => { void submit(id, name, mailbox); } },
    ]);
  };
  const submit = async (id: string, name: string, mailbox: string) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const change: StudentRosterMutation = student ? {
        action: 'update', id: student.id, studentId: id, fullName: name, yearLevel: yearLevel.trim(),
        email: mailbox || null, enrollmentStatus, expected: snapshot(student),
        emailChangeIdentityVerified: emailChanged && verifiedIdentity,
      } : { action: 'create', studentId: id, fullName: name, yearLevel: yearLevel.trim(),
        email: mailbox || null, enrollmentStatus };
      await save(change);
      onSaved(student ? 'Changes saved to the active-term roster.' : 'Student added to the active-term roster.');
    } catch (cause) {
      setError((cause as ApiError).message || 'The student record could not be saved. Refresh and retry.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={busy ? undefined : onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalRoot, { backgroundColor: c.canvas }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <Text variant="headline">{student ? 'Edit student' : 'Add student'}</Text>
          <Button variant="ghost" size="sm" disabled={busy} onPress={onCancel}>Close</Button>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
          <Banner tone="info" title="Authorized roster edit">
            The server checks your tenant, Students permission and current term again before applying any changes.
          </Banner>
          {error ? <Banner tone="danger" title="Changes not saved">{error}</Banner> : null}
          <TextField label="Student ID" value={studentId} onChangeText={setStudentId}
            autoCapitalize="characters" autoCorrect={false} maxLength={100} />
          <TextField label="Full name" value={fullName} onChangeText={setFullName}
            autoCapitalize="words" maxLength={200} />
          <TextField label="Year level" value={yearLevel} onChangeText={setYearLevel}
            helper="For example, 1st Year, 2nd Year, 3rd Year, or Graduated / Alumni." maxLength={80} />
          <TextField label="Registered student email" value={email} onChangeText={setEmail}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            helper="Changing an existing student email requires a verified school-policy identity review." maxLength={254} />
          {emailChanged ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: verifiedIdentity }}
            onPress={() => setVerifiedIdentity(value => !value)} style={[styles.confirm, { borderColor: c.border }]}>
            <Icon name={verifiedIdentity ? 'check' : 'alert'} size={20} color={verifiedIdentity ? 'cobalt' : 'inkMuted'} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              I verified this student's identity under school policy before changing the registered email. Student OTP remains required.
            </Text>
          </Pressable> : null}
          <Text variant="label">Active-term enrollment</Text>
          <View style={styles.choices}>
            {(['Enrolled', 'Inactive'] as const).map(status => (
              <Pressable key={status} accessibilityRole="radio" accessibilityState={{ checked: status === enrollmentStatus }}
                onPress={() => setEnrollmentStatus(status)}
                style={[styles.choice, { backgroundColor: status === enrollmentStatus ? c.cobaltTint : c.soft,
                  borderColor: status === enrollmentStatus ? c.cobalt : c.border }]}>
                <Text variant="bodyStrong">{status}</Text>
              </Pressable>
            ))}
          </View>
          <Button block loading={busy} loadingLabel="Saving roster…" onPress={confirmSave}>
            {student ? 'Review & save changes' : 'Review & add student'}
          </Button>
          <Button block variant="secondary" disabled={busy} onPress={onCancel}>Cancel</Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3],
    paddingTop: 18, paddingHorizontal: 20, paddingBottom: 6 },
  heading: { fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    paddingHorizontal: 18, borderWidth: 3, borderRadius: radius.pill },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: spacing[3], ...type.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 64, paddingVertical: 10,
    paddingHorizontal: 12, borderRadius: radius.md },
  rowMain: { flex: 1, minWidth: 0, gap: 1 },
  emailFilter: { paddingVertical: 13, paddingHorizontal: 15, borderRadius: radius.md, alignItems: 'center' },
  edit: { borderWidth: 1, paddingVertical: 4, paddingHorizontal: 12, borderRadius: radius.pill },
  modalRoot: { flex: 1, paddingTop: Platform.OS === 'android' ? 32 : 16 },
  modalHeader: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalBody: { padding: 20, paddingBottom: 70, gap: 15, maxWidth: 640, width: '100%', alignSelf: 'center' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderRadius: radius.md, borderWidth: 1 },
  choices: { flexDirection: 'row', gap: 12 },
  choice: { flex: 1, borderWidth: 2, borderRadius: radius.md, alignItems: 'center', padding: 13 },
});
