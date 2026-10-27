import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { API_URL } from '@/api';
import { Button, Text } from '@/components/ui';
import { parseServiceStatus, serviceAdvisoryKey, serviceStatusUrl,
  type ServiceStatus } from '@/lib/maintenance-status';
import { spacing, useTheme } from '@/theme';

/** Public notices only; backend continues to enforce all financial and tenant access. */
export function ServiceAdvisory({ tenant, enabled }: { tenant: string | null; enabled: boolean }) {
  const { c } = useTheme();
  const [snapshot, setSnapshot] = useState<{ key: string; data: ServiceStatus } | null>(null);
  const [unknownScope, setUnknownScope] = useState<string | null>(null);
  const [openScope, setOpenScope] = useState<string | null>(null);
  const prompted = useRef(new Set<string>());
  const key = tenant || 'global';
  const unknown = unknownScope === key;
  const opened = openScope === key;

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const url = serviceStatusUrl(API_URL, tenant);
        const res = await fetch(url, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
        if (!res.ok) throw new Error('Maintenance service unavailable');
        const parsed = parseServiceStatus(await res.json());
        if (!parsed) throw new Error('Invalid maintenance status');
        if (alive) { setSnapshot({ key, data: parsed }); setUnknownScope(null); }
      } catch {
        // Never label a missing/unreachable server response as NORMAL.
        if (alive) { setSnapshot(null); setUnknownScope(key); }
      }
    };
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 45_000);
    const resumed = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => { alive = false; clearInterval(timer); resumed.remove(); };
  }, [key, tenant]);

  const status = snapshot?.key === key ? snapshot.data : null;
  const noticeKey = status ? serviceAdvisoryKey(status, tenant) : '';
  useEffect(() => {
    if (!enabled || !noticeKey || prompted.current.has(noticeKey)) return;
    prompted.current.add(noticeKey);
    setOpenScope(key);
  }, [enabled, noticeKey, key]);

  if (!enabled) return null;
  const active = Boolean(status && status.mode !== 'NORMAL');
  const visible = active || Boolean(status?.notices.length) || unknown;
  if (!visible) return null;
  const label = unknown ? 'Service status unavailable' :
    status?.mode === 'FULL' ? 'Maintenance in progress' :
      status?.mode === 'READ_ONLY' ? 'CLEAR is in read-only mode' : 'Scheduled maintenance notice';
  const time = (iso: string) => {
    const value = new Date(iso);
    if (!Number.isFinite(value.getTime())) return 'Time unavailable';
    return value.toLocaleString('en-PH', { timeZone: 'Asia/Manila',
      dateStyle: 'medium', timeStyle: 'short' }) + ' PHT';
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="View CLEAR maintenance status"
        onPress={() => setOpenScope(key)}
        style={[styles.banner, { backgroundColor: c.soft, borderColor: c.border }]}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" color="inkMuted">View details</Text>
      </Pressable>
      <Modal visible={opened} animationType="slide" onRequestClose={() => setOpenScope(null)}>
        <ScrollView contentContainerStyle={[styles.modal, { backgroundColor: c.canvas }]}>
          <Text variant="title" accessibilityRole="header">{label}</Text>
          {unknown ? (
            <Text variant="bodySm" color="dangerInk">We cannot confirm CLEAR service availability.
              Please retry. The server independently safeguards transactions and restricted records.</Text>
          ) : (
            <>
              <Text variant="bodySm">
                {status?.mode === 'FULL' ? 'CLEAR services are temporarily unavailable.' :
                  status?.mode === 'READ_ONLY' ?
                    'You may view permitted records. Changes and financial transactions are temporarily unavailable.' :
                    'Review the following service notice before continuing.'}
              </Text>
              {active && status?.reason ? <Text variant="bodySm">{status.reason}</Text> : null}
              {status?.effectiveUntil ? <Text variant="caption" color="inkMuted">
                Expected restoration: {time(status.effectiveUntil)}</Text> : null}
              {(status?.notices ?? []).map(n => (
                <View key={n.id + ':' + n.revision} style={[styles.notice, { borderColor: c.border }]}>
                  <Text variant="bodyStrong">{n.state === 'ACTIVE' ? 'IN PROGRESS' : 'UPCOMING'} · {n.title}</Text>
                  <Text variant="bodySm">{n.message}</Text>
                  <Text variant="caption" color="inkMuted">{time(n.startsAt)} – {time(n.endsAt)}</Text>
                </View>
              ))}
            </>
          )}
          <Button block onPress={() => setOpenScope(null)}>I understand</Button>
          <Text variant="caption" color="inkMuted">Times shown in Philippine Time (PHT). Advisory only:
            server-side maintenance and role permissions are authoritative.</Text>
        </ScrollView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  banner: { position: 'absolute', bottom: 12, left: 16, right: 16,
    borderWidth: 1, borderRadius: 14, padding: spacing[3], gap: 4, zIndex: 20 },
  modal: { flexGrow: 1, gap: spacing[4], padding: spacing[5], paddingTop: 64 },
  notice: { borderWidth: 1, borderRadius: 12, padding: spacing[3], gap: spacing[2] },
});
