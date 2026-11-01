import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { useGlobalSession, useSession } from '@/lib/session';
import { spacing } from '@/theme';
import { BiometricSettings } from '@/components/security/BiometricSettings';

/** Native global-account identity and session controls; no unsupported email edits. */
export default function GlobalAccount() {
  const { admin, expiresAt, token } = useGlobalSession();
  const { signOut } = useSession();
  const router = useRouter();
  return (
    <Screen edges={['top']} contentStyle={{ gap: spacing[3], paddingTop: spacing[5], paddingBottom: spacing[8] }}>
      <Button variant="secondary" onPress={() => router.back()}>Back to dashboard</Button>
      <Text variant="display" accessibilityRole="header">My Account & Security</Text>
      <Card>
        <View style={{ gap: spacing[2] }}>
          <Text variant="bodyStrong">Account identity</Text>
          <Text variant="bodySm">{admin.fullName}</Text>
          <Text variant="bodySm">{admin.email}</Text>
          <Text variant="caption" color="inkMuted">Global Administrator</Text>
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing[2] }}>
          <Text variant="bodyStrong">Session security</Text>
          <Text variant="bodySm" color="inkMuted">Session expires: {new Date(expiresAt).toLocaleString()}</Text>
          <Text variant="bodySm" color="inkMuted">Account access is protected by server-verified one-time codes. Signing out revokes the current session when online and clears the local session.</Text>
        </View>
      </Card>
      <Card><BiometricSettings identity={{ kind: "global", id: admin.id, token }} /></Card>
      <Button block variant="ink" onPress={() => void signOut()}>Sign out of this device</Button>
    </Screen>
  );
}
