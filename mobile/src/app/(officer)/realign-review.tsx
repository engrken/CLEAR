// View-only financial transfer history, not a transfer approval workspace.
import {useFocusEffect} from 'expo-router';
import {useCallback,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet} from 'react-native';
import {api,type RealignmentRecord,type RealignmentPage} from '@/api';
import {Banner,Button,Card,Screen,Text} from '@/components/ui';
import {openDepartmentModule} from '@/lib/links';
import {formatPeso,fromCentavos} from '@/lib/money';
import {useOfficerSession,useSession} from '@/lib/session';
import {useAsync} from '@/lib/use-async';
import {TAB_BAR_SPACE} from '@/lib/tab-bar';
import {spacing,useTheme} from '@/theme';
type Extra={key:string;records:RealignmentRecord[];cursor:string|null;hasMore:boolean};
export default function RealignReview(){
 const session=useOfficerSession(),{can}=useSession(),{c}=useTheme(),authorized=can('tab-transfer');
 const [revision,setRevision]=useState(0),[extra,setExtra]=useState<Extra|null>(null);
 const [paging,setPaging]=useState(false),[error,setError]=useState('');
 const busy=useRef(false);
 useFocusEffect(useCallback(()=>setRevision(v=>v+1),[]));
 const key=session.token+':'+session.org.subdomain+':transfer:'+authorized+':'+revision;
 const result=useAsync(()=>authorized?api.getRealignmentReview(session):Promise.resolve(null),key);
 const data:RealignmentPage|null=!result.loading?result.data??null:null;
 const more=extra?.key===key?extra:null;
 const records=data?[...data.entries,...(more?.records??[])]:[];
 const cursor=more?more.cursor:data?.nextCursor;
 const hasMore=more?more.hasMore:data?.hasMore;
 async function loadMore(){
  if(!authorized||!data||!cursor||!hasMore||busy.current)return;
  busy.current=true;setPaging(true);setError('');
  try{
   const next=await api.getRealignmentReview(session,cursor);
   if(next.ay!==data.ay||next.term!==data.term)throw new Error('Period changed. Refresh history.');
   setExtra(old=>{
    const rows=old?.key===key?old.records:[];
    const ids=new Set([...data.entries,...rows].map(r=>r.id));
    return {key,records:[...rows,...next.entries.filter(r=>!ids.has(r.id))],
      cursor:next.nextCursor,hasMore:next.hasMore};
   });
  }catch(err){setError(err instanceof Error?err.message:'Unable to load transfer history.');}
  finally{busy.current=false;setPaging(false);}
 }
 return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
  contentStyle={{gap:spacing[3],paddingTop:spacing[3]}}>
  <Text variant="title" accessibilityRole="header">Fund realignment</Text>
  <Banner tone="info" title="Authorized · view only">Review current-term movement history. Transferring funds, activating terms, opening balances and reversing rollovers require secure web administration.</Banner>
  {!authorized?<Banner tone="warning" title="Restricted">Fund transfer permission is required.</Banner>:<>
   {result.loading?<ActivityIndicator color={c.cobalt}/>:null}
   {result.error?<Banner tone="danger" title="History unavailable">{result.error.message}</Banner>:null}
   {data?<><Text variant="bodySm" color="inkMuted">{data.ay} · {data.term} · {records.length} loaded</Text>
    {records.length===0?<Banner tone="info" title="No transfers">No current-term transfer history.</Banner>:
     records.map(item=><Card key={item.id} style={styles.card}>
      <Text variant="bodyStrong">{item.from} → {item.to}</Text>
      <Text variant="headline">{formatPeso(fromCentavos(item.amountCentavos))}</Text>
      <Text variant="caption" color="inkMuted">{item.when.slice(0,10)} · {item.reason||'No public note'}</Text>
     </Card>)}
    {error?<Banner tone="danger" title="Could not load more">{error}</Banner>:null}
    {hasMore?<Button block variant="secondary" disabled={paging} onPress={()=>void loadMore()}>
     {paging?'Loading…':'Load more transfers'}
    </Button>:null}
    <Button block variant="secondary" onPress={()=>{setRevision(x=>x+1);setExtra(null);}}>Refresh</Button>
   </>:null}
   <Button block onPress={()=>void openDepartmentModule(session.org.subdomain,'/realign')}>
    Open audited fund realignment on web
   </Button>
  </>}
 </Screen>;
}
const styles=StyleSheet.create({card:{padding:14,gap:spacing[2]}});
