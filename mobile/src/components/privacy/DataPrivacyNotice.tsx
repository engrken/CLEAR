import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { PRIVACY_URL, openWebPage } from '@/lib/links';
import { spacing, useTheme } from '@/theme';

/**
 * Mobile counterpart of the CLEAR web DataPrivacyModal.
 * This acknowledges a notice; it never grants access or overrides RBAC/OTP.
 */
export function DataPrivacyNotice({ visible, onDismiss, required = false }: {
  visible: boolean;
  onDismiss: () => void;
  required?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => { if (!required) onDismiss(); }}>
      <SafeAreaView style={[styles.wrap, { backgroundColor: c.canvas }]} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator
          accessibilityLabel="Data Privacy Notice and Consent">
          <Text variant="headline" accessibilityRole="header">Data Privacy Notice &amp; Consent</Text>
          <Text variant="bodySm" color="inkMuted">
            In compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173),
            CLEAR System is committed to protecting your personal and academic information.
          </Text>

          <Text variant="bodyStrong">1. Information We Process</Text>
          <Text variant="bodySm" color="inkMuted">
            The Centralized Liquidation of Expenses &amp; Audit Records (CLEAR) portal collects
            and verifies Student ID, Full Name, Year Level, Institutional/Personal Email,
            and financial transaction records, including receipt numbers, fees paid and
            online remittance slips.
          </Text>
          <Text variant="bodySm" color="inkMuted">
            Mask or redact personal mobile numbers and remaining e-wallet balances before
            submitting payment screenshots.
          </Text>

          <Text variant="bodyStrong">2. Purpose of Processing</Text>
          <Text variant="bodySm" color="inkMuted">
            Data is used to verify departmental fee obligations, penalties and clearance
            sign-offs; maintain auditing and treasury ledgers; and generate live clearance
            verification signatures and QR codes.
          </Text>

          <Text variant="bodyStrong">3. Access and Storage</Text>
          <Text variant="bodySm" color="inkMuted">
            Itemized ledgers are available only to officers explicitly authorized for the
            relevant tenant and module. Students can view only their own clearance status
            after registered-email verification; financial details are not disclosed
            through the student inquiry.
          </Text>
          <Text variant="bodySm" color="inkMuted">
            Your mobile access is read-only. No acknowledgement changes your institutional
            permissions or permits financial postings.
          </Text>

          <Button block variant="secondary" onPress={() => void openWebPage(PRIVACY_URL)}>
            Read full privacy policy
          </Button>
          <Text variant="caption" color="inkMuted">
            CLEAR System · Centralized Liquidation of Expenses &amp; Audit Records
          </Text>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.canvas }]}>
          <Button block onPress={onDismiss}>
            {required ? 'I Understand & Agree' : 'Close privacy notice'}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[8] },
  footer: { borderTopWidth: 1, padding: spacing[4] },
});
