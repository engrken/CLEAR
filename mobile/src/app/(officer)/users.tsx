// Native Officer Management: non-financial account status administration.
// Server independently enforces web Admin/tenant role policy and audit logging.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { api, type TenantUserRecord, type TenantUsersPage } from '@/api';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { OfficerEditor } from '@/components/officers/OfficerEditor';
import { openDepartmentModule } from '@/lib/links';
import { canOfferMobileWrite } from '@/lib/write-permissions';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/theme';

function isAdministrator(role: string) {
  return ['admin', 'administrator', 'master'].includes(role.trim().toLowerCase());
}
const EMPTY: TenantUsersPage = { records: [], hasMore: false, nextCursor: null };

export default function OfficerManagement() {
  const s = useOfficerSession();
  const { can } = useSession();
  const { c } = useTheme();
  const authorized = can('tab-users') && isAdministrator(s.officer.role);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ scope: string; officer: TenantUserRecord | null } | null>(null);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const delay = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(delay);
  }, [query]);
  const key = `${s.org.subdomain}:${s.token}:${authorized}:${search}:${revision}`;
  const result = useAsync(
    () => authorized ? api.listTenantUsers(s, search) : Promise.resolve(EMPTY),
    key,
  );
  const capability = useAsync(
    () => authorized ? api.getWriteCapabilities(s) : Promise.resolve({ enabled: false, grants: [] }),
    `${s.org.subdomain}:${s.token}:users-grant:${authorized}`,
  );
  const mayUpdate = authorized && canOfferMobileWrite(
    capability.data, 'tenant.users.status', s.org.subdomain,
  );
  const mayManage = authorized &&
    canOfferMobileWrite(capability.data, 'tenant.users.manage', s.org.subdomain) &&
    canOfferMobileWrite(capability.data, 'tenant.roles.manage', s.org.subdomain);
  const [extra, setExtra] = useState<{ key: string; records: TenantUserRecord[];
    cursor: string | null; hasMore: boolean } | null>(null);
  const [paging, setPaging] = useState(false);
  const pageBusy = useRef(false);
  const page = !result.loading ? result.data : null;
  const editorScope = s.org.subdomain + ':' + s.token;
  const activeEditor = mayManage && editing?.scope === editorScope ? editing : null;
  const extended = extra?.key === key ? extra : null;
  const records = page ? [...page.records, ...(extended?.records ?? [])] : [];
  const nextCursor = extended ? extended.cursor : page?.nextCursor;
  const hasMore = extended ? extended.hasMore : page?.hasMore;

  async function loadMore() {
    if (!authorized || !nextCursor || !hasMore || pageBusy.current) return;
    const expected = key;
    pageBusy.current = true;
    setPaging(true);
    setError('');
    try {
      const response = await api.listTenantUsers(s, search, nextCursor);
      setExtra(previous => {
        const prior = previous?.key === expected ? previous.records : [];
        const seen = new Set([...page?.records ?? [], ...prior].map(u => u.id));
        return { key: expected, records: [...prior, ...response.records.filter(u => !seen.has(u.id))],
          cursor: response.nextCursor, hasMore: response.hasMore };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load older accounts.');
    } finally {
      pageBusy.current = false;
      setPaging(false);
    }
  }

  function changeStatus(user: TenantUserRecord, status: 'Active' | 'Inactive' | 'Blocked') {
    if (!mayUpdate || saving.current || user.status === status) return;
    if (user.id === s.officer.id && status !== 'Active') {
      setError('You cannot disable your own signed-in administrator account.');
      return;
    }
    Alert.alert('Confirm account status', `${user.fullName} → ${status}.\n\nDisabling an account revokes its existing mobile sessions. This change is logged and follows the web application permission rules.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm status', onPress: () => {
        if (saving.current) return;
        saving.current = true;
        setBusy(user.id);
        setError('');
        void api.updateTenantUserStatus(s, {
          id: user.id, status, expectedUpdatedAt: user.updatedAt,
        }).then(() => { setRevision(n => n + 1); setExtra(null); },
          cause => setError(cause instanceof Error ? cause.message : 'Status update failed. Refresh and retry.'))
          .finally(() => { saving.current = false; setBusy(null); });
      } },
    ]);
  }

  return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
    contentStyle={{ gap: spacing[3], paddingTop: spacing[3] }}>
    <Text variant="title" accessibilityRole="header">Officer management</Text>
    {!authorized ? <Banner tone="warning" title="Administrator only">
      Your web role must include department administrator access to manage officers.
    </Banner> : <>
      <Banner tone="info" title="Same rules as web">
        Officer creation, role/permission editing and status changes require independently
        server-issued management grants. Every change is tenant-scoped and audited.
      </Banner>
      <TextInput value={query} onChangeText={setQuery} autoCorrect={false}
        autoCapitalize="none" maxLength={80} placeholder="Search officers or email"
        accessibilityLabel="Search tenant officers"
        placeholderTextColor={c.inkMuted}
        style={[styles.search, { backgroundColor: c.soft, color: c.ink }]} />
      {capability.loading ? <ActivityIndicator color={c.cobalt}/> : null}
      {!mayUpdate ? <Banner tone="info" title="Status edits controlled by web">
        Native status editing is not yet enabled for this deployment or account.
        Your authorized web administration remains available.
      </Banner> : null}
      {result.loading ? <ActivityIndicator color={c.cobalt}/> : null}
      {mayManage && !activeEditor && page?.rolePresets ? <Button block variant="secondary" onPress={() => setEditing({ scope: editorScope, officer: null })}>
        Add officer
      </Button> : null}
      {activeEditor && page?.rolePresets ? <OfficerEditor
        key={activeEditor.officer?.id || 'new'} record={activeEditor.officer}
        rolePresets={page.rolePresets}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); setRevision(n => n + 1); setExtra(null); }}
      /> : null}
      {result.error ? <Banner tone="danger" title="Cannot load officers">{result.error.message}</Banner> : null}
      {error ? <Banner tone="danger" title="Action not completed">{error}</Banner> : null}
      {page ? <>
        <Text variant="caption" color="inkMuted">
          {records.length} officers loaded{hasMore ? ' · More available' : ''}.
        </Text>
        {records.map(user => <Card key={user.id} style={styles.card}>
          <Text variant="bodyStrong">{user.fullName}</Text>
          <Text variant="bodySm" color="inkMuted">{user.email}</Text>
          <Text variant="caption" color="inkMuted">{user.role} · {user.status}</Text>
          {mayManage && page?.rolePresets && user.id !== s.officer.id ? <Button size="sm" variant="secondary"
            disabled={busy !== null}
            onPress={() => setEditing({ scope: editorScope, officer: user })}>
            Edit role / permissions
          </Button> : null}
          {mayUpdate ? <View style={styles.row}>
            {(['Active', 'Inactive', 'Blocked'] as const).filter(status => status !== user.status)
              .map(status => <Button key={status} size="sm" variant="secondary"
                disabled={busy !== null}
                onPress={() => changeStatus(user, status)}>
                {busy === user.id ? 'Saving…' : status}
              </Button>)}
          </View> : null}
        </Card>)}
        {page.records.length === 0 ? <Banner tone="info" title="No officers found">
          Try another name, email address or username.
        </Banner> : null}
        {hasMore ? <Button block variant="secondary" disabled={paging}
          onPress={() => void loadMore()}>
          {paging ? 'Loading officers…' : 'Load more officers'}
        </Button> : null}
        <Button block variant="secondary"
          onPress={() => { setRevision(n => n + 1); setExtra(null); }}>
          Refresh officers
        </Button>
      </> : null}
      <Button block variant="secondary"
        onPress={() => void openDepartmentModule(s.org.subdomain, '/users')}>
        Open full web officer management
      </Button>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  search: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 15, fontSize: 16 },
  card: { gap: spacing[2], padding: 14 },
  row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
});
