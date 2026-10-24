import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type CalendarMode, type NewTenant, type SubscriptionTier } from '@/api';
import { BackHeader, Banner, Button, Card, Screen, Text, TextField } from '@/components/ui';
import { useGlobalSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';

const startYear = new Date(Date.now() + 8 * 3600_000).getUTCFullYear();
const initial: NewTenant = {
  schoolGroup: 'default-school',
  name: '',
  subdomain: '',
  tier: 'Freemium',
  type: 'Department',
  initialAcademicYear: `A.Y. ${startYear} - ${startYear + 1}`,
  calendarMode: 'Semester',
  includeSummer: false,
  adminName: '',
  adminEmail: '',
  confirmation: '',
};

function Choice<T extends string>({ label, options, value, select }: {
  label: string; options: readonly T[]; value: T; select: (value: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.choices}>
      <Text variant="label">{label}</Text>
      <View style={styles.pills}>
        {options.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: value === item }}
            onPress={() => select(item)}
            style={[styles.pill, { backgroundColor: value === item ? c.inkBlock : c.soft }]}>
            <Text variant="bodySm" style={{ color: value === item ? c.onAccent : c.ink }}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ProvisionTenant() {
  const global = useGlobalSession();
  const router = useRouter();
  const [data, setData] = useState<NewTenant>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<{ department: string; message: string }>();
  const put = <K extends keyof NewTenant>(key: K, value: NewTenant[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));
  const slug = data.subdomain.trim().toLowerCase();
  const canSubmit = !busy && !!slug && data.confirmation === `PROVISION ${slug}`;

  const save = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.provisionTenant(global, { ...data, subdomain: slug });
      setCompleted({ department: result.department, message: result.message });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Provisioning could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  if (completed) {
    return (
      <Screen edges={['top','bottom']} header={<BackHeader title="New tenant ready" onBack={() => router.replace('/global/provisions')} />}>
        <Banner tone="success" title="Tenant and initial admin created">
          {completed.message}
        </Banner>
        <Card>
          <Text variant="bodyStrong">Tenant: {completed.department}</Text>
          <Text variant="bodySm" color="inkMuted">
            Fund pools and collection fees must be configured before payments can be processed. No fees or transactions were created by provisioning.
          </Text>
        </Card>
        <Button block onPress={() => router.replace('/global/provisions')}>View tenant management</Button>
        <Button block variant="secondary" onPress={() => router.push({
          pathname: '/global/tenant/[org]', params: { org: completed.department },
        })}>Open new tenant overview</Button>
      </Screen>
    );
  }

  return (
    <Screen edges={['top','bottom']} header={<BackHeader title="Provision new tenant" />}>
      <Banner tone="warning" title="Tenant provisioning — creates real records">
        This creates an organization, its accounting calendar, and an initial administrator in the currently authorized environment. Production changes require explicit server authorization and your Global Superadmin session. Confirm all details before proceeding.
      </Banner>
      {error ? <Banner tone="danger" title="Unable to provision">{error}</Banner> : null}

      <Text variant="headline">Tenant details</Text>
      <TextField label="School group ID" value={data.schoolGroup} onChangeText={(value) => put('schoolGroup', value.toLowerCase())} autoCapitalize="none" helper="Use the same tier as existing members. Freemium: 2, Pro: 10." />
      <TextField label="Department / organization name" value={data.name} onChangeText={(value) => put('name', value)} maxLength={150} />
      <TextField label="Unique tenant subdomain" value={data.subdomain} onChangeText={(value) => put('subdomain', value.toLowerCase())} autoCapitalize="none" maxLength={63} helper="Lowercase letters, numbers and internal hyphens." />
      <Choice label="Subscription tier" options={['Freemium', 'Pro', 'Corporate'] as const} value={data.tier} select={(v: SubscriptionTier) => put('tier', v)} />
      <Choice label="Entity type" options={['Department', 'Organization'] as const} value={data.type} select={(v) => put('type', v)} />

      <Text variant="headline">First accounting period</Text>
      <TextField label="Initial academic year" value={data.initialAcademicYear} onChangeText={(value) => put('initialAcademicYear', value)} helper="Example: A.Y. 2026 - 2027" />
      <Choice label="Academic calendar" options={['Semester', 'Trimester', 'FullYear'] as const} value={data.calendarMode} select={(v: CalendarMode) => {
        setData((prev) => ({ ...prev, calendarMode: v, includeSummer: v === 'Semester' && prev.includeSummer }));
      }} />
      {data.calendarMode === 'Semester' ? (
        <Choice label="Summer term" options={['No', 'Yes'] as const} value={data.includeSummer ? 'Yes' : 'No'} select={(v) => put('includeSummer', v === 'Yes')} />
      ) : null}

      <Text variant="headline">Initial department administrator</Text>
      <TextField label="Admin full name" value={data.adminName} onChangeText={(value) => put('adminName', value)} maxLength={150} />
      <TextField label="Admin email" value={data.adminEmail} onChangeText={(value) => put('adminEmail', value.toLowerCase())} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} maxLength={254} helper="Must be a tenant admin account, not a Global Superadmin email." />

      <Card>
        <View style={{ gap: 8 }}>
          <Text variant="bodyStrong">Final confirmation</Text>
          <Text variant="bodySm" color="inkMuted">
            To create this tenant, type PROVISION followed by its exact subdomain.
          </Text>
          <Text variant="bodyStrong">{`PROVISION ${slug || '<subdomain>'}`}</Text>
          <TextField label="Confirmation phrase" value={data.confirmation} onChangeText={(value) => put('confirmation', value)} autoCapitalize="characters" />
        </View>
      </Card>
      <Button block disabled={!canSubmit} loading={busy} onPress={() => void save()}>
        Provision tenant and administrator
      </Button>
      <Button block variant="ghost" onPress={() => router.replace('/global/provisions')}>Cancel and return</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8, paddingHorizontal: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: { borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
});
