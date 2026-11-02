// Read-only Void Center audit browsing, authorized by the canonical web tab.
// All void/reversal decisions still happen on the separately authenticated web.
import { ActivityIndicator, View } from 'react-native';
import { api } from '@/api';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { openDepartmentModule } from '@/lib/links';
import { formatPeso, fromCentavos } from '@/lib/money';
import { useOfficerSession, useSession } from '@/lib/session';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { useVoidAuditPages } from '@/lib/use-void-audit-pages';
import { spacing, useTheme } from '@/theme';

export default function VoidAudit() {
  const s = useOfficerSession();
  const { can } = useSession();
  const { c } = useTheme();
  const allowed = can('tab-void');
  const pages = useVoidAuditPages((cursor) => api.listVoidAudit(s, cursor),
    `${s.org.subdomain}:${s.token}:void-audit`, allowed);
  return (
    <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
      contentStyle={{ gap: spacing[3], paddingTop: spacing[3] }}>
      <Text variant="title" accessibilityRole="header">Void audit</Text>
      <Banner tone="info" title="Authorized · read only">
        Records are from the existing web Void Center for this tenant, across all academic periods.
        Only officers granted Void access can browse. No reversal is performed here.
      </Banner>
      {!allowed ? <Banner tone="warning" title="Void permission required">
        Your account does not have Void Center permission.
      </Banner> : null}
      {pages.loading ? <ActivityIndicator color={c.cobalt} /> : null}
      {pages.error ? <Banner tone="danger" title="Unable to load Void audit">{pages.error.message}</Banner> : null}
      {pages.records ? (
        <>
          <Text variant="caption" color="inkMuted">
            {pages.records.length} loaded audit records{pages.hasMore ? ' · Older records available' : ' · All available audit pages loaded'}.
          </Text>
          {pages.records.length === 0 ? <Banner tone="info" title="No Void audit records">
            No void records were returned for this tenant.
          </Banner> : null}
          {pages.records.map(row => (
            <Card key={row.id}>
              <View style={{ gap: spacing[1] }}>
                <Text variant="bodyStrong">{row.reference}</Text>
                <Text variant="bodySm">{row.kind}</Text>
                <Text variant="caption" color="inkMuted">{row.when}</Text>
                <Text variant="bodySm">{row.reason}</Text>
                <Text variant="bodyStrong">{formatPeso(fromCentavos(row.amountCentavos))}</Text>
              </View>
            </Card>
          ))}
          {pages.pageError ? <Banner tone="danger" title="Unable to load older records">{pages.pageError.message}</Banner> : null}
          {pages.hasMore ? <Button block variant="secondary" onPress={() => void pages.loadMore()}>
            {pages.loadingMore ? 'Loading older records…' : 'Load older Void records'}
          </Button> : null}
          <Button block variant="secondary" onPress={pages.reload}>Refresh audit</Button>
        </>
      ) : null}
      {allowed ? <Button block variant="secondary"
        onPress={() => void openDepartmentModule(s.org.subdomain, '/void')}>
        Open audited Void actions on secure web
      </Button> : null}
    </Screen>
  );
}
