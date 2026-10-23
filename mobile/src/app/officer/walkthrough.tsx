import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { OfficerWalkthrough } from '@/components/collaboration/OfficerWalkthrough';
import { BackHeader, Screen, Text } from '@/components/ui';

export default function ReplayOfficerWalkthrough() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom']} header={<BackHeader title="Role-specific guide" onBack={() => router.back()} />}>
      <View style={{ padding: 20 }}>
        <Text variant="bodySm">Your first-time guide explains only authorized modules and safe transaction practices.</Text>
        <OfficerWalkthrough auto={false} onClose={() => router.back()} />
      </View>
    </Screen>
  );
}
