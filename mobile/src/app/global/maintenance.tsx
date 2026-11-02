// Global Administrator maintenance scheduling and emergency recovery.
// The web admin console remains authoritative for full notice editing and logs.
import {useState} from 'react';
import {ActivityIndicator,Alert,Pressable,StyleSheet,TextInput,View} from 'react-native';
import {api,type GlobalMaintenanceChange} from '@/api';
import {BackHeader,Banner,Button,Card,Screen,Text} from '@/components/ui';
import {useGlobalSession} from '@/lib/session';
import {useAsync} from '@/lib/use-async';
import {openGlobalMaintenancePortal} from '@/lib/links';
import {radius,spacing,useTheme} from '@/theme';
const MODE=['NORMAL','READ_ONLY','FULL'] as const;
const phtDate=(iso:string)=>new Date(new Date(iso).getTime()+8*3600000).toISOString().slice(0,16);
export default function GlobalMaintenance(){
 const global=useGlobalSession();
 const {c}=useTheme();
 const [revision,setRevision]=useState(0);
 const [scope,setScope]=useState('global'),[mode,setMode]=useState<GlobalMaintenanceChange['action'] extends 'none'?never:'NORMAL'|'READ_ONLY'|'FULL'>('NORMAL');
 const [title,setTitle]=useState(''),[message,setMessage]=useState('');
 const [start,setStart]=useState(''),[end,setEnd]=useState('');
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const result=useAsync(()=>api.getGlobalMaintenance(global),global.token+':maintenance:'+revision);
 const rows=result.data?.notices??[];
 function submit(){
  if(saving)return;
  const confirmation=mode==='NORMAL'?'SCHEDULE NOTICE':'SCHEDULE MAINTENANCE';
  Alert.alert('Schedule '+(mode==='NORMAL'?'notice':'maintenance')+'?',
   'Scope: '+scope+' · Times in Philippine Standard Time. Server enforces scheduled restrictions and records an audit.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{
     setSaving(true);setError('');
     void api.changeGlobalMaintenance(global,{action:'create',scope,mode,title,message,
       startsAt:start,endsAt:end,confirmation})
       .then(()=>{setRevision(x=>x+1);setTitle('');setMessage('');})
       .catch(e=>setError(e instanceof Error?e.message:'Unable to schedule notice.'))
       .finally(()=>setSaving(false));
   }}]);
 }
 function alter(id:string,version:number,action:'cancel'|'end_early'){
  const confirm=action==='cancel'?'CANCEL':'END_EARLY';
  Alert.alert(confirm==='CANCEL'?'Cancel notice?':'End active maintenance now?',
    'This global administrator action is audited and immediately affects applicable service restrictions.',
    [{text:'Keep schedule',style:'cancel'},{text:'Confirm',onPress:()=>{
     setSaving(true);setError('');
     void api.changeGlobalMaintenance(global,{action,id,expectedVersion:version,confirmation:confirm})
       .then(()=>setRevision(x=>x+1))
       .catch(e=>setError(e instanceof Error?e.message:'The schedule was not changed.'))
       .finally(()=>setSaving(false));
    }}]);
 }
 const now=result.data?new Date(result.data.serverTime).getTime():0;
 return <Screen edges={['top','bottom']} header={<BackHeader title="Maintenance & notices"/>}
  contentStyle={{gap:spacing[3],paddingBottom:spacing[6]}}>
  <Banner tone="info" title="Global Administrator · security-critical settings">
   All times are Philippine Standard Time (UTC+08). Scheduled restrictions start/end automatically. Changes require a separate server opt-in, and every action is audited.
  </Banner>
  {result.loading?<ActivityIndicator color={c.cobalt}/>:null}
  {result.error?<Banner tone="danger" title="Cannot load schedules">{result.error.message}</Banner>:null}
  {error?<Banner tone="danger" title="Not saved">{error}</Banner>:null}
  <Card style={styles.card}>
   <Text variant="headline">Schedule notice or maintenance</Text>
   <Text variant="bodySm">Global or tenant subdomain</Text>
   <TextInput value={scope} onChangeText={setScope} maxLength={65} autoCapitalize="none"
    accessibilityLabel="Scope: global or tenant subdomain" style={[styles.input,{color:c.ink,backgroundColor:c.soft}]}/>
   <Text variant="bodySm">Service mode</Text>
   <View style={styles.row}>{MODE.map(item=><Pressable key={item} accessibilityRole="radio"
    accessibilityState={{selected:mode===item}} onPress={()=>setMode(item)}
    style={[styles.choice,{backgroundColor:mode===item?c.inkBlock:c.soft}]}>
     <Text variant="bodySm" color={mode===item?'onAccent':'ink'}>{item}</Text>
    </Pressable>)}</View>
   <Text variant="caption" color="inkMuted">NORMAL = announcement only. READ_ONLY blocks non-exempt changes. FULL blocks all non-recovery operations.</Text>
   {[{label:'Title',value:title,set:setTitle},{label:'Message',value:message,set:setMessage},
    {label:'Starts (YYYY-MM-DDTHH:mm PHT)',value:start,set:setStart},
    {label:'Ends (YYYY-MM-DDTHH:mm PHT)',value:end,set:setEnd}].map(x=><View key={x.label} style={styles.field}>
      <Text variant="bodySm">{x.label}</Text>
      <TextInput value={x.value} onChangeText={x.set} maxLength={x.label==='Message'?800:140}
       accessibilityLabel={x.label} autoCapitalize="none" multiline={x.label==='Message'}
       style={[styles.input,{color:c.ink,backgroundColor:c.soft}]}/>
    </View>)}
   <Button block disabled={saving||title.trim().length<5||message.trim().length<10||!start||!end}
    onPress={submit}>{saving?'Saving…':'Schedule'}</Button>
  </Card>
  <Text variant="headline">Upcoming & active schedules ({rows.length})</Text>
  {rows.map(row=>{
    const active=row.state==='SCHEDULED'&&new Date(row.startsAt).getTime()<=now&&new Date(row.endsAt).getTime()>now;
    return <Card key={row.id} style={styles.card}>
      <Text variant="bodyStrong">{row.title}</Text>
      <Text variant="bodySm">{row.scopeKey} · {row.mode} · {active?'Active':row.state}</Text>
      <Text variant="caption" color="inkMuted">{phtDate(row.startsAt)} — {phtDate(row.endsAt)} PHT</Text>
      <Text variant="bodySm">{row.message}</Text>
      {row.state==='SCHEDULED'?<Button size="sm" variant="secondary" disabled={saving}
        onPress={()=>alter(row.id,row.version,active&&row.mode!=='NORMAL'?'end_early':'cancel')}>
        {active&&row.mode!=='NORMAL'?'End early':'Cancel notice'}
      </Button>:null}
    </Card>;
   })}
  <Button block variant="secondary" onPress={()=>setRevision(x=>x+1)}>Refresh schedules</Button>
  <Button block onPress={()=>void openGlobalMaintenancePortal()}>Full web maintenance console & audit logs</Button>
 </Screen>;
}
const styles=StyleSheet.create({
 card:{gap:spacing[2],padding:14},field:{gap:spacing[1]},
 input:{minHeight:48,borderRadius:radius.md,paddingHorizontal:12,fontSize:16},
 row:{flexDirection:'row',gap:spacing[2],flexWrap:'wrap'},
 choice:{minHeight:42,justifyContent:'center',borderRadius:radius.md,paddingHorizontal:12},
});
