import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api';
import { Banner, Button, Text } from '@/components/ui';
import { getItem } from '@/lib/secure-storage';
import { useOfficerSession } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

const MODULES: Array<{ tab: string; title: string; detail: string }> = [
  { tab: 'tab-overview', title: 'Your overview', detail: 'View current-term balances, collections, expenses and unliquidated amounts. Android financial posting is disabled.' },
  { tab: 'tab-students', title: 'Student roster', detail: 'Review only the authorized tenant student records and current term enrollment state.' },
  { tab: 'tab-clearance', title: 'Student clearance', detail: 'Verify a student within your granted role. Students must verify their own registered email.' },
  { tab: 'tab-payment', title: 'Collections', detail: 'Review receipts and payments. New payment posting is currently available only through approved web workflows.' },
  { tab: 'tab-remittances', title: 'Remittance queue', detail: 'Review pending proof information. Do not approve a transaction without checking reference, amount and destination fund.' },
  { tab: 'tab-advances', title: 'Cash advances', detail: 'Review outstanding advances and supporting liquidation records before requesting changes on the web.' },
  { tab: 'tab-audit', title: 'Audits', detail: 'Consult liquidation and audit records within your role permissions.' },
  { tab: 'tab-collectibles', title: 'Collectibles', detail: 'Check authorized student dues; historical debts remain separate from new-term package fees.' },
  { tab: 'tab-users', title: 'Account access', detail: 'Officers can review their profile. Roles and administrative permissions remain tenant-admin controlled.' },
];

export function OfficerWalkthrough({ auto = true, onClose }: { auto?: boolean; onClose?: () => void }) {
  const session = useOfficerSession();
  const { c } = useTheme();
  const exempt = session.officer.role.toLowerCase() === 'superadmin';
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState(0);
  const [tabs, setTabs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const steps = useMemo(() => [
    { title: 'Welcome to CLEAR', detail: 'Your guide is based only on your current department role and its authorized modules.' },
    ...MODULES.filter(m => tabs.includes(m.tab)).map(m => ({ title: m.title, detail: m.detail })),
    { title: 'Confirm before changing data', detail: 'On web, review the student, amount, period, consequences and audit trail before confirming. Mobile financial actions remain read-only.' },
    { title: 'Privacy and collaboration', detail: 'Your role limits access to student and officer information. Initials are visible only to authorized officers viewing the same page and term.' },
  ], [tabs.join('|')]);

  useEffect(() => {
    if (exempt) return;
    let alive = true;
    void api.getOfficerOnboarding(session).then(result => {
      if (!alive || result.exempt) return;
      setTabs(result.tabs);
      if (!auto) { setVisible(true); return; }
      if (result.completed) return;
      // The mandatory Data Privacy notice is presented first by RootLayout.
      let presented = false;
      const check = async () => {
        if (presented || !alive) return;
        try {
          if (await getItem('clear_privacy_notice_ack_v1') === 'true' && alive) {
            presented = true;
            cleanupTimer?.();
            setVisible(true);
          }
        } catch { /* without local privacy acknowledgement, no walkthrough */ }
      };
      const timer = setInterval(() => void check(), 2500);
      cleanupTimer = () => clearInterval(timer);
      void check();
    }).catch(() => { if (alive) setError('Unable to retrieve walkthrough details.'); });
    let cleanupTimer: (() => void) | undefined;
    return () => { alive = false; cleanupTimer?.(); };
  }, [session.token, exempt, auto]);

  const finish = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api.completeOfficerOnboarding(session);
      setVisible(false);
      onClose?.();
    } catch {
      // A failed metadata write must not trap an officer in onboarding.
      // No completion is recorded, so the guide reappears next login.
      setVisible(false);
      onClose?.();
    } finally { setBusy(false); }
  };

  if (exempt) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen"
      onRequestClose={() => void finish()}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: c.canvas }]}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text variant="caption" color="inkMuted">CLEAR · First-time guide</Text>
          <Text variant="title" accessibilityRole="header">{steps[stage]?.title}</Text>
          <Text variant="body">{steps[stage]?.detail}</Text>
          <Text variant="caption" color="inkMuted">
            Step {stage + 1} of {steps.length} · Your permissions are always checked on the server
          </Text>
          {error ? <Banner tone="danger" title="Walkthrough unavailable">{error}</Banner> : null}
        </ScrollView>
        <View style={[styles.actions, { borderTopColor: c.border }]}>
          <Button block variant="secondary" disabled={busy} onPress={() => void finish()}>Skip guide</Button>
          <View style={styles.row}>
            {stage > 0 ? <View style={styles.half}><Button block variant="secondary" disabled={busy} onPress={() => setStage(n => n - 1)}>Back</Button></View> : null}
            <View style={styles.half}>
              <Button block disabled={busy} onPress={() => stage === steps.length - 1 ? void finish() : setStage(n => n + 1)}>
                {stage === steps.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </View>
          </View>
          {busy ? <ActivityIndicator color={c.cobalt} /> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, padding: spacing[5], gap: spacing[5], justifyContent: 'center' },
  actions: { borderTopWidth: 1, padding: spacing[4], gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end' },
  half: { minWidth: 125, flex: 1 },
});
