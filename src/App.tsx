import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {environment} from './config/environment';
import {setSessionExpiredHandler} from './api/client';
import {technicianApi} from './api/technicianApi';
import {tokenStorage} from './storage/tokens';
import type {
  AttachmentView,
  AvailabilityStatus,
  JobDetail,
  NotificationView,
  PageView,
  ReportView,
  RequestStatus,
  RequestView,
  TechnicianDashboard,
  TechnicianProfileView,
  VisitView,
  UploadFile,
} from './types/technician';

type Screen = 'dashboard' | 'jobs' | 'visits' | 'notifications' | 'history' | 'profile' | 'jobDetail' | 'visitDetail';
type ModalMode = 'report' | 'transition' | 'visitCancel' | 'reschedule' | 'additionalVisit' | 'attachment';
type SessionState = 'booting' | 'anonymous' | 'authenticated';
type TrackingState = {
  active: boolean;
  permission: 'unknown' | 'granted' | 'denied';
  lastSubmittedAt?: string;
  error?: string;
};

const IN_PROGRESS: RequestStatus[] = ['ACCEPTED', 'ON_THE_WAY', 'REACHED_SITE', 'DIAGNOSIS', 'REPAIR_IN_PROGRESS', 'WAITING_FOR_PARTS', 'TESTING'];
const TRACKABLE: RequestStatus[] = ['ON_THE_WAY', 'REACHED_SITE', 'DIAGNOSIS', 'REPAIR_IN_PROGRESS', 'WAITING_FOR_PARTS', 'TESTING'];
const HISTORY_FILTERS: Array<{label: string; status?: RequestStatus; emergency?: boolean}> = [
  {label: 'All'},
  {label: 'Completed', status: 'COMPLETED'},
  {label: 'Cancelled', status: 'CANCELLED'},
  {label: 'Emergency', emergency: true},
];
const JOB_FILTERS: Array<{label: string; status?: RequestStatus; statuses?: RequestStatus[]}> = [
  {label: 'All'},
  {label: 'Pending', status: 'ASSIGNED'},
  {label: 'In Progress', statuses: IN_PROGRESS},
  {label: 'Completed', status: 'COMPLETED'},
  {label: 'Cancelled', status: 'CANCELLED'},
];
const AVAILABILITY: AvailabilityStatus[] = ['AVAILABLE', 'BUSY', 'OFF_DUTY', 'ON_LEAVE'];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SUPPORTED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const LOCATION_INTERVAL_MS = 5 * 60 * 1000;

const label = (value?: string | null) => value ? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Unavailable';
const requestTitle = (request: RequestView) => request.serviceId || `SR-${request.id}`;
const requestSummary = (request: RequestView) => request.title || request.description || label(request.serviceType);
const visitTitle = (visit: VisitView) => visit.serviceId || `Request ${visit.serviceRequestId}`;
const visitContext = (visit: VisitView) => [
  visit.title,
  visit.liftId ? `Lift ID ${visit.liftId}` : null,
  visit.customerProfileId ? `Customer profile ${visit.customerProfileId}` : null,
  visit.technicianEmployeeId ? `Technician ${visit.technicianEmployeeId}` : null,
].filter(Boolean).join(' - ') || 'Visit context unavailable';
const err = (error: unknown) => error instanceof Error ? error.message : 'Valor request failed.';

export default function App() {
  const [session, setSession] = useState<SessionState>('booting');
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [dashboard, setDashboard] = useState<TechnicianDashboard | null>(null);
  const [profile, setProfile] = useState<TechnicianProfileView | null>(null);
  const [jobs, setJobs] = useState<PageView<RequestView> | null>(null);
  const [history, setHistory] = useState<PageView<RequestView> | null>(null);
  const [visits, setVisits] = useState<PageView<VisitView> | null>(null);
  const [notifications, setNotifications] = useState<PageView<NotificationView> | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitView | null>(null);
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [jobFilter, setJobFilter] = useState(0);
  const [historyFilter, setHistoryFilter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null);
  const [pendingVisitStatus, setPendingVisitStatus] = useState<'IN_PROGRESS' | 'COMPLETED' | null>(null);
  const [tracking, setTracking] = useState<TrackingState>({active: false, permission: 'unknown'});

  const expire = useCallback(() => {
    setSession('anonymous');
    setDashboard(null);
    setProfile(null);
    setSelectedJob(null);
    setMessage('Your session expired. Please sign in again.');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(expire);
    return () => setSessionExpiredHandler(undefined);
  }, [expire]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [nextDashboard, nextProfile, nextJobs, nextVisits, nextNotifications] = await Promise.all([
        technicianApi.dashboard(),
        technicianApi.profile(),
        technicianApi.jobs({page: 0, size: 20}),
        technicianApi.visits({page: 0, size: 20}),
        technicianApi.notifications(),
      ]);
      setDashboard(nextDashboard);
      setProfile(nextProfile);
      setJobs(nextJobs);
      setVisits(nextVisits);
      setNotifications(nextNotifications);
    } catch (error) {
      setMessage(err(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (!environment.apiBaseUrl) {
      setSession('anonymous');
      return;
    }
    try {
      const tokens = await tokenStorage.getTokens();
      if (!tokens) {
        setSession('anonymous');
        return;
      }
      const current = await technicianApi.currentUser();
      if (current.role !== 'TECHNICIAN') {
        await tokenStorage.clear();
        setMessage('This account cannot use the Technician app.');
        setSession('anonymous');
        return;
      }
      setSession('authenticated');
      await loadCore();
    } catch (error) {
      await tokenStorage.clear();
      setMessage(err(error));
      setSession('anonymous');
    }
  }, [loadCore]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const request = selectedJob?.request;
    const trackable = !!request && screen === 'jobDetail' && TRACKABLE.includes(request.status);
    const submit = async () => {
      if (!request || cancelled) return;
      try {
        const position = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
        const timestamp = new Date().toISOString();
        await technicianApi.updateLocation(request.id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp,
        });
        if (!cancelled) setTracking({active: true, permission: 'granted', lastSubmittedAt: timestamp});
      } catch (error) {
        if (!cancelled) setTracking(current => ({...current, active: trackable, error: err(error)}));
      }
    };
    const start = async () => {
      if (!trackable) {
        setTracking(current => ({...current, active: false, error: undefined}));
        return;
      }
      setTracking(current => ({...current, active: true, error: undefined}));
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!cancelled) setTracking({active: false, permission: 'denied', error: 'Location permission is required while travelling to or working on an active job.'});
        return;
      }
      if (!cancelled) setTracking(current => ({...current, permission: 'granted'}));
      await submit();
      interval = setInterval(submit, LOCATION_INTERVAL_MS);
    };
    start();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [screen, selectedJob?.request.id, selectedJob?.request.status]);

  const openJob = async (request: RequestView) => {
    setScreen('jobDetail');
    setLoading(true);
    try {
      const detail = await technicianApi.job(request.id);
      setSelectedJob(detail);
      setAttachments(await technicianApi.attachments(request.id));
    } catch (error) {
      setMessage(err(error));
    } finally {
      setLoading(false);
    }
  };

  const openVisit = async (visit: VisitView) => {
    setScreen('visitDetail');
    setLoading(true);
    try {
      setSelectedVisit(await technicianApi.visit(visit.id));
    } catch (error) {
      setMessage(err(error));
    } finally {
      setLoading(false);
    }
  };

  const refreshJob = async (id = selectedJob?.request.id) => {
    if (!id) return;
    const detail = await technicianApi.job(id);
    setSelectedJob(detail);
    setAttachments(await technicianApi.attachments(id));
    await loadCore();
  };

  const loadJobs = async (index = jobFilter) => {
    const filter = JOB_FILTERS[index];
    setJobFilter(index);
    if (filter.status) {
      setJobs(await technicianApi.jobs({status: filter.status, page: 0, size: 20}));
    } else {
      setJobs(await technicianApi.jobs({page: 0, size: 20}));
    }
  };

  const loadHistory = async (index = historyFilter) => {
    const filter = HISTORY_FILTERS[index];
    setHistoryFilter(index);
    const response = await technicianApi.jobs({status: filter.status, page: 0, size: 50});
    const items = filter.emergency ? response.items.filter(item => item.priority === 'EMERGENCY') : response.items;
    setHistory({...response, items});
  };

  const logout = async () => {
    await technicianApi.logout();
    setSession('anonymous');
  };

  if (!environment.apiBaseUrl) {
    return <SetupScreen />;
  }

  if (session === 'booting') {
    return <Shell><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Restoring technician session...</Text></Shell>;
  }

  if (session === 'anonymous') {
    return <LoginScreen onLogin={async input => {
      setLoading(true);
      setMessage(null);
      try {
        await technicianApi.login(input);
        setSession('authenticated');
        await loadCore();
      } catch (error) {
        setMessage(err(error));
      } finally {
        setLoading(false);
      }
    }} loading={loading} message={message} />;
  }

  const activeJobs = jobs?.items.filter(item => !JOB_FILTERS[jobFilter].statuses || JOB_FILTERS[jobFilter].statuses?.includes(item.status)) ?? [];

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <View style={styles.app}>
      <Header screen={screen} onBack={() => setScreen(screen === 'visitDetail' ? 'visits' : 'jobs')} />
      {message ? <Banner message={message} onDismiss={() => setMessage(null)} /> : null}
      {screen === 'dashboard' && <Dashboard dashboard={dashboard} jobs={jobs?.items ?? []} visits={visits?.items ?? []} loading={loading} onRefresh={loadCore} onJobs={() => setScreen('jobs')} onJob={openJob} />}
      {screen === 'jobs' && <Jobs items={activeJobs} filter={jobFilter} loading={loading} onFilter={index => loadJobs(index).catch(error => setMessage(err(error)))} onJob={openJob} />}
      {screen === 'history' && <History items={history?.items ?? []} filter={historyFilter} onLoad={() => loadHistory().catch(error => setMessage(err(error)))} onFilter={index => loadHistory(index).catch(error => setMessage(err(error)))} onJob={openJob} />}
      {screen === 'jobDetail' && selectedJob && <JobDetailScreen detail={selectedJob} tracking={tracking} attachments={attachments} onTransition={(status) => { setPendingStatus(status); setModal('transition'); }} onReport={() => setModal('report')} onAttach={() => setModal('attachment')} onDeleteAttachment={async id => { await technicianApi.deleteAttachment(selectedJob.request.id, id); await refreshJob(); }} />}
      {screen === 'visits' && <Visits visits={visits?.items ?? []} loading={loading} onVisit={openVisit} onRefresh={loadCore} />}
      {screen === 'visitDetail' && selectedVisit && <VisitDetailScreen visit={selectedVisit} onStatus={status => { setPendingVisitStatus(status); setModal('transition'); }} onCancel={() => setModal('visitCancel')} onReschedule={() => setModal('reschedule')} onAdditional={() => setModal('additionalVisit')} />}
      {screen === 'notifications' && <Notifications page={notifications} onRefresh={loadCore} onRead={async id => { await technicianApi.markNotificationRead(id); await loadCore(); }} />}
      {screen === 'profile' && <Profile profile={profile} dashboard={dashboard} onAvailability={async status => { setProfile(await technicianApi.updateAvailability(status)); await loadCore(); }} onLogout={logout} />}
      {!screen.endsWith('Detail') && <BottomNav screen={screen} onChange={next => {
        if (next === 'history') loadHistory().catch(error => setMessage(err(error)));
        setScreen(next);
      }} />}
      <ActionModal
        mode={modal}
        onClose={() => { setModal(null); setPendingStatus(null); setPendingVisitStatus(null); }}
        onSubmit={async values => {
          if (modal === 'report' && selectedJob) await technicianApi.saveReport(selectedJob.request.id, {
            diagnosis: values.diagnosis,
            workPerformed: values.workPerformed,
            testingResult: values.testingResult,
            completionNotes: values.completionNotes,
          });
          if (modal === 'transition' && selectedJob && pendingStatus) await technicianApi.transition(selectedJob.request.id, pendingStatus, values.notes);
          if (modal === 'transition' && selectedVisit && pendingVisitStatus) setSelectedVisit(await technicianApi.updateVisitStatus(selectedVisit.id, pendingVisitStatus, values.notes));
          if (modal === 'visitCancel' && selectedVisit) setSelectedVisit(await technicianApi.cancelVisit(selectedVisit.id, values.reason));
          if (modal === 'reschedule' && selectedVisit) await technicianApi.requestReschedule(selectedVisit.id, {
            reason: values.reason,
            requestedDate: values.requestedDate,
            requestedStartTime: values.requestedStartTime,
            requestedEndTime: values.requestedEndTime,
          });
          if (modal === 'additionalVisit' && selectedVisit) await technicianApi.requestAdditionalVisit(selectedVisit.id, {
            reason: values.reason,
            requestedDate: values.requestedDate,
            requestedStartTime: values.requestedStartTime,
            requestedEndTime: values.requestedEndTime,
          });
          if (modal === 'attachment' && selectedJob) await technicianApi.uploadAttachment(selectedJob.request.id, parseAttachment(values));
          setModal(null);
          setMessage('Saved successfully.');
          if (selectedJob) await refreshJob();
          await loadCore();
        }}
        onError={error => {
          setMessage(err(error));
        }}
      />
    </View>
  </SafeAreaView>;
}

function SetupScreen() {
  return <Shell><Text style={styles.logo}>VALOR</Text><Text style={styles.title}>Connect the technician app</Text><Text style={styles.muted}>Set EXPO_PUBLIC_API_BASE_URL in .env and rebuild the app.</Text></Shell>;
}

function LoginScreen({onLogin, loading, message}: {onLogin: (input: {email: string; password: string}) => void; loading: boolean; message: string | null}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <Shell>
    <Text style={styles.logo}>VALOR</Text>
    <Text style={styles.title}>Technician sign in</Text>
    <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
    {message ? <Text style={styles.errorText}>{message}</Text> : null}
    <Pressable style={[styles.primaryButton, loading && styles.disabled]} disabled={loading || !email.trim() || !password} onPress={() => onLogin({email, password})}>
      <Text style={styles.primaryText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
    </Pressable>
  </Shell>;
}

function Shell({children}: {children: React.ReactNode}) {
  return <SafeAreaView style={styles.safe}><View style={styles.center}>{children}</View></SafeAreaView>;
}

function Header({screen, onBack}: {screen: Screen; onBack: () => void}) {
  const detail = screen === 'jobDetail' || screen === 'visitDetail';
  return <View style={styles.header}>
    <Pressable disabled={!detail} onPress={onBack} style={styles.headerButton}><Text style={styles.link}>{detail ? 'Back' : ''}</Text></Pressable>
    <Text style={styles.logo}>VALOR</Text>
    <View style={styles.headerButton} />
  </View>;
}

function Banner({message, onDismiss}: {message: string; onDismiss: () => void}) {
  return <Pressable style={styles.banner} onPress={onDismiss}><Text style={styles.errorText}>{message}</Text></Pressable>;
}

function Dashboard({dashboard, jobs, visits, loading, onRefresh, onJobs, onJob}: {dashboard: TechnicianDashboard | null; jobs: RequestView[]; visits: VisitView[]; loading: boolean; onRefresh: () => void; onJobs: () => void; onJob: (job: RequestView) => void}) {
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>TECHNICIAN WORKSPACE</Text>
    <Text style={styles.title}>Good day, {dashboard?.profile.employeeId || dashboard?.profile.email || 'Technician'}</Text>
    <Text style={styles.muted}>{dashboard?.profile.assignedArea || dashboard?.profile.specialization || 'Assigned Valor service area'}</Text>
    <Badge text={label(dashboard?.profile.availabilityStatus)} tone="info" />
    <View style={styles.metrics}>
      <Metric label="Assigned" value={dashboard?.assignedJobs} />
      <Metric label="Pending" value={dashboard?.pendingJobs} />
      <Metric label="In Progress" value={dashboard?.inProgressJobs} />
      <Metric label="Completed" value={dashboard?.completedJobs} />
      <Metric label="Today Visits" value={dashboard?.todaysScheduledVisits} />
      <Metric label="Emergency" value={dashboard?.emergencyJobs} danger />
    </View>
    <SectionTitle title="Assigned jobs" action="View all" onAction={onJobs} />
    {loading && !dashboard ? <ActivityIndicator color={colors.primary} /> : jobs.slice(0, 3).map(job => <JobCard key={job.id} job={job} onPress={() => onJob(job)} />)}
    {jobs.length === 0 ? <Empty text="No assigned jobs." /> : null}
    <SectionTitle title="Visits" action="Refresh" onAction={onRefresh} />
    {visits.slice(0, 3).map(visit => <VisitCard key={visit.id} visit={visit} />)}
  </ScrollView>;
}

function Jobs({items, filter, loading, onFilter, onJob}: {items: RequestView[]; filter: number; loading: boolean; onFilter: (index: number) => void; onJob: (job: RequestView) => void}) {
  return <View style={styles.contentFill}>
    <Text style={styles.title}>Jobs</Text>
    <FilterBar labels={JOB_FILTERS.map(item => item.label)} active={filter} onChange={onFilter} />
    {loading ? <ActivityIndicator color={colors.primary} /> : <FlatList data={items} keyExtractor={item => String(item.id)} renderItem={({item}) => <JobCard job={item} onPress={() => onJob(item)} />} ListEmptyComponent={<Empty text="No jobs for this filter." />} />}
  </View>;
}

function History({items, filter, onLoad, onFilter, onJob}: {items: RequestView[]; filter: number; onLoad: () => void; onFilter: (index: number) => void; onJob: (job: RequestView) => void}) {
  useEffect(() => { onLoad(); }, []);
  return <View style={styles.contentFill}>
    <Text style={styles.title}>History</Text>
    <FilterBar labels={HISTORY_FILTERS.map(item => item.label)} active={filter} onChange={onFilter} />
    <FlatList data={items} keyExtractor={item => String(item.id)} renderItem={({item}) => <JobCard job={item} onPress={() => onJob(item)} />} ListEmptyComponent={<Empty text="No history for this filter." />} />
  </View>;
}

function JobDetailScreen({detail, tracking, attachments, onTransition, onReport, onAttach, onDeleteAttachment}: {detail: JobDetail; tracking: TrackingState; attachments: AttachmentView[]; onTransition: (status: RequestStatus) => void; onReport: () => void; onAttach: () => void; onDeleteAttachment: (id: number) => void}) {
  const actions = allowedTransitions(detail.request.status).filter(status => status !== 'COMPLETED' || !!detail.report);
  const openAttachment = async (attachment: AttachmentView) => {
    const url = technicianApi.attachmentUrl(detail.request.id, attachment.id);
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>{requestTitle(detail.request)}</Text>
    <Text style={styles.title}>{requestSummary(detail.request)}</Text>
    <Badge text={label(detail.request.status)} tone={detail.request.priority === 'EMERGENCY' ? 'danger' : 'info'} />
    <Info title="Live tracking" rows={[
      tracking.active ? 'Tracking active' : 'Tracking inactive',
      tracking.permission === 'denied' ? 'Location permission denied' : tracking.permission === 'granted' ? 'Location permission granted' : 'Location permission not requested',
      tracking.lastSubmittedAt ? `Last sent: ${new Date(tracking.lastSubmittedAt).toLocaleString()}` : null,
      tracking.error,
    ]} />
    <Info title="Request" rows={[label(detail.request.serviceType), detail.request.description, detail.request.customerRemarks, detail.request.preferredVisitDate, detail.request.preferredTimeSlot]} />
    <Info title="Assignment" rows={[detail.activeAssignment?.status && label(detail.activeAssignment.status), detail.activeAssignment?.notes]} />
    <Info title="Report" rows={detail.report ? [detail.report.diagnosis, detail.report.workPerformed, detail.report.testingResult, detail.report.completionNotes] : ['No report saved yet.']} />
    <Text style={styles.sectionHeading}>Lifecycle</Text>
    {actions.map(status => <Pressable key={status} style={styles.primaryButton} onPress={() => onTransition(status)}><Text style={styles.primaryText}>{label(status)}</Text></Pressable>)}
    {detail.request.status === 'TESTING' ? <Pressable style={styles.primaryButton} onPress={onReport}><Text style={styles.primaryText}>Save service report</Text></Pressable> : null}
    <SectionTitle title="Attachments" action="Add" onAction={onAttach} />
    {attachments.map(item => <View key={item.id} style={styles.row}><Pressable style={styles.rowText} onPress={() => openAttachment(item)}><Text style={styles.rowText}>{item.originalFilename} ({Math.round(item.fileSize / 1024)} KB)</Text><Text style={styles.muted}>{item.contentType}</Text></Pressable><Pressable onPress={() => onDeleteAttachment(item.id)}><Text style={styles.danger}>Delete</Text></Pressable></View>)}
    {attachments.length === 0 ? <Empty text="No attachments yet." /> : null}
  </ScrollView>;
}

function Visits({visits, loading, onVisit, onRefresh}: {visits: VisitView[]; loading: boolean; onVisit: (visit: VisitView) => void; onRefresh: () => void}) {
  return <View style={styles.contentFill}>
    <SectionTitle title="Visits" action="Refresh" onAction={onRefresh} />
    {loading ? <ActivityIndicator color={colors.primary} /> : <FlatList data={visits} keyExtractor={item => String(item.id)} renderItem={({item}) => <VisitCard visit={item} onPress={() => onVisit(item)} />} ListEmptyComponent={<Empty text="No visits assigned." />} />}
  </View>;
}

function VisitDetailScreen({visit, onStatus, onCancel, onReschedule, onAdditional}: {visit: VisitView; onStatus: (status: 'IN_PROGRESS' | 'COMPLETED') => void; onCancel: () => void; onReschedule: () => void; onAdditional: () => void}) {
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>{visitTitle(visit)}</Text>
    <Text style={styles.title}>Visit detail</Text>
    <Badge text={label(visit.status)} tone="info" />
    <Info title="Schedule" rows={[visit.scheduledDate, `${visit.startTime} - ${visit.endTime}`, visit.notes]} />
    <Info title="Context" rows={[visit.title, visit.liftId ? `Lift ID ${visit.liftId}` : null, visit.customerProfileId ? `Customer profile ${visit.customerProfileId}` : null, visit.technicianProfileId ? `Technician profile ${visit.technicianProfileId}` : null]} />
    {visit.status === 'SCHEDULED' ? <Pressable style={styles.primaryButton} onPress={() => onStatus('IN_PROGRESS')}><Text style={styles.primaryText}>Start visit</Text></Pressable> : null}
    {visit.status === 'IN_PROGRESS' ? <Pressable style={styles.primaryButton} onPress={() => onStatus('COMPLETED')}><Text style={styles.primaryText}>Complete visit</Text></Pressable> : null}
    {visit.status !== 'CANCELLED' && visit.status !== 'COMPLETED' ? <>
      <Pressable style={styles.outlineButton} onPress={onReschedule}><Text style={styles.outlineText}>Request reschedule</Text></Pressable>
      <Pressable style={styles.outlineButton} onPress={onAdditional}><Text style={styles.outlineText}>Request additional visit</Text></Pressable>
      <Pressable style={styles.dangerButton} onPress={onCancel}><Text style={styles.primaryText}>Cancel visit</Text></Pressable>
    </> : null}
  </ScrollView>;
}

function Notifications({page, onRefresh, onRead}: {page: PageView<NotificationView> | null; onRefresh: () => void; onRead: (id: number) => void}) {
  return <View style={styles.contentFill}>
    <SectionTitle title="Notifications" action="Refresh" onAction={onRefresh} />
    <FlatList data={page?.items ?? []} keyExtractor={item => String(item.id)} renderItem={({item}) => <Pressable style={styles.card} onPress={() => onRead(item.id)}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.message}</Text><Badge text={label(item.status)} tone={item.status === 'READ' ? 'muted' : 'info'} /></Pressable>} ListEmptyComponent={<Empty text="No notifications." />} />
  </View>;
}

function Profile({profile, dashboard, onAvailability, onLogout}: {profile: TechnicianProfileView | null; dashboard: TechnicianDashboard | null; onAvailability: (status: AvailabilityStatus) => void; onLogout: () => void}) {
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Profile</Text>
    <Info title="Technician" rows={[profile?.email, profile?.phone, profile?.employeeId, profile?.assignedArea, profile?.specialization]} />
    <Info title="Performance" rows={[`Completed jobs: ${dashboard?.completedJobs ?? 0}`, `This quarter: ${dashboard?.completedThisQuarter ?? 0}`]} />
    <Text style={styles.sectionHeading}>Availability</Text>
    {AVAILABILITY.map(status => <Pressable key={status} style={[styles.outlineButton, profile?.availabilityStatus === status && styles.selected]} onPress={() => onAvailability(status)}><Text style={styles.outlineText}>{label(status)}</Text></Pressable>)}
    <Pressable style={styles.dangerButton} onPress={onLogout}><Text style={styles.primaryText}>Logout</Text></Pressable>
  </ScrollView>;
}

function ActionModal({mode, onClose, onSubmit, onError}: {mode: ModalMode | null; onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void>; onError: (error: unknown) => void}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  useEffect(() => setValues({}), [mode]);
  const fields = modalFields(mode);
  const chooseImage = async (source: 'camera' | 'library') => {
    setPickerError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPickerError('Camera permission is required to take a photo.');
        return;
      }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({mediaTypes: ['images'], quality: 0.8})
      : await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 0.8});
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) {
      setPickerError('No image selected.');
      return;
    }
    try {
      setValues(assetToUploadValues(asset));
    } catch (error) {
      setPickerError(err(error));
    }
  };
  const chooseDocument = async () => {
    setPickerError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        return;
      }
      const file = result.assets[0];
      if (!file) {
        setPickerError('No document selected.');
        return;
      }
      setValues(validateUploadFile({
        uri: file.uri,
        name: file.name || 'document.pdf',
        type: file.mimeType || 'application/pdf',
        size: file.size,
      }));
    } catch (error) {
      setPickerError(err(error));
      return;
    }
  };
  return <Modal visible={!!mode} animationType="slide" onRequestClose={onClose} transparent>
    <View style={styles.modalBackdrop}><View style={styles.modal}>
      <Text style={styles.sectionHeading}>{modalTitle(mode)}</Text>
      {mode === 'attachment' ? <>
        <Text style={styles.muted}>Choose a JPEG, PNG, WebP, or PDF up to 10 MB.</Text>
        <View style={styles.attachmentActions}>
          <Pressable style={styles.outlineButton} onPress={() => chooseImage('camera')}><Text style={styles.outlineText}>Camera</Text></Pressable>
          <Pressable style={styles.outlineButton} onPress={() => chooseImage('library')}><Text style={styles.outlineText}>Gallery</Text></Pressable>
          <Pressable style={styles.outlineButton} onPress={chooseDocument}><Text style={styles.outlineText}>PDF</Text></Pressable>
        </View>
        {values.name ? <View style={styles.selectedFile}><Text style={styles.cardTitle}>{values.name}</Text><Text style={styles.muted}>{values.type}</Text></View> : <Empty text="No file selected." />}
        {pickerError ? <Text style={styles.errorText}>{pickerError}</Text> : null}
      </> : fields.map(field => <Input key={field} label={label(field)} value={values[field] ?? ''} onChangeText={text => setValues(current => ({...current, [field]: text}))} multiline={field.includes('notes') || field.includes('reason') || field.includes('diagnosis') || field.includes('work')} />)}
      <View style={styles.actions}><Pressable style={styles.outlineButton} disabled={saving} onPress={onClose}><Text style={styles.outlineText}>Cancel</Text></Pressable><Pressable style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={async () => { setSaving(true); try { await onSubmit(values); } catch (error) { onError(error); } finally { setSaving(false); } }}><Text style={styles.primaryText}>{saving ? 'Saving...' : 'Submit'}</Text></Pressable></View>
    </View></View>
  </Modal>;
}

function modalFields(mode: ModalMode | null) {
  if (mode === 'report') return ['diagnosis', 'workPerformed', 'testingResult', 'completionNotes'];
  if (mode === 'transition') return ['notes'];
  if (mode === 'visitCancel') return ['reason'];
  if (mode === 'reschedule' || mode === 'additionalVisit') return ['reason', 'requestedDate', 'requestedStartTime', 'requestedEndTime'];
  if (mode === 'attachment') return [];
  return [];
}

function modalTitle(mode: ModalMode | null) {
  if (mode === 'report') return 'Service report';
  if (mode === 'visitCancel') return 'Cancel visit';
  if (mode === 'reschedule') return 'Request reschedule';
  if (mode === 'additionalVisit') return 'Request additional visit';
  if (mode === 'attachment') return 'Upload attachment';
  return 'Confirm action';
}

function allowedTransitions(status: RequestStatus): RequestStatus[] {
  switch (status) {
    case 'ASSIGNED': return ['ACCEPTED', 'CANCELLED'];
    case 'ACCEPTED': return ['ON_THE_WAY', 'CANCELLED'];
    case 'ON_THE_WAY': return ['REACHED_SITE', 'CANCELLED'];
    case 'REACHED_SITE': return ['DIAGNOSIS', 'CANCELLED'];
    case 'DIAGNOSIS': return ['REPAIR_IN_PROGRESS', 'CANCELLED'];
    case 'REPAIR_IN_PROGRESS': return ['WAITING_FOR_PARTS', 'TESTING', 'CANCELLED'];
    case 'WAITING_FOR_PARTS': return ['REPAIR_IN_PROGRESS', 'CANCELLED'];
    case 'TESTING': return ['COMPLETED', 'CANCELLED'];
    default: return [];
  }
}

function assetToUploadValues(asset: ImagePicker.ImagePickerAsset) {
  return validateUploadFile({
    uri: asset.uri,
    name: asset.fileName || 'photo.jpg',
    type: asset.mimeType || 'image/jpeg',
    size: asset.fileSize,
  });
}

function validateUploadFile(file: Partial<UploadFile> & {size?: number}) {
  if (!file.uri) throw new Error('Selected file is missing a URI.');
  if (!file.name) throw new Error('Selected file is missing a name.');
  if (!file.type || !SUPPORTED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error('Unsupported file type. Use JPEG, PNG, WebP, or PDF.');
  }
  if (file.size && file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Attachment must be 10 MB or smaller.');
  }
  return {uri: file.uri, name: file.name, type: file.type, size: file.size ? String(file.size) : ''};
}

function parseAttachment(values: Record<string, string>): UploadFile {
  const file = validateUploadFile({uri: values.uri, name: values.name, type: values.type, size: values.size ? Number(values.size) : undefined});
  return {uri: file.uri, name: file.name, type: file.type};
}

function FilterBar({labels, active, onChange}: {labels: string[]; active: number; onChange: (index: number) => void}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>{labels.map((item, index) => <Pressable key={item} style={[styles.filter, active === index && styles.selected]} onPress={() => onChange(index)}><Text style={styles.outlineText}>{item}</Text></Pressable>)}</ScrollView>;
}

function JobCard({job, onPress}: {job: RequestView; onPress: () => void}) {
  return <Pressable style={styles.card} onPress={onPress}>
    <View style={styles.rowBetween}><Text style={styles.cardTitle}>{requestTitle(job)}</Text><Badge text={label(job.status)} tone={job.priority === 'EMERGENCY' ? 'danger' : 'info'} /></View>
    <Text style={styles.muted}>{requestSummary(job)}</Text>
    <Text style={styles.muted}>{label(job.serviceType)} - {label(job.priority)}</Text>
  </Pressable>;
}

function VisitCard({visit, onPress}: {visit: VisitView; onPress?: () => void}) {
  return <Pressable style={styles.card} disabled={!onPress} onPress={onPress}>
    <View style={styles.rowBetween}><Text style={styles.cardTitle}>{visitTitle(visit)}</Text><Badge text={label(visit.status)} tone="info" /></View>
    <Text style={styles.muted}>{visit.scheduledDate} - {visit.startTime} to {visit.endTime}</Text>
    <Text style={styles.muted}>{visitContext(visit)}</Text>
  </Pressable>;
}

function Metric({label: metricLabel, value, danger}: {label: string; value?: number; danger?: boolean}) {
  return <View style={styles.metric}><Text style={[styles.metricValue, danger && styles.danger]}>{value ?? 0}</Text><Text style={styles.muted}>{metricLabel}</Text></View>;
}

function Info({title, rows}: {title: string; rows: Array<string | number | null | undefined>}) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{rows.filter(Boolean).map(row => <Text key={String(row)} style={styles.muted}>{row}</Text>)}</View>;
}

function SectionTitle({title, action, onAction}: {title: string; action: string; onAction: () => void}) {
  return <View style={styles.rowBetween}><Text style={styles.sectionHeading}>{title}</Text><Pressable onPress={onAction}><Text style={styles.link}>{action}</Text></Pressable></View>;
}

function Empty({text}: {text: string}) {
  return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>;
}

function Badge({text, tone}: {text: string; tone: 'info' | 'danger' | 'muted'}) {
  return <View style={[styles.badge, tone === 'danger' && styles.badgeDanger, tone === 'muted' && styles.badgeMuted]}><Text style={styles.badgeText}>{text}</Text></View>;
}

function BottomNav({screen, onChange}: {screen: Screen; onChange: (screen: Screen) => void}) {
  const items: Array<{screen: Screen; label: string}> = [
    {screen: 'dashboard', label: 'Home'},
    {screen: 'jobs', label: 'Jobs'},
    {screen: 'visits', label: 'Visits'},
    {screen: 'notifications', label: 'Alerts'},
    {screen: 'history', label: 'History'},
    {screen: 'profile', label: 'Profile'},
  ];
  return <View style={styles.nav}>{items.map(item => <Pressable key={item.screen} style={styles.navItem} onPress={() => onChange(item.screen)}><Text style={[styles.navText, screen === item.screen && styles.navActive]}>{item.label}</Text></Pressable>)}</View>;
}

function Input(props: React.ComponentProps<typeof TextInput> & {label: string}) {
  const {label: inputLabel, ...rest} = props;
  return <View style={styles.inputGroup}><Text style={styles.inputLabel}>{inputLabel}</Text><TextInput {...rest} style={[styles.input, props.multiline && styles.textarea]} placeholderTextColor={colors.muted} /></View>;
}

const colors = {background: '#F7F8FA', surface: '#FFFFFF', text: '#17212B', muted: '#68737E', primary: '#0B6E69', border: '#E3E7EB', danger: '#A73535', warn: '#A55006'};
const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  app: {flex: 1},
  center: {flex: 1, justifyContent: 'center', padding: 24, gap: 14},
  header: {height: 56, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerButton: {width: 60},
  logo: {fontSize: 18, fontWeight: '900', letterSpacing: 3, color: colors.primary},
  content: {padding: 16, paddingBottom: 96, gap: 10},
  contentFill: {flex: 1, padding: 16, paddingBottom: 86},
  kicker: {fontSize: 11, color: colors.primary, fontWeight: '900', letterSpacing: 1},
  title: {fontSize: 25, color: colors.text, fontWeight: '900', marginBottom: 6},
  sectionHeading: {fontSize: 17, color: colors.text, fontWeight: '900', marginVertical: 8},
  muted: {color: colors.muted, lineHeight: 20},
  link: {color: colors.primary, fontWeight: '800'},
  banner: {backgroundColor: '#FFF3E8', padding: 12, borderBottomWidth: 1, borderColor: '#FFD9B8'},
  errorText: {color: colors.danger, lineHeight: 20},
  metrics: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12},
  metric: {width: '31%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12},
  metricValue: {fontSize: 25, color: colors.primary, fontWeight: '900'},
  card: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, marginBottom: 10},
  cardTitle: {fontSize: 16, color: colors.text, fontWeight: '900', marginBottom: 5},
  row: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8},
  rowText: {color: colors.text, flex: 1},
  rowBetween: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10},
  empty: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 18, alignItems: 'center', marginVertical: 8},
  badge: {alignSelf: 'flex-start', backgroundColor: '#E2F1EF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5},
  badgeDanger: {backgroundColor: '#F9E0E0'},
  badgeMuted: {backgroundColor: '#ECEFF2'},
  badgeText: {color: colors.primary, fontSize: 11, fontWeight: '900'},
  filters: {maxHeight: 48, marginBottom: 10},
  filter: {borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, backgroundColor: colors.surface},
  selected: {borderColor: colors.primary, backgroundColor: '#E2F1EF'},
  primaryButton: {backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginVertical: 5},
  dangerButton: {backgroundColor: colors.danger, borderRadius: 10, padding: 14, alignItems: 'center', marginVertical: 5},
  outlineButton: {borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 13, alignItems: 'center', marginVertical: 5},
  primaryText: {color: '#FFFFFF', fontWeight: '900'},
  outlineText: {color: colors.primary, fontWeight: '800'},
  disabled: {opacity: 0.5},
  danger: {color: colors.danger},
  nav: {position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10},
  navItem: {alignItems: 'center', minWidth: 50},
  navText: {fontSize: 11, color: colors.muted, fontWeight: '700'},
  navActive: {color: colors.primary},
  inputGroup: {gap: 5, marginBottom: 8},
  inputLabel: {fontSize: 12, color: colors.muted, fontWeight: '800'},
  input: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text},
  textarea: {minHeight: 78, textAlignVertical: 'top'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end'},
  modal: {backgroundColor: colors.background, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%'},
  actions: {flexDirection: 'row', gap: 10},
  attachmentActions: {flexDirection: 'row', gap: 8, marginVertical: 10},
  selectedFile: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10},
});
