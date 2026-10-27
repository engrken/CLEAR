// Native read-only OR/VOID reference search. No business writes or secret
// storage. Each query is independently permissioned/tenant-bound on the API.
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api, type ReceiptReferenceSearch, type VoidReferenceSearch } from '@/api';
import { Banner, Button, Screen, Text } from '@/components/ui';
import { openDepartmentModule } from '@/lib/links';
import { useOfficerSession, useSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';

type Mode = 'receipts' | 'void';
export default function ReferenceSearch() {
  const s = useOfficerSession();
  const { can } = useSession();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const { c } = useTheme();
  const canReceipts = can('tab-payment'), canVoid = can('tab-void');
  const [mode, setMode] = useState<Mode>(kind === 'void' && canVoid ? 'void' : canReceipts ? 'receipts' : 'void');
  const [query, setQuery] = useState('');
  // Results are keyed to the exact query, tenant session, and search mode.
  // This prevents prior receipts/VOID results from appearing while a new search is pending.
  const [completedSearch, setCompletedSearch] = useState<{
    key: string;
    data?: ReceiptReferenceSearch | VoidReferenceSearch;
    error?: string;
  } | null>(null);
  const allowed = mode === 'void' ? canVoid : canReceipts;
  const searchKey = allowed && query.trim().length >= 3
    ? JSON.stringify([mode, s.token, query])
    : null;
  const currentSearch = searchKey && completedSearch?.key === searchKey ? completedSearch : null;
  const response = currentSearch?.data ?? null;
  const error = currentSearch?.error ?? '';
  const busy = Boolean(searchKey && !currentSearch);

  const changeQuery = (next: string) => {
    setQuery(next);
    setCompletedSearch(null);
  };
  const changeMode = (next: Mode) => {
    setMode(next);
    setCompletedSearch(null);
  };

  useEffect(() => {
    if (!searchKey) return;
    let active = true;
    // Reactive search is debounced, so each keystroke does not cause a DB read.
    const timer = setTimeout(() => {
      const lookup = mode === 'void'
        ? api.searchVoidReferences(s, query) : api.searchReceiptReferences(s, query);
      void lookup.then(data => {
        if (active) setCompletedSearch({ key: searchKey, data });
      }).catch(e => {
        if (active) setCompletedSearch({ key: searchKey, error: (e as Error).message });
      });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [searchKey, mode, query, s]);

  return (
    <Screen contentStyle={{ gap: spacing[3], paddingTop: spacing[3] }}>
      <Text variant="title" accessibilityRole="header">Receipt & Void reference search</Text>
      <Banner tone="info" title="Authorized · read only">
        Search your assigned tenant only. Searches show original financial history without permitting any posting or voiding.
      </Banner>
      <View style={styles.tabs}>
        {canReceipts ? <Pressable accessibilityRole="button" accessibilityState={{selected:mode==='receipts'}}
          onPress={() => changeMode('receipts')} style={[styles.pill,{backgroundColor:mode==='receipts'?c.inkBlock:c.soft}]}>
          <Text variant="bodyStrong" color={mode==='receipts'?'onAccent':'ink'}>Receipts</Text>
        </Pressable>:null}
        {canVoid ? <Pressable accessibilityRole="button" accessibilityState={{selected:mode==='void'}}
          onPress={() => changeMode('void')} style={[styles.pill,{backgroundColor:mode==='void'?c.inkBlock:c.soft}]}>
          <Text variant="bodyStrong" color={mode==='void'?'onAccent':'ink'}>Void audit</Text>
        </Pressable>:null}
      </View>
      <TextInput accessibilityLabel="Search authorized receipt or void references"
        placeholder={mode==='void'?'Search VOID reference or reason':'Search OR, student number, name or item'}
        placeholderTextColor={c.inkMuted} value={query} onChangeText={changeQuery}
        autoCorrect={false} autoCapitalize="none"
        style={[styles.input,{backgroundColor:c.soft,color:c.ink}]} />
      <Text variant="caption" color="inkMuted">
        {mode==='void'?'Void audit covers all periods of this tenant.':'Receipts are scoped to your tenant’s current academic period.'} Type at least 3 characters.
      </Text>
      {busy?<ActivityIndicator color={c.cobalt}/>:null}
      {error?<Banner tone="warning" title="Search unavailable">{error}</Banner>:null}
      {response && !response.records.length?<Banner tone="info" title={mode==='void'?'No matching Void audit records':'No matching receipts'}>
        {mode==='void'
          ? 'No Void audit record matches this search for your tenant. There may be no void transactions; the secure web Void Center provides the full audit.'
          : 'No receipt matches this query in the current period. Try a more specific reference or use secure web Receipt History.'}
      </Banner>:null}
      {response?.kind==='receipts' ? response.records.map(r=>(
        <View key={r.id} style={[styles.card,{backgroundColor:c.soft}]}>
          <Text variant="headline">{r.reference} · {r.status}</Text>
          <Text variant="bodySm">{r.name} · {r.studentNumber}</Text>
          <Text variant="caption" color="inkMuted">{r.allocationCount} allocation(s) · {r.description}</Text>
          <Text variant="bodyStrong">{r.amountPesos===null?'Amount inconsistent — review on web':'₱'+r.amountPesos.toFixed(2)}</Text>
          {r.inconsistent?<Text variant="bodySm" color="dangerInk">{r.inconsistent}</Text>:null}
        </View>
      )):null}
      {response?.kind==='void' ? response.records.map(r=>(
        <View key={r.id} style={[styles.card,{backgroundColor:c.soft}]}>
          <Text variant="headline">{r.reference}</Text>
          <Text variant="bodySm">{r.kind} · {r.when.slice(0,10)}</Text>
          <Text variant="caption" color="inkMuted">{r.reason}</Text>
          <Text variant="bodyStrong">{'₱'+(r.amountCentavos/100).toFixed(2)}</Text>
        </View>
      )):null}
      {canReceipts ? <Button block variant="secondary" onPress={()=>void openDepartmentModule(s.org.subdomain,'/collections/history')}>
        Open complete Receipt History (secure web)
      </Button>:null}
      {canVoid ? <Button block variant="secondary" onPress={()=>void openDepartmentModule(s.org.subdomain,'/void')}>
        Open complete Void Center (secure web)
      </Button>:null}
    </Screen>
  );
}
const styles=StyleSheet.create({
  tabs:{flexDirection:'row',gap:spacing[2]},
  pill:{borderRadius:radius.pill,paddingVertical:12,paddingHorizontal:20},
  input:{minHeight:52,borderRadius:radius.lg,paddingHorizontal:15,fontSize:16},
  card:{borderRadius:radius.lg,padding:spacing[3],gap:spacing[1]},
});
