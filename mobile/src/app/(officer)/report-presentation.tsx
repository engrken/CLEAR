// Native administrative report signatories. No financial report submission or
// transaction processing is allowed on Android.
import {useState} from 'react';
import {ActivityIndicator,Alert,StyleSheet,TextInput,View} from 'react-native';
import {api,type ReportSignatory} from '@/api';
import {Banner,Button,Card,Screen,Text} from '@/components/ui';
import {canOfferMobileWrite} from '@/lib/write-permissions';
import {openDepartmentModule} from '@/lib/links';
import {useOfficerSession,useSession} from '@/lib/session';
import {useAsync} from '@/lib/use-async';
import {TAB_BAR_SPACE} from '@/lib/tab-bar';
import {radius,spacing,useTheme} from '@/theme';
const blank=():ReportSignatory=>({label:'',name:'',position:''});
export default function ReportPresentation(){
 const session=useOfficerSession(),{can}=useSession(),{c}=useTheme();
 const authorized=can('tab-report');
 const [revision,setRevision]=useState(0);
 const [draft,setDraft]=useState<{version:string;rows:ReportSignatory[];schoolName:string;schoolAddress:string}|null>(null);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const key=session.token+':'+session.org.subdomain+':signatories:'+revision+':'+authorized;
 const info=useAsync(()=>authorized?api.getReportSignatories(session):Promise.resolve(null),key);
 const grants=useAsync(()=>authorized?api.getWriteCapabilities(session):Promise.resolve({enabled:false,grants:[]}),
  session.token+':'+session.org.subdomain+':signatory-grant:'+authorized);
 const mayEdit=authorized&&canOfferMobileWrite(grants.data,'reports.signatories.manage',session.org.subdomain);
 const value=!info.loading?info.data??null:null;
 const active=draft?.version===value?.version?draft:null;
 const records=active?.rows??value?.records??[];
 const schoolName=active?.schoolName??value?.schoolName??'';
 const schoolAddress=active?.schoolAddress??value?.schoolAddress??'';
 const revise=(rows:ReportSignatory[],name=schoolName,address=schoolAddress)=>{
  if(value)setDraft({version:value.version,rows,schoolName:name,schoolAddress:address});
 };

 function update(index:number,field:keyof ReportSignatory,text:string){
  if(!value||!mayEdit)return;
  const next=records.map((row,i)=>i===index?{...row,[field]:text}:row);
  revise(next);
 }
 function add(){if(value&&mayEdit&&records.length<20)
  revise([...records,blank()]);}
 function remove(index:number){if(value&&mayEdit)
  revise(records.filter((_,i)=>i!==index));}
 function save(){
  if(!value||!active||!mayEdit||saving)return;
  Alert.alert('Save report presentation?','This updates authorized institution headings and signatories without changing financial values or logos.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{
    setSaving(true);setError('');
    void api.saveReportSignatories(session,{
     expectedVersion:value.version,records:active.rows,schoolName:active.schoolName,schoolAddress:active.schoolAddress,confirmation:'SAVE REPORT PRESENTATION',
    }).then(()=>{setRevision(x=>x+1);setDraft(null);})
     .catch(e=>setError(e instanceof Error?e.message:'Unable to save report signatories.'))
     .finally(()=>setSaving(false));
   }}]);
 }
 return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE} contentStyle={{gap:spacing[3],paddingTop:spacing[3]}}>
  <Text variant="title" accessibilityRole="header">Report presentation</Text>
  <Banner tone="info" title="Operational metadata only">
    Institution name, address, and signatories are non-monetary report settings. Existing report logos are retained. Official report certification and submission continue through secure web.
  </Banner>
  {!authorized?<Banner tone="warning" title="Restricted">The Report submission module is not assigned to this account.</Banner>:<>
   {info.loading?<ActivityIndicator color={c.cobalt}/>:null}
   {info.error?<Banner tone="danger" title="Unable to load signatories">{info.error.message}</Banner>:null}
   {error?<Banner tone="danger" title="Not saved">{error}</Banner>:null}
   {value?<>
    <Text variant="bodySm" color="inkMuted">{records.length} signatory rows · {mayEdit?'Changes permitted':'Viewing only'}</Text>
    <Card style={styles.card}>
      <Text variant="bodyStrong">Institution report header</Text>
      <Text variant="caption" color="inkMuted">Name used by printed web reports</Text>
      <TextInput value={schoolName} editable={mayEdit&&!saving} maxLength={200}
        accessibilityLabel="Report institution name"
        onChangeText={text=>revise(records,text,schoolAddress)}
        style={[styles.input,{backgroundColor:c.soft,color:c.ink}]}/>
      <Text variant="caption" color="inkMuted">Institution address</Text>
      <TextInput value={schoolAddress} editable={mayEdit&&!saving} maxLength={300}
        accessibilityLabel="Report institution address"
        multiline onChangeText={text=>revise(records,schoolName,text)}
        style={[styles.input,{backgroundColor:c.soft,color:c.ink}]}/>
      <Text variant="caption" color="inkMuted">Logo uploads and official report downloads remain on the secure web portal.</Text>
    </Card>
    {records.map((row,index)=><Card key={index} style={styles.card}>
      <Text variant="bodyStrong">Signatory {index+1}</Text>
      {(['label','name','position'] as const).map(field=><View key={field} style={styles.field}>
       <Text variant="caption" color="inkMuted">{field}</Text>
       <TextInput value={row[field]} onChangeText={text=>update(index,field,text)}
        editable={mayEdit&&!saving} maxLength={field==='label'?100:120}
        accessibilityLabel={'Signatory '+(index+1)+' '+field}
        style={[styles.input,{backgroundColor:c.soft,color:c.ink}]}/>
      </View>)}
      {mayEdit?<Button size="sm" variant="secondary" disabled={saving} onPress={()=>remove(index)}>Remove signatory</Button>:null}
    </Card>)}
    {mayEdit?<><Button block variant="secondary" disabled={saving||records.length>=20} onPress={add}>Add signatory</Button>
      <Button block disabled={saving||!active||!schoolName.trim()} onPress={save}>{saving?'Saving…':'Save report presentation'}</Button>
     </>:<Banner tone="info" title="No editing grant">The server has not enabled native report signatory editing for this account.</Banner>}
    <Button block variant="secondary" onPress={()=>{setRevision(x=>x+1);setDraft(null);}}>Refresh</Button>
   </>:null}
   <Button block onPress={()=>void openDepartmentModule(session.org.subdomain,'/reports')}>
    Certified reports and submission on secure web
   </Button>
  </>}
 </Screen>;
}
const styles=StyleSheet.create({
 card:{gap:spacing[2],padding:14},field:{gap:spacing[1]},
 input:{minHeight:48,borderRadius:radius.md,paddingHorizontal:12,fontSize:16},
});
