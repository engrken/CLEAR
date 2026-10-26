import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, View } from 'react-native';

import { api, type Session } from '@/api';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

type Page = 'overview' | 'students' | 'remittances';
type Colleague = { id: string; name: string };
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('') || '?';
// Presence IDs are collision-resistant tab markers, not authentication tokens.
const marker = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const n = Math.floor(Math.random() * 16);
  return (c === 'x' ? n : (n & 3) | 8).toString(16);
});

/** Same authorized tenant + module + active academic period, no private emails. */
export function OfficerPresence({ session, page }: { session: Session; page: Page }) {
  const { c } = useTheme();
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [count, setCount] = useState(0);
  const allowed = session.officer.role.toLowerCase() !== 'superadmin' &&
    (page === 'overview' ? session.officer.allowedTabs.includes('tab-overview') :
     page === 'students' ? session.officer.allowedTabs.some(t => ['tab-students', 'tab-payment'].includes(t)) :
     session.officer.allowedTabs.includes('tab-remittances'));

  useFocusEffect(useCallback(() => {
    if (!allowed) return;
    let active = true;
    const tabId = marker();
    const send = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const result = await api.pulseOfficerPresence(session, page, tabId);
        if (active) {
          setColleagues(result.colleagues);
          setCount(result.count);
        }
      } catch {
        if (active) { setColleagues([]); setCount(0); }
      }
    };
    const leave = () => {
      void api.leaveOfficerPresence(session, tabId).catch(() => {});
      if (active) { setColleagues([]); setCount(0); }
    };
    void send();
    const interval = setInterval(() => void send(), 30_000);
    const listener = AppState.addEventListener('change', status => {
      if (status === 'active') void send(); else leave();
    });
    return () => { active = false; clearInterval(interval); listener.remove(); leave(); };
  }, [session, page, allowed]));

  if (!allowed || count === 0) return null;
  return (
    <View style={styles.wrap} accessibilityLabel={`${count} other officers on this page`}>
      <Text variant="caption" color="inkMuted">On this page</Text>
      <View style={styles.row}>
        {colleagues.slice(0, 5).map(user => (
          <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={user.name}
            onPress={() => Alert.alert('Officer currently on this page', user.name)}
            style={[styles.avatar, { backgroundColor: c.cobaltTint, borderColor: c.cobalt }]}>
            <Text variant="caption" color="cobalt" style={styles.initials}>{initials(user.name)}</Text>
          </Pressable>
        ))}
        {count > 5 ? <Text variant="caption" color="inkMuted">+{count - 5}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2], paddingVertical: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  avatar: { width: 32, height: 32, borderRadius: radius.pill,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  initials: { fontFamily: 'Figtree_700Bold', fontSize: 11 },
});
