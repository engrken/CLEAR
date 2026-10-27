import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { getItem, setItem } from '@/lib/secure-storage';
import { spacing, useTheme } from '@/theme';

const STEPS = [
  {
    title: 'Welcome to your clearance guide',
    detail: 'Check your own clearance status for the selected department and active academic period. No officer account is required.',
  },
  {
    title: 'Enter your registered details',
    detail: 'Enter your exact Student ID and your registered email, then request a verification code. Requests never confirm whether a student record exists.',
  },
  {
    title: 'Verify your email',
    detail: 'Enter the six-digit code delivered to your registered email. It expires after five minutes. Never share your code with anyone.',
  },
  {
    title: 'Understand your status',
    detail: 'CLEARED means your clearance is complete for the displayed term. CLEARANCE ON HOLD means you should contact an authorized officer for details. NOT ENROLLED THIS TERM does not mean cleared. Student results do not show itemized transactions.',
  },
  {
    title: 'Finish securely',
    detail: 'Choose Finish secure inquiry when done, especially on a shared device. Your temporary clearance verification session expires after ten minutes. Contact your department administrator if you cannot access the registered email.',
  },
] as const;

/**
 * Public, display-only tutorial. The sole persistent value is a local,
 * per-department completion flag. Never persist student identity, OTP,
 * bearer token or clearance result through this component.
 */
export function StudentClearanceGuide({ department }: { department: string }) {
  const { c } = useTheme();
  const key = 'clear_student_guide_v1_' + department.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    let finished = false;
    let checking = false;
    const check = async () => {
      if (!alive || finished || checking) return;
      checking = true;
      try {
        if (await getItem(key) === 'true') {
          finished = true;
        } else if (await getItem('clear_privacy_notice_ack_v1') === 'true' && alive) {
          // The root modal requires the privacy acknowledgement first.
          finished = true;
          setStep(0);
          setVisible(true);
        }
      } catch {
        // Optional guidance cannot block private clearance inquiry.
        finished = true;
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key]);

  const dismiss = useCallback(() => {
    setVisible(false);
    void setItem(key, 'true').catch(() => {
      // Optional preference, not a security or consent record.
    });
  }, [key]);

  return (
    <>
      <View style={styles.replay}>
        <Button size="sm" variant="secondary" onPress={() => {
          setStep(0);
          setVisible(true);
        }}>
          How to check my clearance
        </Button>
      </View>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen"
        onRequestClose={dismiss} accessibilityViewIsModal>
        <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: c.canvas }]}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text variant="caption" color="inkMuted">CLEAR · Student guide</Text>
            <Text variant="title" accessibilityRole="header">{STEPS[step].title}</Text>
            <Text variant="body">{STEPS[step].detail}</Text>
            <Text variant="caption" color="inkMuted">Step {step + 1} of {STEPS.length}</Text>
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: c.border }]}>
            <Button block variant="secondary" onPress={dismiss}>Skip guide</Button>
            <View style={styles.row}>
              {step > 0 ? (
                <View style={styles.half}>
                  <Button block variant="secondary" onPress={() => setStep(s => s - 1)}>Back</Button>
                </View>
              ) : null}
              <View style={styles.half}>
                <Button block onPress={() => step === STEPS.length - 1 ? dismiss() : setStep(s => s + 1)}>
                  {step === STEPS.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  replay: { alignItems: 'flex-start' },
  body: { flexGrow: 1, padding: spacing[5], gap: spacing[5], justifyContent: 'center' },
  actions: { borderTopWidth: 1, padding: spacing[4], gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end' },
  half: { minWidth: 115, flex: 1 },
});
