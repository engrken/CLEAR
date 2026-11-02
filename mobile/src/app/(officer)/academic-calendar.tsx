// Operational calendar only. Fund values, fee rates and period rollovers
// remain in the audited web setup workflow.
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api, type MobileAcademicCalendarChange } from '@/api';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { openDepartmentModule } from '@/lib/links';
import { canOfferMobileWrite } from '@/lib/write-permissions';
import { useOfficerSession, useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { TAB_BAR_SPACE } from '@/lib/tab-bar';
import { radius, spacing, useTheme } from '@/theme';
const MODES = ['FullYear','Semester','Trimester'] as const;
export default function AcademicCalendar() {
  const session = useOfficerSession();
  const {can}=useSession();
  const {c}=useTheme();
  const admin=['admin','administrator','master'].includes(session.officer.role.trim().toLowerCase());
  const authorized=can('tab-setup') && admin;
  const [revision, setRevision]=useState(0);
  const [year, setYear]=useState('');
  const [mode, setMode]=useState<MobileAcademicCalendarChange['mode']>('Semester');
  const [summer, setSummer]=useState(true);
  const [selected, setSelected]=useState('');
  const [saving, setSaving]=useState(false);
  const [error, setError]=useState('');
  const scope=session.org.subdomain+':'+session.token+':'+authorized+':'+revision;
  const details=useAsync(()=>authorized?api.getAcademicCalendar(session):Promise.resolve(null),scope);
  const capabilities=useAsync(()=>authorized?api.getWriteCapabilities(session):Promise.resolve({enabled:false,grants:[]}),
    session.org.subdomain+':'+session.token+':academic-calendar:'+authorized);
  const allowed=authorized && canOfferMobileWrite(capabilities.data,'tenant.settings.manage',session.org.subdomain);
  const data=!details.loading ? details.data:null;
  const effectiveYear=year || data?.activeAy || '';
  const config=data?.configurations.find(row=>row.academicYear === effectiveYear);
  const currentMode=selected === effectiveYear ? mode : (config?.mode ?? 'Semester');
  const currentSummer=selected === effectiveYear ? summer : (config?.includeSummer ?? true);
  const choice=(next:MobileAcademicCalendarChange['mode'])=>{
    setSelected(effectiveYear);setMode(next);setSummer(currentSummer);
  };
  const toggleSummer=()=>{
    setSelected(effectiveYear);setSummer(!currentSummer);setMode(currentMode);
  };
  function submit() {
    if (!allowed || saving) return;
    const payload:MobileAcademicCalendarChange={
      academicYear:effectiveYear, mode:currentMode,
      includeSummer:currentMode==='Semester' && currentSummer,
      expectedUpdatedAt:config?.updatedAt ?? null,
    };
    Alert.alert('Update academic calendar?',
      'Calendar changes can affect which terms are available. Existing transactions cannot be moved or changed by this operation.',
      [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{
        setSaving(true);setError('');
        void api.updateAcademicCalendar(session,payload)
          .then(()=>{setRevision(v=>v+1);setSelected('');setYear('');})
          .catch(cause=>setError(cause instanceof Error?cause.message:'Calendar change was not saved.'))
          .finally(()=>setSaving(false));
      }}]);
  }
  return <Screen edges={['top']} bottomInset={TAB_BAR_SPACE}
    contentStyle={{gap:spacing[3],paddingTop:spacing[3]}}>
    <Text variant="title" accessibilityRole="header">Academic calendar</Text>
    {!authorized?<Banner tone="warning" title="Administrator only">Department setup permission and an active administrator account are required.</Banner>:<>
      <Banner tone="info" title="Web is the source of truth">Calendar edits require a separate server grant and cannot change existing financial data, fund setup, receipt dates or historical terms.</Banner>
      {details.loading?<ActivityIndicator color={c.cobalt}/>:null}
      {details.error?<Banner tone="danger" title="Calendar unavailable">{details.error.message}</Banner>:null}
      {error?<Banner tone="danger" title="Not saved">{error}</Banner>:null}
      {data?<Card style={styles.card}>
        <Text variant="bodyStrong">{data.activeAy} · {data.activeTerm}</Text>
        <Text variant="bodySm" color="inkMuted">Current organization period</Text>
        <Text variant="bodyStrong">Academic year</Text>
        <TextInput value={effectiveYear} onChangeText={value=>{setYear(value);setSelected('');}}
          accessibilityLabel="Academic year" autoCapitalize="none"
          placeholder="A.Y. 2026 - 2027" placeholderTextColor={c.inkMuted}
          style={[styles.input,{backgroundColor:c.soft,color:c.ink}]}/>
        <Text variant="bodyStrong">Period structure</Text>
        <View style={styles.row}>
          {MODES.map(value=><Pressable key={value}
            accessibilityRole="radio" accessibilityState={{selected:currentMode===value}}
            onPress={()=>choice(value)} style={[styles.choice,{backgroundColor:currentMode===value?c.inkBlock:c.soft}]}>
            <Text variant="bodySm" color={currentMode===value?'onAccent':'ink'}>{value}</Text>
          </Pressable>)}
        </View>
        {currentMode==='Semester'?<Pressable accessibilityRole="checkbox"
          accessibilityState={{checked:currentSummer}} onPress={toggleSummer} style={styles.row}>
          <Text variant="bodySm">{currentSummer?'☑':'☐'} Include Summer term</Text>
        </Pressable>:null}
        <Text variant="caption" color="inkMuted">
          {config?'Existing calendar · stale saves rejected':'No saved calendar for this year · legacy default'}
        </Text>
        {allowed?<Button block disabled={saving || !effectiveYear.trim()} onPress={submit}>
          {saving?'Saving…':'Save calendar'}
        </Button>:<Banner tone="info" title="Viewing only">Native editing is not enabled by the web server for this account. Use authorized web setup until it is approved.</Banner>}
        <Button block variant="secondary" onPress={()=>{setRevision(v=>v+1);setYear('');setSelected('');}}>Refresh calendar</Button>
      </Card>:null}
      <Button block variant="secondary"
        onPress={()=>void openDepartmentModule(session.org.subdomain,'/setup')}>
        Open full secure web setup
      </Button>
    </>}
  </Screen>;
}
const styles=StyleSheet.create({
  card:{gap:spacing[3],padding:14},
  row:{flexDirection:'row',flexWrap:'wrap',gap:spacing[2]},
  input:{minHeight:48,borderRadius:radius.md,paddingHorizontal:12,fontSize:16},
  choice:{minHeight:42,justifyContent:'center',borderRadius:radius.md,paddingHorizontal:12},
});
