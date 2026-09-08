import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {environment} from './config/environment';
import {technicianApi} from './api/technicianApi';
import type {
  AssignedJob,
  JobDetail,
  ServiceRequestStatus,
  TechnicianDashboard,
} from './types/technician';

type Screen = 'dashboard' | 'jobs' | 'detail' | 'profile';

const ACTIVE_STATUSES: ServiceRequestStatus[] = [
  'ON_THE_WAY',
  'REACHED_SITE',
  'IN_PROGRESS',
  'DIAGNOSIS',
  'REPAIR_IN_PROGRESS',
  'WAITING_FOR_PARTS',
  'TESTING',
  'COMPLETED',
];

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const readableError = (error: unknown) => error instanceof Error ? error.message : 'Could not load Valor data.';

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [dashboard, setDashboard] = useState<TechnicianDashboard | null>(null);
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!environment.apiBaseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const [nextDashboard, response] = await Promise.all([technicianApi.dashboard(), technicianApi.jobs({page: 0})]);
      setDashboard(nextDashboard);
      setJobs(response.content);
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openJob = async (job: AssignedJob) => {
    setSelectedJob(job);
    setScreen('detail');
    try {
      setSelectedJob(await technicianApi.job(job.id));
    } catch (reason) {
      setError(readableError(reason));
    }
  };

  const updateJob = async (status: ServiceRequestStatus) => {
    if (!selectedJob) return;
    try {
      const next = status === 'ACCEPTED'
        ? await technicianApi.accept(selectedJob.id)
        : await technicianApi.transition(selectedJob.id, status);
      setSelectedJob(next);
      setJobs(current => current.map(job => job.id === next.id ? next : job));
      Alert.alert('Status updated', `This job is now ${label(next.status)}.`);
      refresh();
    } catch (reason) {
      Alert.alert('Update not sent', readableError(reason));
    }
  };

  if (!environment.apiBaseUrl) return <SetupScreen />;

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <View style={styles.app}>
      <Header screen={screen} onBack={() => setScreen('jobs')} />
      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
      {screen === 'dashboard' ? <Dashboard dashboard={dashboard} jobs={jobs} loading={loading} onJobs={() => setScreen('jobs')} onJob={openJob} onRefresh={refresh} /> : null}
      {screen === 'jobs' ? <Jobs jobs={jobs} loading={loading} onJob={openJob} onRefresh={refresh} /> : null}
      {screen === 'detail' && selectedJob ? <JobDetailScreen job={selectedJob} onUpdate={updateJob} /> : null}
      {screen === 'profile' ? <Profile dashboard={dashboard} /> : null}
      {screen !== 'detail' ? <BottomNav screen={screen} onChange={setScreen} /> : null}
    </View>
  </SafeAreaView>;
}

function SetupScreen() {
  return <SafeAreaView style={styles.safe}><View style={styles.setup}><Text style={styles.logo}>VALOR</Text><Text style={styles.setupTitle}>Connect the technician app</Text><Text style={styles.setupText}>Set apiBaseUrl in src/config/environment.ts using the existing Valor API origin, then rebuild the app.</Text></View></SafeAreaView>;
}

function Header({screen, onBack}: {screen: Screen; onBack: () => void}) {
  const isDetail = screen === 'detail';
  return <View style={styles.header}><Pressable disabled={!isDetail} onPress={onBack} style={styles.headerButton}><Text style={styles.headerButtonText}>{isDetail ? '‹ Back' : ''}</Text></Pressable><Text style={styles.logo}>VALOR</Text><View style={styles.headerButton} /></View>;
}

function ErrorBanner({message, onRetry}: {message: string; onRetry: () => void}) {
  return <View style={styles.error}><Text style={styles.errorText}>{message}</Text><Pressable onPress={onRetry}><Text style={styles.retry}>Retry</Text></Pressable></View>;
}

function Dashboard({dashboard, jobs, loading, onJobs, onJob, onRefresh}: {dashboard: TechnicianDashboard | null; jobs: AssignedJob[]; loading: boolean; onJobs: () => void; onJob: (job: AssignedJob) => void; onRefresh: () => void}) {
  return <ScrollView contentContainerStyle={styles.content} refreshControl={undefined}>
    <View style={styles.hero}><Text style={styles.kicker}>TECHNICIAN WORKSPACE</Text><Text style={styles.title}>Good day, {dashboard?.technicianName || 'Technician'}</Text><Text style={styles.muted}>{dashboard?.serviceArea || 'Your Valor service area'}</Text><Text style={styles.availability}>● {label(dashboard?.availability || 'OFFLINE')}</Text></View>
    <View style={styles.metrics}><Metric label="New jobs" value={dashboard?.newJobs}/><Metric label="In progress" value={dashboard?.inProgress}/><Metric label="Completed" value={dashboard?.completedToday}/><Metric label="Scheduled" value={dashboard?.scheduledToday}/></View>
    <SectionTitle title="Today’s jobs" action="View all" onAction={onJobs}/>
    {loading && !dashboard ? <ActivityIndicator color={colors.primary} /> : jobs.slice(0, 3).map(job => <JobCard key={job.id} job={job} onPress={() => onJob(job)}/>)}
    {!loading && jobs.length === 0 ? <Empty text="No jobs are assigned to you today." /> : null}
    <Pressable style={styles.outlineButton} onPress={onRefresh}><Text style={styles.outlineButtonText}>Refresh dashboard</Text></Pressable>
  </ScrollView>;
}

function Jobs({jobs, loading, onJob, onRefresh}: {jobs: AssignedJob[]; loading: boolean; onJob: (job: AssignedJob) => void; onRefresh: () => void}) {
  return <View style={styles.listScreen}><Text style={styles.screenTitle}>Assigned jobs</Text><Text style={styles.muted}>Only work assigned to your account is shown.</Text>{loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <FlatList data={jobs} keyExtractor={item => item.id} renderItem={({item}) => <JobCard job={item} onPress={() => onJob(item)}/>} ListEmptyComponent={<Empty text="No jobs are assigned to you."/>} contentContainerStyle={styles.jobList}/>}<Pressable style={styles.outlineButton} onPress={onRefresh}><Text style={styles.outlineButtonText}>Refresh</Text></Pressable></View>;
}

function JobDetailScreen({job, onUpdate}: {job: JobDetail; onUpdate: (status: ServiceRequestStatus) => void}) {
  const options = job.status === 'ASSIGNED' ? ['ACCEPTED'] as ServiceRequestStatus[] : ACTIVE_STATUSES.filter(status => status !== job.status);
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>{job.requestId}</Text><Text style={styles.screenTitle}>Service request</Text><Badge status={job.status}/><InfoCard title="Customer" rows={[job.customerName, job.customerPhone]}/><InfoCard title="Building & lift" rows={[job.buildingName, job.liftIdentifier, job.address]}/><InfoCard title="Issue details" rows={[job.issue, job.issueDescription, job.expectedDurationMinutes ? `Expected duration: ${job.expectedDurationMinutes} min` : undefined]}/><Text style={styles.sectionHeading}>Update status</Text>{options.map(status => <Pressable key={status} style={styles.statusButton} onPress={() => onUpdate(status)}><Text style={styles.statusButtonText}>{status === 'ACCEPTED' ? 'Accept job' : label(status)}</Text></Pressable>)}</ScrollView>;
}

function Profile({dashboard}: {dashboard: TechnicianDashboard | null}) { return <View style={styles.content}><Text style={styles.screenTitle}>Technician profile</Text><InfoCard title="Account" rows={[dashboard?.technicianName, dashboard?.serviceArea, dashboard ? label(dashboard.availability) : undefined]}/></View>; }
function Metric({label: metricLabel, value}: {label: string; value?: number}) { return <View style={styles.metric}><Text style={styles.metricValue}>{value ?? '—'}</Text><Text style={styles.metricLabel}>{metricLabel}</Text></View>; }
function SectionTitle({title, action, onAction}: {title: string; action: string; onAction: () => void}) { return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text><Pressable onPress={onAction}><Text style={styles.link}>{action}</Text></Pressable></View>; }
function Empty({text}: {text: string}) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function Badge({status}: {status: ServiceRequestStatus}) { return <View style={styles.badge}><Text style={styles.badgeText}>{label(status)}</Text></View>; }
function InfoCard({title, rows}: {title: string; rows: (string | undefined)[]}) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{rows.filter(Boolean).map(row => <Text key={row} style={styles.cardText}>{row}</Text>)}</View>; }
function JobCard({job, onPress}: {job: AssignedJob; onPress: () => void}) { return <Pressable style={styles.card} onPress={onPress}><View style={styles.jobTop}><View style={styles.jobCopy}><Text style={styles.requestId}>{job.requestId}</Text><Text style={styles.cardTitle}>{job.customerName}</Text></View><Badge status={job.status}/></View><Text style={styles.cardText}>{job.buildingName} · {job.liftIdentifier}</Text><Text style={styles.issue}>{job.issue}</Text><Text style={styles.priority}>{job.priority} PRIORITY</Text></Pressable>; }
function BottomNav({screen, onChange}: {screen: Exclude<Screen, 'detail'>; onChange: (screen: Screen) => void}) { return <View style={styles.nav}>{(['dashboard', 'jobs', 'profile'] as const).map(item => <Pressable key={item} style={styles.navItem} onPress={() => onChange(item)}><Text style={[styles.navText, screen === item && styles.navActive]}>{label(item)}</Text></Pressable>)}</View>; }

const colors = {background: '#F7F8FA', surface: '#FFFFFF', text: '#17212B', muted: '#68737E', primary: '#0B6E69', border: '#E3E7EB', warning: '#A55006'};
const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background}, app: {flex: 1}, header: {height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border}, headerButton: {width: 58}, headerButtonText: {color: colors.primary, fontWeight: '700'}, logo: {fontSize: 18, fontWeight: '900', letterSpacing: 3, color: colors.primary}, content: {padding: 18, paddingBottom: 34}, hero: {paddingVertical: 12}, kicker: {fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: colors.primary, marginBottom: 7}, title: {fontSize: 26, fontWeight: '800', color: colors.text}, screenTitle: {fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6}, muted: {color: colors.muted, lineHeight: 20}, availability: {marginTop: 12, color: colors.primary, fontWeight: '700'}, metrics: {flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 22}, metric: {width: '50%', padding: 4}, metricValue: {backgroundColor: colors.surface, color: colors.primary, fontSize: 26, fontWeight: '800', paddingTop: 14, paddingHorizontal: 14}, metricLabel: {backgroundColor: colors.surface, color: colors.muted, paddingHorizontal: 14, paddingBottom: 14}, sectionTitle: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}, sectionHeading: {fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 10}, link: {color: colors.primary, fontWeight: '700'}, card: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 15, marginBottom: 10}, cardTitle: {fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 5}, cardText: {color: colors.muted, lineHeight: 20}, jobTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}, jobCopy: {flex: 1, paddingRight: 8}, requestId: {fontSize: 12, color: colors.muted, marginBottom: 3}, badge: {alignSelf: 'flex-start', backgroundColor: '#E2F1EF', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5}, badgeText: {fontSize: 11, color: colors.primary, fontWeight: '800'}, issue: {color: colors.text, marginTop: 8}, priority: {color: colors.warning, fontSize: 11, fontWeight: '800', marginTop: 9}, outlineButton: {borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 8}, outlineButtonText: {color: colors.primary, fontWeight: '800'}, listScreen: {flex: 1, padding: 18}, jobList: {paddingTop: 14, paddingBottom: 8, flexGrow: 1}, loader: {marginTop: 30}, empty: {backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginVertical: 10, alignItems: 'center'}, statusButton: {backgroundColor: colors.primary, borderRadius: 10, padding: 14, marginBottom: 10, alignItems: 'center'}, statusButtonText: {color: '#FFFFFF', fontWeight: '800'}, setup: {flex: 1, padding: 30, justifyContent: 'center'}, setupTitle: {fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 10}, setupText: {color: colors.muted, fontSize: 16, lineHeight: 24}, error: {backgroundColor: '#FFF3E8', paddingVertical: 9, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, errorText: {color: '#843900', flex: 1, marginRight: 12}, retry: {color: colors.primary, fontWeight: '800'}, nav: {flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border}, navItem: {flex: 1, alignItems: 'center', paddingVertical: 15}, navText: {color: colors.muted, fontWeight: '700'}, navActive: {color: colors.primary},
});
