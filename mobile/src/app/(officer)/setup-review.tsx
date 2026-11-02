// Role-gated setup overview. Financial configuration never posts from APK.
import {useFocusEffect,useRouter} from 'expo-router';
import {useCallback,useState} from 'react';
import {ActivityIndicator,StyleSheet} from 'react-native';
import {api} from '@/api';
import {Banner,Button,Card,Screen,Text} from '@/components/ui';
import {openDepartmentModule} from '@/lib/links';
import {formatPeso,fromCentavos} from '@/lib/money';
import {useOfficerSession,useSession} from '@/lib/session';
import {useAsync} from '@/lib/use-async';
import {TAB_BAR_SPACE} from '@/lib/tab-bar';
import {spacing,useTheme} from '@/theme';
export default function DepartmentSetup(){
 const session=useOfficerSession(),{can}=useSession(),{c}=useTheme(),router=useRouter();
 const authorized=can('tab-setup');
 const isAdmin=['admin','administrator','master'].includes(session.officer.role.toLowerCase());
 const [rev,setRev]=useState(0);
 useFocusEffect(useCallback(()=>setRev(n=>n+1),[]));
 const result=useAsync(()=>authorized?api.getSetupReview(session):Promise.resolve(null),
  session.org.subdomain+':'+session.token+':setup:'+authorized+':'+rev);
 const data=!result.loading?result.data??null:null;
 return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
  contentStyle={{gap:spacing[3],paddingTop:spacing[3]}}>
  <Text variant="title" accessibilityRole="header">Department setup</Text>
  <Banner tone="info" title="View-only financial configuration">
    Fee amounts and opening fund allocations are historical configuration values, not cash balances. Their modification, fund realignment, collection setup and fee assessment are permitted only through the independently authenticated web workflow.
  </Banner>
  {!authorized?<Banner tone="warning" title="Restricted">Your account requires the Setup permission.</Banner>:<>
   {result.loading?<ActivityIndicator color={c.cobalt}/>:null}
   {result.error?<Banner tone="danger" title="Setup unavailable">{result.error.message}</Banner>:null}
   {data?<>
    <Text variant="bodyStrong">{data.ay} · {data.term}</Text>
    <Text variant="bodySm" color="inkMuted">Academic calendar: {data.calendar?.mode??'Legacy defaults'}{data.calendar?.includeSummer?' · Summer enabled':''}</Text>
    <Text variant="headline">Opening fund configurations ({data.fundsTotal})</Text>
    {data.funds.map(item=><Card key={item.id} style={styles.card}>
      <Text variant="bodyStrong">{item.name}</Text>
      <Text variant="bodySm" color="inkMuted">Initial allocation · {formatPeso(fromCentavos(item.openingCentavos))}</Text>
    </Card>)}
    {data.fundsTotal>data.funds.length?<Banner tone="info" title="Additional funds">Showing first {data.funds.length} configurations. Open web setup for the remainder.</Banner>:null}
    <Text variant="headline">Collection fee configuration ({data.feesTotal})</Text>
    {data.fees.map(item=><Card key={item.id} style={styles.card}>
      <Text variant="bodyStrong">{item.name}</Text>
      <Text variant="bodySm" color="inkMuted">{item.category} · {item.isPackage?'Package':'Individual'} · Target: {item.targetFund}</Text>
      <Text variant="bodyStrong">{formatPeso(fromCentavos(item.amountCentavos))}</Text>
    </Card>)}
    {data.feesTotal>data.fees.length?<Banner tone="info" title="Additional fees">Showing first {data.fees.length} configurations. Open web setup for the remainder.</Banner>:null}
   </>:null}
   {isAdmin?<Button block variant="secondary" onPress={()=>router.push('/academic-calendar')}>
     Manage academic calendar
   </Button>:null}
   <Button block variant="secondary" onPress={()=>setRev(n=>n+1)}>Refresh setup</Button>
   <Button block onPress={()=>void openDepartmentModule(session.org.subdomain,'/setup')}>
     Open full secure web setup
   </Button>
  </>}
 </Screen>;
}
const styles=StyleSheet.create({card:{padding:14,gap:spacing[2]}});
