import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api, type Student } from '@/api';
import { Avatar, Banner, Icon, Screen, StatusPill, Text, type Tone } from '@/components/ui';
import { OfficerPresence } from '@/components/collaboration/OfficerPresence';
import { enrollmentLabel, isEnrolled } from '@/lib/enrollment';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, type, useTheme } from '@/theme';

// Avatars rotate through the Bright Campus colours, picked from the name so a student keeps theirs.
const AVATAR_TONES: Tone[] = ['success', 'warning', 'info', 'danger'];
const avatarTone = (name: string): Tone => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

/** The department roster for the active term. */
export default function Students() {
  const session = useOfficerSession();
  const { can } = useSession();
  const { c } = useTheme();
  const [missingEmailOnly, setMissingEmailOnly] = useState(false);
  const students = useAsync(
    () => api.listStudents(session, undefined, can('tab-students') && missingEmailOnly),
    `${session.token}:missing-email:${can('tab-students') && missingEmailOnly}`,
  );
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);

  // Avoid showing the previous filter's roster while a scoped query loads.
  const current = students.loading ? undefined : students.data;
  const list = (current ?? []).filter(
    (s) => !q.trim() || s.fullName.toLowerCase().includes(q.toLowerCase()) || s.studentId.toLowerCase().includes(q.toLowerCase())
  );

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header" style={styles.heading}>Students</Text>
      {current ? (
        <Text variant="label" color="inkMuted">
          {current.length} {missingEmailOnly ? 'need email' : 'on roster'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top']} header={header} bottomInset={TAB_BAR_SPACE} contentStyle={{ gap: 10 }}>
      <OfficerPresence page="students" session={session} />
      <View style={[styles.search, { backgroundColor: focused ? c.ground : c.soft, borderColor: focused ? c.cobalt : 'transparent' }]}>
        <Icon name="search" size={18} color="inkMuted" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Name or student ID"
          placeholderTextColor={c.inkMuted}
          autoCorrect={false}
          accessibilityLabel="Search roster"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.searchInput, { color: c.ink }]}
        />
      </View>

      {can('tab-students') ? (
        <View style={{ gap: spacing[2] }}>
          <Pressable accessibilityRole="button"
            accessibilityState={{ selected: missingEmailOnly }}
            onPress={() => { setMissingEmailOnly(v => !v); setQ(''); }}
            style={[styles.emailFilter, { backgroundColor: missingEmailOnly ? c.inkBlock : c.soft }]}>
            <Text variant="bodyStrong" color={missingEmailOnly ? 'onAccent' : 'ink'}>
              {missingEmailOnly ? 'Show full student roster' : 'Students needing verified email'}
            </Text>
          </Pressable>
          {missingEmailOnly ? <Banner tone="info" title="Identity verification required">
            This is a read-only list. An authorized registrar must verify the student's identity before correcting their email in the secure web Students Roster. School ID alone cannot bypass OTP.
          </Banner> : null}
        </View>
      ) : null}
      {students.error ? (
        <Banner tone="danger" title="Couldn't load student roster">{students.error.message}</Banner>
      ) : null}
      {students.loading ? (
        <ActivityIndicator color={c.cobalt} />
      ) : current ? (
        <View style={{ gap: 6 }}>
          {list.map((s) => (
            <RosterRow key={s.id} student={s} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

/** One roster row; a student who is no longer enrolled is drawn quieter, on a dashed outline. */
function RosterRow({ student: s }: { student: Student }) {
  const { c } = useTheme();
  const active = isEnrolled(s.enrollmentStatus);
  return (
    <View
      style={[
        styles.row,
        active ? { backgroundColor: c.soft } : { backgroundColor: c.ground, borderWidth: 2, borderStyle: 'dashed', borderColor: c.border },
      ]}>
      <Avatar name={s.fullName} tone={active ? avatarTone(s.fullName) : 'neutral'} size={44} />
      <View style={styles.rowMain}>
        <Text variant="bodyStrong" color={active ? 'ink' : 'inkMuted'} numberOfLines={1}>{s.fullName}</Text>
        <Text variant="bodySm" color="inkMuted" numberOfLines={1}>
          <Text variant="code" color="inkMuted" style={{ fontSize: 13 }}>{s.studentId}</Text> · {s.yearLevel}
        </Text>
      </View>
      <StatusPill status={enrollmentLabel(s.enrollmentStatus)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3], paddingTop: 18, paddingHorizontal: 20, paddingBottom: 6 },
  heading: { fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 18,
    borderWidth: 3,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: spacing[3], ...type.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 1 },
  emailFilter: { paddingVertical: 13, paddingHorizontal: 15, borderRadius: radius.md, alignItems: 'center' },
});
