// Authenticated non-certified snapshot. Canonical report exports and financial
// actions remain on secure web with independent sign-in.
import {useFocusEffect} from 'expo-router';
import {useCallback,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {api} from '@/api';
import {Banner,Button,Card,Screen,Text} from '@/components/ui';
import {useOfficerSession,useSession} from '@/lib/session';
import {useAsync} from '@/lib/use-async';
import {openDepartmentModule} from '@/lib/links';
import {formatPeso,fromCentavos} from '@/lib/money';
import {TAB_BAR_SPACE} from '@/lib/tab-bar';
import {spacing,useTheme} from '@/theme';
export default function Reports(){
 const session=useOfficerSession(),{can}=useSession(),{c}=useTheme();
 const authorized=can('tab-reports')||can('tab-report');
 const [revision,setRevision]=useState(0);
 useFocusEffect(useCallback(()=>setRevision(v=>v+1),[]));
 const result=useAsync(()=>authorized?api.getFinanceSnapshot(session):Promise.resolve(null),
   session.token+':'+session.org.subdomain+':reports:'+authorized+':'+revision);
 const data=!result.loading?result.data??null:null;
 return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
  contentStyle={{gap:spacing[3],paddingTop:spacing[3]}}>
  <Text variant="title" accessibilityRole="header">Financial reports</Text>
  <Banner tone="warning" title="Informational snapshot · not official">
    These are unreconciled recorded-activity totals, not certified financial statements or receipt totals. Voids, multiple receipt allocations, carried funds and reconciliation can affect official figures.
  </Banner>
  {!authorized?<Banner tone="warning" title="Restricted">Financial reporting permission is required.</Banner>:<>
   {result.loading?<ActivityIndicator color={c.cobalt}/>:null}
   {result.error?<Banner tone="danger" title="Could not load reporting snapshot">{result.error.message}</Banner>:null}
   {data?<><Text variant="bodySm" color="inkMuted">{session.org.name} · {data.ay} · {data.term}</Text>
    {data.totals.map(item=><Card key={item.label} style={styles.card}>
     <Text variant="bodyStrong">{item.label}</Text>
     <Text variant="headline">{formatPeso(fromCentavos(item.amountCentavos))}</Text>
     <Text variant="caption" color="inkMuted">{item.count} records · {item.meaning}</Text>
    </Card>)}
    <Button block variant="secondary" onPress={()=>setRevision(v=>v+1)}>Refresh snapshot</Button>
   </>:null}
   <Button block onPress={()=>void openDepartmentModule(session.org.subdomain,'/reports')}>
     Open certified web reports and submission
   </Button>
  </>}
 </Screen>;
}
const styles=StyleSheet.create({card:{gap:spacing[2],padding:14}});
