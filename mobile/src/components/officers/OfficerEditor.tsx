// Simple native officer editor. The server returns canonical web role presets;
// each attempted mutation still requires a tenant-scoped server action grant.
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api, type TenantUserRecord, type TenantUserManagementChange } from '@/api';
import { Banner, Button, Card, Text } from '@/components/ui';
import { MODULE_CATALOG } from '@/lib/module-access';
import { useOfficerSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';

const ROLES = ['admin', 'treasurer', 'auditor', 'viewer'] as const;
type Props = {
  record: TenantUserRecord | null;
  rolePresets: Record<string, string[]>;
  onSaved: () => void;
  onCancel: () => void;
};
const cleanRole = (role: string) =>
  ['administrator', 'master', 'admin'].includes(role.toLowerCase()) ? 'admin' : role.toLowerCase();

export function OfficerEditor({ record, rolePresets, onSaved, onCancel }: Props) {
  const session = useOfficerSession();
  const { c } = useTheme();
  const [form, setForm] = useState<TenantUserManagementChange>(() => {
    const role = cleanRole(record?.role || 'viewer');
    return {
      action: record ? 'update' : 'create',
      ...(record ? { id: record.id, expectedUpdatedAt: record.updatedAt } : {}),
      fullName: record?.fullName || '', email: record?.email || '',
      username: record?.username || '', role,
      status: record?.status || 'Active',
      allowedTabs: record?.allowedTabs.length
        ? [...record.allowedTabs] : [...(rolePresets[role] || [])],
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const roleOptions = ROLES.filter(role => Array.isArray(rolePresets[role]));
  const roleValid = roleOptions.some(role => role === form.role);
  const roleTabs = rolePresets[form.role] || [];
  const setField = (key: 'fullName' | 'email' | 'username', value: string) =>
    setForm(previous => ({ ...previous, [key]: value }));

  function submit() {
    if (!roleValid || submitting.current) return;
    const normalized = {
      ...form, fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      username: form.username.trim().toLowerCase(),
    };
    if (!normalized.fullName || !normalized.email || !normalized.username) {
      setError('Full name, email and username are required.');
      return;
    }
    Alert.alert(record ? 'Update officer?' : 'Create officer?',
      'This action changes tenant permissions and is recorded in the audit log. Existing mobile sessions are revoked when an officer is updated.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => {
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        void api.manageTenantUser(session, normalized)
          .then(onSaved)
          .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to save officer. Refresh and retry.'))
          .finally(() => { submitting.current = false; setBusy(false); });
      } }]);
  }

  return <Card style={styles.form}>
    <Text variant="headline">{record ? 'Edit officer' : 'Add officer'}</Text>
    <Text variant="caption" color="inkMuted">
      Tenant: {session.org.name}. The web server validates your role, permissions and requested change again before saving.
    </Text>
    {error ? <Banner tone="danger" title="Not saved">{error}</Banner> : null}
    {(['fullName', 'email', 'username'] as const).map(field => (
      <View key={field} style={styles.inputGroup}>
        <Text variant="bodySm">{field === 'fullName' ? 'Full name' : field === 'email' ? 'Login email' : 'Username'}</Text>
        <TextInput
          accessibilityLabel={field === 'fullName' ? 'Officer full name' : field === 'email' ? 'Officer email' : 'Officer username'}
          value={form[field]} editable={!busy}
          onChangeText={value => setField(field, value)}
          autoCapitalize={field === 'fullName' ? 'words' : 'none'}
          autoCorrect={false}
          keyboardType={field === 'email' ? 'email-address' : 'default'}
          maxLength={field === 'fullName' ? 120 : field === 'email' ? 254 : 48}
          style={[styles.input, { backgroundColor: c.soft, color: c.ink }]}
        />
      </View>
    ))}
    <Text variant="bodyStrong">Role</Text>
    <View style={styles.choices}>
      {roleOptions.map(role => (
        <Pressable key={role} accessibilityRole="radio"
          accessibilityState={{ selected: form.role === role }}
          disabled={busy} onPress={() => setForm(previous => ({
            ...previous, role, allowedTabs: [...rolePresets[role]],
          }))}
          style={[styles.choice, { backgroundColor: form.role === role ? c.inkBlock : c.soft }]}>
          <Text variant="bodySm" color={form.role === role ? 'onAccent' : 'ink'}>{role}</Text>
        </Pressable>
      ))}
    </View>
    {!roleValid ? <Banner tone="warning" title="Web-only role">
      This role is not supported by native editing. Use the secure web administrator workflow.
    </Banner> : null}
    <Text variant="bodyStrong">Status</Text>
    <View style={styles.choices}>
      {(['Active','Inactive','Blocked'] as const).map(status => (
        <Pressable key={status} disabled={busy} accessibilityRole="radio"
          accessibilityState={{ selected: form.status === status }}
          onPress={() => setForm(previous => ({ ...previous, status }))}
          style={[styles.choice, { backgroundColor: form.status === status ? c.inkBlock : c.soft }]}>
          <Text variant="bodySm" color={form.status === status ? 'onAccent' : 'ink'}>{status}</Text>
        </Pressable>
      ))}
    </View>
    <Text variant="bodyStrong">Module permissions</Text>
    {form.role === 'admin' ? <Banner tone="info" title="Full administrator">
      As on web, administrators inherit every module grant. Custom restrictions cannot override this role.
    </Banner> : <>
      <Text variant="caption" color="inkMuted">
        Select specific permissions. Clearing all permissions restores the role defaults on save.
      </Text>
      <View style={styles.choices}>
        {MODULE_CATALOG.map(module => {
          const selected = form.allowedTabs.includes(module.tab);
          return <Pressable key={module.tab} disabled={busy} accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => setForm(previous => ({
              ...previous,
              allowedTabs: selected
                ? previous.allowedTabs.filter(tab => tab !== module.tab)
                : [...previous.allowedTabs, module.tab],
            }))}
            style={[styles.choice, { backgroundColor: selected ? c.inkBlock : c.soft }]}>
            <Text variant="caption" color={selected ? 'onAccent' : 'ink'}>{module.name}</Text>
          </Pressable>;
        })}
      </View>
    </>}
    <Text variant="caption" color="inkMuted">
      {form.role === 'admin' ? roleTabs.length : form.allowedTabs.length} permissions selected · Web role presets are authoritative.
    </Text>
    {busy ? <ActivityIndicator color={c.cobalt}/> : null}
    <View style={styles.actions}>
      <Button size="sm" variant="secondary" onPress={onCancel} disabled={busy}>Cancel</Button>
      <Button size="sm" onPress={submit} disabled={busy || !roleValid}>
        {busy ? 'Saving…' : record ? 'Save officer' : 'Create officer'}
      </Button>
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  form: { gap: spacing[3], padding: 14 },
  inputGroup: { gap: spacing[1] },
  input: { minHeight: 48, paddingHorizontal: 12, borderRadius: radius.md, fontSize: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  choice: { minHeight: 42, justifyContent: 'center', borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
