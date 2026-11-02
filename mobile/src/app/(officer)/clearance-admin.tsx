// Officer-only clearance review. The server derives clearance from enrollment
// and financial obligations; the client cannot write/override that result.
import {useState} from 'react';
import {ActivityIndicator,StyleSheet,TextInput,View} from 'react-native';
import {useRouter} from 'expo-router';
import {api,type ClearanceResult} from '@/api';
import {Banner,Button,Card,Screen,Text} from '@/components/ui';
import {useOfficerSession,useSession} from '@/lib/session';
import {formatPeso,fromCentavos} from '@/lib/money';
import {openDepartmentModule} from '@/lib/links';
import {TAB_BAR_SPACE} from '@/lib/tab-bar';
import {radius,spacing,useTheme} from '@/theme';
export default function OfficerClearance(){
 const session=useOfficerSession(),{can}=useSession(),{c}=useTheme(),router=useRouter();
 const authorized=can('tab-clearance');
 const [query,setQuery]=useState('');
 const [state,setState]=useState<{key:string;data:ClearanceResult|null;error:string;loading:boolean}>({
   key:'',data:null,error:'',loading:false,
 });
 const key=session.token+':'+session.org.subdomain+':'+query.trim();
 const live=state.key===key?state:null;
 async function lookup(){
  const requested=query.trim();
  if(!authorized||requested.length<2||requested.length>120)return;
  const scope=session.token+':'+session.org.subdomain+':'+requested;
  setState({key:scope,data:null,error:'',loading:true});
  try{
   // A nonempty query is REQUIRED: an empty GET uses the entirely different
   // student-OTP verification path. Never use a student OTP as an officer token.
   const result=await api.lookupClearance(session.org.subdomain,requested,session);
   setState({key:scope,data:result,error:'',loading:false});
  }catch(e){
   setState({key:scope,data:null,error:e instanceof Error?e.message:'Clearance inquiry failed.',loading:false});
  }
 }
 const result=live?.data;
 return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
  contentStyle={{gap:spacing[3],paddingTop:spacing[3]}}>
  <Text variant="title" accessibilityRole="header">Officer clearance review</Text>
  <Banner tone="info" title="Authorized officer only">
   Search a student within your assigned tenant. Clearance is calculated from enrollment and outstanding obligations; it cannot be manually marked cleared on Android.
  </Banner>
  {!authorized?<Banner tone="warning" title="Access denied">Your account requires Clearance permission.</Banner>:<>
   <Card style={styles.card}>
    <Text variant="bodyStrong">School ID or student name</Text>
    <TextInput value={query} onChangeText={setQuery} maxLength={120}
      placeholder="Search registered student" placeholderTextColor={c.inkMuted}
      accessibilityLabel="Search authorized clearance" autoCapitalize="none"
      style={[styles.search,{backgroundColor:c.soft,color:c.ink}]} />
    <Button block disabled={query.trim().length<2||live?.loading} onPress={()=>void lookup()}>
     {live?.loading?'Checking…':'Check clearance'}
    </Button>
   </Card>
   {live?.loading?<ActivityIndicator color={c.cobalt}/>:null}
   {live?.error?<Banner tone="danger" title="Unable to review">{live.error}</Banner>:null}
   {result?<Card style={styles.card}>
    <Text variant="headline">{result.studentName||'Registered student'}</Text>
    <Text variant="bodySm" color="inkMuted">{result.studentId} · {result.term} · {result.ay}</Text>
    <Banner tone={result.status==='cleared'?'success':'warning'}
      title={result.status==='cleared'?'Cleared':result.status==='not_enrolled'?'Not enrolled':'Not cleared'}>
      {result.status==='cleared'?'No outstanding obligations were reported for this current review.':
       result.status==='not_enrolled'?'The student is not enrolled in the active term.':
       'Outstanding obligations are present. Only verified transactions in web may change monetary balances.'}
    </Banner>
    {result.outstandingCentavos!==null?<Text variant="bodyStrong">
      Remaining obligation: {formatPeso(fromCentavos(result.outstandingCentavos))}
    </Text>:null}
    {(result.unpaidItems??[]).map((row,i)=><View key={i} style={styles.item}>
      <Text variant="bodySm">{row.label}</Text>
      <Text variant="bodyStrong">{formatPeso(fromCentavos(row.amount))}</Text>
      {row.academicYear||row.term?<Text variant="caption" color="inkMuted">
        {[row.academicYear,row.term].filter(Boolean).join(' · ')}
      </Text>:null}
    </View>)}
    {can('tab-students')?<Button block variant="secondary" onPress={()=>router.push('/students')}>
      Open student roster to review enrollment
    </Button>:null}
   </Card>:null}
   <Button block variant="secondary" onPress={()=>void openDepartmentModule(session.org.subdomain,'/clearance')}>
    Open secure web clearance
   </Button>
  </>}
 </Screen>;
}
const styles=StyleSheet.create({
 card:{gap:spacing[3],padding:14},
 search:{minHeight:50,paddingHorizontal:12,borderRadius:radius.md,fontSize:16},
 item:{gap:spacing[1],paddingVertical:spacing[2],borderBottomWidth:1,borderColor:'#D5D9E0'},
});
