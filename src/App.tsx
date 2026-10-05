import BottomNav from "./components/TechnicianTabBar";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";
import VisitsScreen from "./screens/VisitsScreen";
import Dashboard from "./screens/DashboardScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import { ServiceHero, ServiceReveal, ServiceSection } from "./components/ServiceExperience";
import ArrivalVerification from "./components/ArrivalVerification";
import { LinearGradient } from "expo-linear-gradient";
import { colors, styles } from "./theme/screenStyles";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { environment } from "./config/environment";
import { setSessionExpiredHandler } from "./api/client";
import { technicianApi } from "./api/technicianApi";
import {
  technicianApplicationApi,
  type TechnicianApplication,
  type TechnicianApplicationDocument,
} from "./api/technicianApplicationApi";
import { tokenStorage } from "./storage/tokens";
import { type Screen } from "./screens/screenRegistry";
import {
  ensureBackgroundTracking,
  stopBackgroundTracking,
} from "./tracking/backgroundLocation";
import type {
  AttachmentView,
  AvailabilityStatus,
  JobDetail,
  JobChecklistView,
  CompletionOtpState,
  ArrivalOtpState,
  NotificationView,
  PageView,
  ReportView,
  RequestStatus,
  RequestView,
  TechnicianDashboard,
  TechnicianProfileView,
  PrivateAttachmentView,
  VisitView,
  UploadFile,
  TechnicianServicePayment,
  LocationView,
} from "./types/technician";

type ModalMode =
  | "report"
  | "transition"
  | "visitCancel"
  | "reschedule"
  | "additionalVisit"
  | "attachment"
  | "privateAttachment";
type SessionState = "booting" | "anonymous" | "authenticated";
type AuthStage =
  | "welcome"
  | "login"
  | "basic"
  | "otp"
  | "professional"
  | "documents"
  | "review"
  | "submitted"
  | "verification"
  | "approved";
type TrackingState = {
  active: boolean;
  permission: "unknown" | "granted" | "denied";
  lastSubmittedAt?: string;
  background?: string;
  error?: string;
};
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const IN_PROGRESS: RequestStatus[] = [
  "ON_THE_WAY",
  "REACHED_SITE",
  "DIAGNOSIS",
  "REPAIR_IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "TESTING",
];
const TRACKABLE: RequestStatus[] = [
  "ON_THE_WAY",
  "REACHED_SITE",
  "DIAGNOSIS",
  "REPAIR_IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "TESTING",
];
const HISTORY_FILTERS: Array<{
  label: string;
  status?: RequestStatus;
  emergency?: boolean;
}> = [
  { label: "All" },
  { label: "Completed", status: "COMPLETED" },
  { label: "Cancelled", status: "CANCELLED" },
  { label: "Emergency", emergency: true },
];
const JOB_FILTERS: Array<{
  label: string;
  status?: RequestStatus;
  statuses?: RequestStatus[];
}> = [
  { label: "All" },
  { label: "Pending", status: "ASSIGNED" },
  { label: "Accepted", status: "ACCEPTED" },
  { label: "In Progress", statuses: IN_PROGRESS },
  { label: "Completed", status: "COMPLETED" },
];
const DATE_FILTERS = [
  { label: "Today", key: "today" },
  { label: "Tomorrow", key: "tomorrow" },
  { label: "This Week", key: "thisWeek" },
  { label: "Next Week", key: "nextWeek" },
  { label: "This Month", key: "thisMonth" },
  { label: "Next Month", key: "nextMonth" },
  { label: "Past Month", key: "pastMonth" },
  { label: "All", key: "all" },
] as const;
const AVAILABILITY: AvailabilityStatus[] = [
  "AVAILABLE",
  "BUSY",
  "OFF_DUTY",
  "ON_LEAVE",
];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SUPPORTED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const LOCATION_INTERVAL_MS = 5 * 60 * 1000;

const label = (value?: string | null) =>
  value
    ? value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unavailable";
const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const parseJobDate = (job: RequestView) => {
  const raw = job.preferredVisitDate || job.createdAt || job.updatedAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
};
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return normalizeDate(next);
};
const todayOnly = (jobs: RequestView[]) => {
  const today = normalizeDate(new Date());
  return jobs.filter((job) => {
    const date = parseJobDate(job);
    return !date || sameDay(date, today);
  });
};
const formatTimeSlot = (slot?: string | null) => {
  if (!slot) return "Scheduled";
  return slot.replace(/\s*-\s*/g, "\n-");
};
const unreadCountFromJobs = (
  jobs: RequestView[],
  dashboard: TechnicianDashboard | null,
) =>
  dashboard?.emergencyJobs ??
  jobs.filter((job) => job.priority === "EMERGENCY").length;
const filterJobsByDate = (
  jobs: RequestView[],
  key: (typeof DATE_FILTERS)[number]["key"],
  yearText: string,
  monthText: string,
) => {
  if (key === "all") return jobs;
  const today = normalizeDate(new Date());
  const tomorrow = addDays(today, 1);
  const weekDay = today.getDay() || 7;
  const thisWeekStart = addDays(today, 1 - weekDay);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const year = Number(yearText) || today.getFullYear();
  const month = Math.min(Math.max(Number(monthText) || today.getMonth() + 1, 1), 12) - 1;
  const inRange = (date: Date | null, start: Date, end: Date) =>
    !!date && date >= start && date <= end;
  return jobs.filter((job) => {
    const date = parseJobDate(job);
    if (key === "today") return !date || sameDay(date, today);
    if (key === "tomorrow") return !!date && sameDay(date, tomorrow);
    if (key === "thisWeek") return inRange(date, thisWeekStart, thisWeekEnd);
    if (key === "nextWeek") return inRange(date, nextWeekStart, nextWeekEnd);
    if (key === "thisMonth")
      return !!date && date.getFullYear() === year && date.getMonth() === month;
    if (key === "nextMonth") {
      const nextMonth = new Date(year, month + 1, 1);
      return (
        !!date &&
        date.getFullYear() === nextMonth.getFullYear() &&
        date.getMonth() === nextMonth.getMonth()
      );
    }
    if (key === "pastMonth") {
      const pastMonth = new Date(year, month - 1, 1);
      return (
        !!date &&
        date.getFullYear() === pastMonth.getFullYear() &&
        date.getMonth() === pastMonth.getMonth()
      );
    }
    return true;
  });
};
const requestTitle = (request: RequestView) =>
  request.serviceId || `SR-${request.id}`;
const requestSummary = (request: RequestView) =>
  request.title || request.description || label(request.serviceType);
const fieldText = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
};
const jobInfo = (request: RequestView) => {
  const source = request as Record<string, unknown>;
  const building =
    fieldText(source, ["buildingName", "building", "siteName", "assetName"]) ||
    requestSummary(request);
  const location =
    fieldText(source, [
      "location",
      "buildingAddress",
      "address",
      "siteAddress",
      "city",
    ]) || "Location pending";
  const lift =
    fieldText(source, ["liftName", "liftNumber", "liftLabel"]) ||
    (request.liftId ? `Lift ${request.liftId}` : "Lift details pending");
  const persons =
    fieldText(source, ["persons", "passengerCapacity", "capacity"]) ||
    "Capacity not provided";
  const customer =
    fieldText(source, ["customerName", "ownerName", "contactName"]) ||
    (request.customerProfileId
      ? `Customer ${request.customerProfileId}`
      : "Customer");
  const phone =
    fieldText(source, [
      "customerPhone",
      "primaryPhone",
      "phone",
      "mobile",
      "contactPhone",
    ]) || "";
  const instructions =
    request.customerRemarks ||
    fieldText(source, ["specialInstructions", "instructions", "remarks"]);
  return { building, location, lift, persons, customer, phone, instructions };
};
const callPhone = async (phone?: string) => {
  if (!phone) return;
  const url = `tel:${phone}`;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
};
const messagePhone = async (phone?: string) => {
  if (!phone) return;
  const url = `sms:${phone}`;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
};
const visitTitle = (visit: VisitView) =>
  visit.serviceId || `Request ${visit.serviceRequestId}`;
const visitContext = (visit: VisitView) =>
  [
    visit.title,
    visit.liftId ? `Lift ID ${visit.liftId}` : null,
    visit.customerProfileId
      ? `Customer profile ${visit.customerProfileId}`
      : null,
    visit.technicianEmployeeId
      ? `Technician ${visit.technicianEmployeeId}`
      : null,
  ]
    .filter(Boolean)
    .join(" - ") || "Visit context unavailable";
const err = (error: unknown) =>
  error instanceof Error ? error.message : "Valor request failed.";

export default function App() {
  const [session, setSession] = useState<SessionState>("booting");
  const [authStage, setAuthStage] = useState<AuthStage>("welcome");
  const [application, setApplication] = useState<TechnicianApplication | null>(
    null,
  );
  const [applicationToken, setApplicationToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [dashboard, setDashboard] = useState<TechnicianDashboard | null>(null);
  const [profile, setProfile] = useState<TechnicianProfileView | null>(null);
  const [jobs, setJobs] = useState<PageView<RequestView> | null>(null);
  const [overviewJobs, setOverviewJobs] = useState<RequestView[]>([]);
  const [history, setHistory] = useState<PageView<RequestView> | null>(null);
  const [visits, setVisits] = useState<PageView<VisitView> | null>(null);
  const [notifications, setNotifications] =
    useState<PageView<NotificationView> | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitView | null>(null);
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [checklist, setChecklist] = useState<JobChecklistView | null>(null);
  const [completionOtp, setCompletionOtp] = useState<CompletionOtpState | null>(
    null,
  );
  const [arrivalOtp, setArrivalOtp] = useState<ArrivalOtpState | null>(null);
  const [servicePayment, setServicePayment] =
    useState<TechnicianServicePayment | null>(null);
  const [jobLocation, setJobLocation] = useState<LocationView | null>(null);
  const [privateAttachments, setPrivateAttachments] = useState<
    PrivateAttachmentView[]
  >([]);
  const [jobFilter, setJobFilter] = useState(0);
  const [historyFilter, setHistoryFilter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(
    null,
  );
  const [pendingVisitStatus, setPendingVisitStatus] = useState<
    "IN_PROGRESS" | "COMPLETED" | null
  >(null);
  const [tracking, setTracking] = useState<TrackingState>({
    active: false,
    permission: "unknown",
  });

  const expire = useCallback(() => {
    setSession("anonymous");
    setDashboard(null);
    setProfile(null);
    setSelectedJob(null);
    setMessage("Your session expired. Please sign in again.");
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(expire);
    return () => setSessionExpiredHandler(undefined);
  }, [expire]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [
        nextDashboard,
        nextProfile,
        nextJobs,
        nextVisits,
        nextNotifications,
        nextPrivateAttachments,
      ] = await Promise.all([
        technicianApi.dashboard(),
        technicianApi.profile(),
        technicianApi.jobs({ page: 0, size: 20 }),
        technicianApi.visits({ page: 0, size: 20 }),
        technicianApi.notifications(),
        technicianApi.privateAttachments(),
      ]);
      setDashboard(nextDashboard);
      setProfile(nextProfile);
      setJobs(nextJobs);
      setOverviewJobs(nextJobs.items);
      setVisits(nextVisits);
      setNotifications(nextNotifications);
      setPrivateAttachments(nextPrivateAttachments);
    } catch (error) {
      setMessage(err(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (!environment.apiBaseUrl) {
      setSession("anonymous");
      return;
    }
    try {
      const tokens = await tokenStorage.getTokens();
      if (!tokens) {
        setSession("anonymous");
        return;
      }
      const current = await technicianApi.currentUser();
      if (current.role !== "TECHNICIAN") {
        await tokenStorage.clear();
        setMessage("This account cannot use the Technician app.");
        setSession("anonymous");
        return;
      }
      setSession("authenticated");
      await loadCore();
    } catch (error) {
      await tokenStorage.clear();
      setMessage(err(error));
      setSession("anonymous");
    }
  }, [loadCore]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const request = selectedJob?.request;
    const trackable =
      !!request && screen === "jobDetail" && TRACKABLE.includes(request.status);
    const submit = async () => {
      if (!request || cancelled) return;
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const timestamp = new Date().toISOString();
        const nextLocation = await technicianApi.updateLocation(request.id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp,
        });
        if (!cancelled) setJobLocation(nextLocation);
        if (!cancelled)
          setTracking({
            active: true,
            permission: "granted",
            lastSubmittedAt: timestamp,
          });
      } catch (error) {
        if (!cancelled)
          setTracking((current) => ({
            ...current,
            active: trackable,
            error: err(error),
          }));
      }
    };
    const start = async () => {
      if (!trackable) {
        setTracking((current) => ({
          ...current,
          active: false,
          error: undefined,
        }));
        await stopBackgroundTracking().catch(() => undefined);
        return;
      }
      setTracking((current) => ({
        ...current,
        active: true,
        error: undefined,
      }));
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!cancelled)
          setTracking({
            active: false,
            permission: "denied",
            error:
              "Location permission is required while travelling to or working on an active job.",
          });
        return;
      }
      if (!cancelled)
        setTracking((current) => ({ ...current, permission: "granted" }));
      const background = await ensureBackgroundTracking(request.id).catch(
        (error) => ({ started: false, state: err(error) }),
      );
      if (!cancelled)
        setTracking((current) => ({
          ...current,
          background: background.state,
        }));
      await submit();
      interval = setInterval(submit, LOCATION_INTERVAL_MS);
    };
    start();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (!trackable) stopBackgroundTracking().catch(() => undefined);
    };
  }, [screen, selectedJob?.request.id, selectedJob?.request.status]);

  const openJob = async (request: RequestView) => {
    setScreen("jobDetail");
    setLoading(true);
    try {
      const detail = await technicianApi.job(request.id);
      setSelectedJob(detail);
      const [files, nextChecklist, nextArrivalOtp, nextPayment, nextLocation] =
        await Promise.all([
          technicianApi.attachments(request.id),
          technicianApi.checklist(request.id),
          technicianApi.arrivalOtp(request.id).catch(() => null),
          technicianApi.servicePayment(request.id).catch(() => null),
          technicianApi.technicianLocation(request.id).catch(() => null),
        ]);
      setAttachments(files);
      setChecklist(nextChecklist);
      setArrivalOtp(nextArrivalOtp);
      setServicePayment(nextPayment);
      setJobLocation(nextLocation);
    } catch (error) {
      setMessage(err(error));
    } finally {
      setLoading(false);
    }
  };

  const openVisit = async (visit: VisitView) => {
    setScreen("visitDetail");
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
    const [files, nextChecklist, nextArrivalOtp, nextPayment, nextLocation] =
      await Promise.all([
        technicianApi.attachments(id),
        technicianApi.checklist(id),
        technicianApi.arrivalOtp(id).catch(() => null),
        technicianApi.servicePayment(id).catch(() => null),
        technicianApi.technicianLocation(id).catch(() => null),
      ]);
    setAttachments(files);
    setChecklist(nextChecklist);
    setArrivalOtp(nextArrivalOtp);
    setServicePayment(nextPayment);
    setJobLocation(nextLocation);
    await loadCore();
  };

  const loadJobs = async (index = jobFilter) => {
    const filter = JOB_FILTERS[index];
    setJobFilter(index);
    if (filter.status) {
      setJobs(
        await technicianApi.jobs({ status: filter.status, page: 0, size: 20 }),
      );
    } else {
      setJobs(await technicianApi.jobs({ page: 0, size: 20 }));
    }
  };

  const loadHistory = async (index = historyFilter) => {
    const filter = HISTORY_FILTERS[index];
    setHistoryFilter(index);
    const response = await technicianApi.jobs({
      status: filter.status,
      page: 0,
      size: 50,
    });
    const items = filter.emergency
      ? response.items.filter((item) => item.priority === "EMERGENCY")
      : response.items;
    setHistory({ ...response, items });
  };

  const logout = async () => {
    await technicianApi.logout();
    setSession("anonymous");
  };

  if (!environment.apiBaseUrl) {
    return <SetupScreen />;
  }

  if (session === "booting") {
    return (
      <Shell>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Restoring technician session...</Text>
      </Shell>
    );
  }

  if (session === "anonymous") {
    return (
      <TechnicianAuthFlow
        stage={authStage}
        application={application}
        applicationToken={applicationToken}
        message={message}
        loading={loading}
        onStage={setAuthStage}
        onMessage={setMessage}
        onApplication={(next, token) => {
          setApplication(next);
          if (token) setApplicationToken(token);
        }}
        onLogin={async (input) => {
          setLoading(true);
          setMessage(null);
          try {
            await technicianApi.login(input);
            setSession("authenticated");
            await loadCore();
          } catch (error) {
            setMessage(err(error));
          } finally {
            setLoading(false);
          }
        }}
      />
    );
  }

  const activeJobs =
    jobs?.items.filter(
      (item) =>
        (!JOB_FILTERS[jobFilter].status || JOB_FILTERS[jobFilter].status === item.status) &&
        (!JOB_FILTERS[jobFilter].statuses || JOB_FILTERS[jobFilter].statuses?.includes(item.status)),
    ) ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.app}>
        {needsHeader(screen) ? (
          <Header
            screen={screen}
            onBack={() =>
              setScreen(
                screen === "visitDetail"
                  ? "visits"
                  : screen === "emergencyRequests"
                    ? "dashboard"
                    : screen === "support" ||
                        screen === "scanQr" ||
                        screen === "requestParts" ||
                        screen === "reportIssue" ||
                        screen === "safety"
                      ? "dashboard"
                      : screen.startsWith("profile") && screen !== "profile"
                        ? "profile"
                        : "jobs",
              )
            }
          />
        ) : null}
        {message ? (
          <Banner message={message} onDismiss={() => setMessage(null)} />
        ) : null}
        {screen === "dashboard" && (
          <Dashboard
            dashboard={dashboard}
            jobs={overviewJobs}
            visits={visits?.items ?? []}
            loading={loading}
            onRefresh={loadCore}
            onJobs={() => setScreen("jobs")}
            onJob={openJob}
            onNotifications={() => setScreen("notifications")}
            onProfile={() => setScreen("profile")}
            onEmergency={() => setScreen("emergencyRequests")}
            onSupport={() => setScreen("support")}
            
            onHistory={() => setScreen("history")}
            onSafety={() => setScreen("safety")}
            onReports={() => setScreen("reports")}
            onVisits={() => setScreen("visits")}
            unreadCount={notifications?.items.filter(item => item.status !== "READ").length ?? 0}
          />
        )}
        {screen === "jobs" && (
          <Jobs
            items={activeJobs}
            filter={jobFilter}
            loading={loading}
            onFilter={(index) =>
              loadJobs(index).catch((error) => setMessage(err(error)))
            }
            onJob={openJob}
            onStartJob={async (job) => {
              try {
                if (job.status === "ASSIGNED") {
                  await technicianApi.transition(job.id, "ACCEPTED");
                  await technicianApi.transition(job.id, "ON_THE_WAY");
                } else if (job.status === "ACCEPTED") {
                  await technicianApi.transition(job.id, "ON_THE_WAY");
                }
                await loadJobs(jobFilter);
              } catch (error) {
                setMessage(err(error));
              }
            }}
          />
        )}
        {screen === "history" && (
          <HistoryScreen
            items={history?.items ?? []}
            filter={historyFilter}
            onLoad={loadHistory}
            onFilter={loadHistory}
            onJob={openJob}
            infoForJob={jobInfo}
          />
        )}
        {screen === "reports" && (
          <ReportsPage
            jobs={jobs?.items ?? []}
            dashboard={dashboard}
            onHistory={() =>
              loadHistory()
                .then(() => setScreen("history"))
                .catch((error) => setMessage(err(error)))
            }
            onIssue={() => setScreen("jobs")}
          />
        )}
        {screen === "emergencyRequests" && (
          <EmergencyRequestsPage
            jobs={(jobs?.items ?? []).filter(
              (item) =>
                item.priority === "EMERGENCY" ||
                item.serviceType === "EMERGENCY",
            )}
            onJob={openJob}
          />
        )}
        {screen === "support" && <SupportPage profile={profile} />}
        {screen === "scanQr" && <DeferredActionPage title="Scan QR" />}
        {screen === "requestParts" && (
          <DeferredActionPage title="Request Parts" />
        )}
        {screen === "reportIssue" && <ReportIssuePage />}
        {screen === "safety" && <SafetyPage />}
        {screen === "jobDetail" && selectedJob && (
          <JobDetailScreen
            detail={selectedJob}
            tracking={tracking}
            jobLocation={jobLocation}
            attachments={attachments}
            checklist={checklist}
            completionOtp={completionOtp}
            arrivalOtp={arrivalOtp}
            servicePayment={servicePayment}
            onTransition={(status) => {
              setPendingStatus(status);
              setModal("transition");
            }}
            onReport={() => setModal("report")}
            onAttach={() => setModal("attachment")}
            onDeleteAttachment={async (id) => {
              await technicianApi.deleteAttachment(selectedJob.request.id, id);
              await refreshJob();
            }}
            onChecklistSave={async (responses) => {
              setChecklist(
                await technicianApi.saveChecklist(
                  selectedJob.request.id,
                  responses,
                ),
              );
              setMessage("Checklist saved.");
            }}
            onRequestArrivalOtp={async () => {
              setArrivalOtp(
                await technicianApi.requestArrivalOtp(selectedJob.request.id),
              );
              setMessage(
                "Arrival OTP requested. Ask the customer to share it.",
              );
            }}
            onVerifyArrivalOtp={async (otpId, otp) => {
              setArrivalOtp(
                await technicianApi.verifyArrivalOtp(
                  selectedJob.request.id,
                  otpId,
                  otp,
                ),
              );
              setMessage("Arrival OTP verified.");
              await refreshJob();
            }}
            onRequestOtp={async () => {
              setCompletionOtp(
                await technicianApi.requestCompletionOtp(
                  selectedJob.request.id,
                ),
              );
              setMessage("Completion OTP requested.");
            }}
            onVerifyOtp={async (otpId, otp) => {
              setCompletionOtp(
                await technicianApi.verifyCompletionOtp(
                  selectedJob.request.id,
                  otpId,
                  otp,
                ),
              );
              setMessage("Completion OTP verified.");
            }}
            onVerifyCash={async (paymentId, otpId, otp) => {
              await technicianApi.verifyCashPayment({ paymentId, otpId, otp });
              setMessage("Cash payment verified.");
              await refreshJob();
            }}
            onOpenMaps={async () => {
              const address = String(
                (selectedJob.request as Record<string, unknown>)
                  .buildingAddress ||
                  (selectedJob.request as Record<string, unknown>).address ||
                  "",
              );
              const url = address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                : "https://maps.google.com";
              if (await Linking.canOpenURL(url)) await Linking.openURL(url);
            }}
          />
        )}
        {screen === "visits" && (
          <VisitsScreen onVisit={openVisit} />
        )}
        {screen === "visitDetail" && selectedVisit && (
          <VisitDetailScreen
            visit={selectedVisit}
            onStatus={(status) => {
              setPendingVisitStatus(status);
              setModal("transition");
            }}
            onCancel={() => setModal("visitCancel")}
            onReschedule={() => setModal("reschedule")}
            onAdditional={() => setModal("additionalVisit")}
          />
        )}
        {screen === "notifications" && (
          <Notifications
            page={notifications}
            onRefresh={loadCore}
            onRead={async (id) => {
              await technicianApi.markNotificationRead(id);
              await loadCore();
            }}
            onMarkAll={async () => {
              for (const item of notifications?.items ?? [])
                if (item.status !== "READ")
                  await technicianApi.markNotificationRead(item.id);
              await loadCore();
            }}
          />
        )}
        {screen === "profile" && (
          <ProfileScreen
            profile={profile}
            dashboard={dashboard}
            onNavigate={(next) => setScreen(next)}
            onLogout={() =>
              Alert.alert(
                "Log out?",
                "You will need to sign in again to access your jobs.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Log out", style: "destructive", onPress: logout },
                ],
              )
            }
          />
        )}
        {screen === "profileDetails" && (
          <ProfileDetailsPage
            profile={profile}
            onSave={async (input) => {
              setProfile(await technicianApi.updateProfile(input));
              await loadCore();
              setScreen("profile");
            }}
          />
        )}
        {screen === "profilePassword" && (
          <ProfilePasswordPage
            onDone={() =>
              setMessage(
                "Password change is managed by Valor support for technician accounts.",
              )
            }
          />
        )}
        {screen === "profileHelp" && <HelpPage />}
        {screen === "profileLocation" && <LocationPage />}
        {screen === "profileLanguage" && <LanguagePage />}
        {screen === "profileTheme" && <ThemePage />}
        {screen === "profileNotifications" && (
          <Notifications
            variant="notifications"
            page={notifications}
            onRefresh={loadCore}
            onRead={async (id) => {
              await technicianApi.markNotificationRead(id);
              await loadCore();
            }}
            onMarkAll={async () => {
              for (const item of notifications?.items ?? [])
                if (item.status !== "READ")
                  await technicianApi.markNotificationRead(item.id);
              await loadCore();
            }}
          />
        )}
        {screen === "profileAbout" && <AboutPage />}
        {!needsHeader(screen) && (
            <BottomNav
              screen={screen}
              unreadCount={notifications?.items.filter((item) => item.status !== "READ").length ?? 0}
              onChange={(next) => {
                setScreen(next);
              }}
            />
          )}
        <ActionModal
          mode={modal}
          onClose={() => {
            setModal(null);
            setPendingStatus(null);
            setPendingVisitStatus(null);
          }}
          onSubmit={async (values) => {
            if (modal === "report" && selectedJob)
              await technicianApi.saveReport(selectedJob.request.id, {
                diagnosis: values.diagnosis,
                workPerformed: values.workPerformed,
                testingResult: values.testingResult,
                completionNotes: values.completionNotes,
              });
            if (modal === "transition" && selectedJob && pendingStatus) {
              await technicianApi.transition(
                selectedJob.request.id,
                pendingStatus,
                values.notes,
              );
              if (pendingStatus === "ACCEPTED") {
                await technicianApi.transition(
                  selectedJob.request.id,
                  "ON_THE_WAY",
                  values.notes,
                );
              }
              if (pendingStatus === "REACHED_SITE") {
                try {
                  setArrivalOtp(await technicianApi.requestArrivalOtp(selectedJob.request.id));
                } catch {
                  setModal(null);
                  await refreshJob();
                  setMessage("Arrival saved. The code could not be sent. Tap Send arrival OTP in the service screen to retry.");
                  return;
                }
              }
            }
            if (modal === "transition" && selectedVisit && pendingVisitStatus)
              setSelectedVisit(
                await technicianApi.updateVisitStatus(
                  selectedVisit.id,
                  pendingVisitStatus,
                  values.notes,
                ),
              );
            if (modal === "visitCancel" && selectedVisit)
              setSelectedVisit(
                await technicianApi.cancelVisit(
                  selectedVisit.id,
                  values.reason,
                ),
              );
            if (modal === "reschedule" && selectedVisit)
              await technicianApi.requestReschedule(selectedVisit.id, {
                reason: values.reason,
                requestedDate: values.requestedDate,
                requestedStartTime: values.requestedStartTime,
                requestedEndTime: values.requestedEndTime,
              });
            if (modal === "additionalVisit" && selectedVisit)
              await technicianApi.requestAdditionalVisit(selectedVisit.id, {
                reason: values.reason,
                requestedDate: values.requestedDate,
                requestedStartTime: values.requestedStartTime,
                requestedEndTime: values.requestedEndTime,
              });
            if (modal === "attachment" && selectedJob)
              await technicianApi.uploadAttachment(
                selectedJob.request.id,
                parseAttachment(values),
              );
            if (modal === "privateAttachment")
              await technicianApi.uploadPrivateAttachment(
                parseAttachment(values),
              );
            setModal(null);
            setMessage("Saved successfully.");
            if (selectedJob) await refreshJob();
            await loadCore();
          }}
          onError={(error) => {
            setMessage(err(error));
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function SetupScreen() {
  return (
    <Shell>
      <Text style={styles.logo}>VALOR</Text>
      <Text style={styles.title}>Connect the technician app</Text>
      <Text style={styles.muted}>
        Set EXPO_PUBLIC_API_BASE_URL in .env and rebuild the app.
      </Text>
    </Shell>
  );
}

function TechnicianAuthFlow({
  stage,
  application,
  applicationToken,
  message,
  loading,
  onStage,
  onMessage,
  onApplication,
  onLogin,
}: {
  stage: AuthStage;
  application: TechnicianApplication | null;
  applicationToken: string | null;
  message: string | null;
  loading: boolean;
  onStage: (stage: AuthStage) => void;
  onMessage: (message: string | null) => void;
  onApplication: (application: TechnicianApplication, token?: string) => void;
  onLogin: (input: { email: string; password: string }) => void;
}) {
  const [basic, setBasic] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [otp, setOtp] = useState("");
  const [professional, setProfessional] = useState({
    experience: "",
    specialization: "",
    liftBrands: "",
    certifications: "",
    highestQualification: "",
    handsOnExperience: "",
    preferredLocations: "",
    willingToWorkAtHeights: true,
    travelAvailability: "Yes, I can travel",
    additionalNotes: "",
    aadhaarNumber: "",
    drivingLicenseNumber: "",
  });
  const [documents, setDocuments] = useState<
    Record<string, TechnicianApplicationDocument>
  >({});
  const [working, setWorking] = useState(false);
  const setError = (text: string) => onMessage(text);
  const submitBasic = async () => {
    if (
      !basic.fullName.trim() ||
      !basic.phone.trim() ||
      !basic.email.trim() ||
      !basic.password ||
      basic.password !== basic.confirmPassword
    )
      return setError("Enter all details and make sure both passwords match.");
    setWorking(true);
    onMessage(null);
    try {
      // A failed OTP request must not create the same application again.
      const created = application && applicationToken &&
        application.email.toLowerCase() === basic.email.trim().toLowerCase()
        ? { application, applicationToken }
        : await technicianApplicationApi.create({
            fullName: basic.fullName,
            phone: basic.phone,
            email: basic.email,
            password: basic.password,
          });
      onApplication(created.application, created.applicationToken);
      const sent = await technicianApplicationApi.sendOtp(
        created.application.id,
        created.applicationToken,
      );
      if (sent.otp) {
        setOtp(sent.otp);
        onMessage(
          `SMS is not available yet. Use verification code ${sent.otp}.`,
        );
      }
      onStage("otp");
    } catch (error) {
      setError(err(error));
    } finally {
      setWorking(false);
    }
  };
  const verify = async () => {
    if (!application || !applicationToken) return;
    if (otp.length !== 4) return setError("Enter the 4-digit OTP.");
    setWorking(true);
    onMessage(null);
    try {
      onApplication(
        await technicianApplicationApi.verifyOtp(
          application.id,
          applicationToken,
          otp,
        ),
      );
      onStage("professional");
    } catch (error) {
      setError(err(error));
    } finally {
      setWorking(false);
    }
  };
  const saveProfessional = async () => {
    const token = applicationToken;
    if (!application || !token) return;
    if (
      !professional.experience ||
      !professional.specialization ||
      !professional.preferredLocations
    )
      return setError(
        "Add experience, specialization, and preferred locations.",
      );
    setWorking(true);
    onMessage(null);
    try {
      onApplication(
        await technicianApplicationApi.update(
          application.id,
          token,
          professional,
        ),
      );
      onStage("documents");
    } catch (error) {
      setError(err(error));
    } finally {
      setWorking(false);
    }
  };
  const upload = async (documentType: string) => {
    const token = applicationToken;
    if (!application || !token) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setWorking(true);
    onMessage(null);
    try {
      const uploaded = await technicianApplicationApi.uploadDocument(
        application.id,
        token,
        documentType,
        {
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: result.assets[0].mimeType || "application/octet-stream",
        },
      );
      setDocuments((current) => ({ ...current, [documentType]: uploaded }));
      onApplication(await technicianApplicationApi.read(application.id, token));
    } catch (error) {
      setError(err(error));
    } finally {
      setWorking(false);
    }
  };
  const review = () => {
    onStage("review");
  };
  const submit = async () => {
    const token = applicationToken;
    if (!application || !token) return;
    setWorking(true);
    onMessage(null);
    try {
      onApplication(
        await technicianApplicationApi.submit(application.id, token),
      );
      onStage("submitted");
    } catch (error) {
      setError(err(error));
    } finally {
      setWorking(false);
    }
  };
  const refreshStatus = async () => {
    const token = applicationToken;
    if (!application || !token) return;
    setWorking(true);
    try {
      const next = await technicianApplicationApi.read(application.id, token);
      onApplication(next);
      onStage(next.status === "APPROVED" ? "approved" : "verification");
    } catch (error) {
      setError(err(error));
    } finally {
      setWorking(false);
    }
  };
  const screens: Record<AuthStage, React.ReactNode> = {
    welcome: (
      <WelcomeScreen
        onGetStarted={() => {
          onMessage(null);
          onStage("basic");
        }}
        onSignIn={() => {
          onMessage(null);
          onStage("login");
        }}
      />
    ),
    login: (
      <LoginScreen
        onLogin={onLogin}
        loading={loading}
        message={message}
        onBack={() => onStage("welcome")}
        onRegister={() => {
          onMessage(null);
          onStage("basic");
        }}
      />
    ),
    basic: (
      <BasicDetailsScreen
        value={basic}
        onChange={(next) => setBasic(next as typeof basic)}
        onNext={submitBasic}
        onBack={() => onStage("welcome")}
        onSignIn={() => onStage("login")}
        loading={working}
        message={message}
      />
    ),
    otp: (
      <OtpScreen
        phone={basic.phone}
        value={otp}
        onChange={setOtp}
        onVerify={verify}
        onBack={() => onStage("basic")}
        loading={working}
        message={message}
      />
    ),
    professional: (
      <ProfessionalDetailsScreen
        value={professional}
        onChange={(next) => setProfessional(next as typeof professional)}
        onNext={saveProfessional}
        onBack={() => onStage("otp")}
        loading={working}
        message={message}
      />
    ),
    documents: (
      <DocumentsScreen
        documents={documents}
        existing={application?.documents || []}
        onUpload={upload}
        onNext={review}
        onBack={() => onStage("professional")}
        loading={working}
        message={message}
      />
    ),
    review: (
      <ReviewScreen
        application={application}
        documents={documents}
        onSubmit={submit}
        onBack={() => onStage("documents")}
        loading={working}
        message={message}
      />
    ),
    submitted: (
      <SubmittedScreen
        onLogin={() => onStage("login")}
        onStatus={refreshStatus}
        loading={working}
      />
    ),
    verification: (
      <VerificationScreen
        application={application}
        onRefresh={refreshStatus}
        onLogin={() => onStage("login")}
        loading={working}
      />
    ),
    approved: (
      <ApprovedScreen
        application={application}
        onLogin={() => onStage("login")}
      />
    ),
  };
  return (
    <SafeAreaView style={styles.authSafe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      {screens[stage]}
    </SafeAreaView>
  );
}

function AuthFrame({
  children,
  step,
  onBack,
}: {
  children: React.ReactNode;
  step?: number;
  onBack?: () => void;
}) {
  return (
    <View style={styles.authFrame}>
      <LinearGradient colors={["#EDF4FF", "#FFFFFF", "#FFF9EF"]} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <View style={styles.authTop}>
        <Pressable onPress={onBack} disabled={!onBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.authBack}>
          {onBack ? (
            <AppIcon name="chevron-back" size={24} color={colors.primary} />
          ) : null}
        </Pressable>
        <View style={styles.brand}>
          <Text style={styles.brandMark}>V</Text>
          <View>
            <Text style={styles.brandName}>VALOR</Text>
            <Text style={styles.brandSub}>TECHNICIAN</Text>
          </View>
        </View>
        <Text style={styles.stepText}>{step ? `Step ${step} of 5` : ""}</Text>
      </View>
      {step ? (
        <View style={styles.stepper}>
          {["Basic details", "Phone verification", "Professional details", "Documents", "Review"].map(
            (item, index) => (
              <View key={item} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    index + 1 <= step && styles.stepDotActive,
                  ]}
                >
                  <Text style={styles.stepDotText}>
                    {index + 1 < step ? "✓" : index + 1}
                  </Text>
                </View>
                <Text style={styles.stepLabel}>{item}</Text>
              </View>
            ),
          )}
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function BasicDetailsScreen({
  value,
  onChange,
  onNext,
  onBack,
  onSignIn,
  loading,
  message,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
  onSignIn: () => void;
  loading: boolean;
  message: string | null;
}) {
  const update = (key: string, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <AuthFrame step={1} onBack={onBack}>
      <Text style={styles.authTitle}>Create your technician account</Text>
      <Text style={styles.authSubtitle}>
        Start with your contact details, then verify your phone number.
      </Text>
      <AuthInput
        label="Full Name"
        placeholder="Enter your full name"
        value={value.fullName}
        onChangeText={(next) => update("fullName", next)}
      />
      <AuthInput
        label="Phone Number"
        placeholder="Enter your 10-digit mobile number"
        value={value.phone}
        onChangeText={(next) => update("phone", next)}
        keyboardType="phone-pad"
      />
      <AuthInput
        label="Email Address"
        placeholder="Enter your email address"
        value={value.email}
        onChangeText={(next) => update("email", next)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <AuthInput
        label="Create Password"
        placeholder="Create a password"
        value={value.password}
        onChangeText={(next) => update("password", next)}
        secureTextEntry
      />
      <AuthInput
        label="Confirm Password"
        placeholder="Re-enter your password"
        value={value.confirmPassword}
        onChangeText={(next) => update("confirmPassword", next)}
        secureTextEntry
      />
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <View style={styles.infoStrip}>
        <AppIcon name="information-circle" size={18} color={colors.info} />
        <Text style={styles.infoText}>
          Use at least 8 characters with a mix of letters, numbers and a special
          character.
        </Text>
      </View>
      <AuthButton
        title={loading ? "Creating account..." : "Continue to phone verification"}
        onPress={onNext}
        disabled={loading}
      />
      <Text style={styles.authFooter}>
        Already have an account?{" "}
        <Text style={styles.authLink} onPress={onSignIn}>
          Sign In
        </Text>
      </Text>
    </AuthFrame>
  );
}

function OtpScreen({
  phone,
  value,
  onChange,
  onVerify,
  onBack,
  loading,
  message,
}: {
  phone: string;
  value: string;
  onChange: (value: string) => void;
  onVerify: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
}) {
  return (
    <AuthFrame step={2} onBack={onBack}>
      <View style={styles.otpIllustration}>
        <AppIcon name="phone-portrait-outline" size={44} color={colors.info} />
        <Text style={styles.otpBubble}>OTP</Text>
      </View>
      <Text style={styles.otpTitle}>Verify your phone</Text>
      <Text style={[styles.authSubtitle, { textAlign: "center", marginBottom: 8 }]}>Enter the four-digit verification code for</Text>
      <Text style={styles.otpPhoneText}>{phone}</Text>
      <TextInput
        style={styles.otpInput}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="• • • •"
        accessibilityLabel="Four-digit verification code"
        autoComplete="one-time-code"
        placeholderTextColor={colors.muted}
      />
      {message ? <Text accessibilityRole="alert" style={message.startsWith("SMS is not available") ? styles.otpHint : styles.authError}>{message}</Text> : null}
      <AuthButton
        title={loading ? "Verifying..." : "Verify and continue"}
        onPress={onVerify}
        disabled={loading || value.length !== 4}
      />
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.authBackLink}>
        <Text style={styles.authLink}>Change phone number</Text>
      </Pressable>
    </AuthFrame>
  );
}

function ProfessionalDetailsScreen({
  value,
  onChange,
  onNext,
  onBack,
  loading,
  message,
}: {
  value: Record<string, string | boolean>;
  onChange: (value: Record<string, string | boolean>) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
}) {
  const update = (key: string, next: string | boolean) =>
    onChange({ ...value, [key]: next });
  return (
    <AuthFrame step={3} onBack={onBack}>
      <Text style={styles.authTitle}>Professional details</Text>
      <Text style={styles.authSubtitle}>
        Tell us about your lift service experience and preferred work locations.
      </Text>
      <AuthSelect
        label="Total Experience"
        value={String(value.experience)}
        options={["1 Year", "3 Years", "5+ Years"]}
        onChange={(next) => update("experience", next)}
      />
      <AuthSelect
        label="Specialization"
        value={String(value.specialization)}
        options={["Installation", "Maintenance", "Repair", "Modernization"]}
        onChange={(next) => update("specialization", next)}
      />
      <AuthSelect
        label="Lift Brands Worked On"
        value={String(value.liftBrands)}
        options={["OTIS, KONE, Schindler", "Mitsubishi, Johnson", "Other"]}
        onChange={(next) => update("liftBrands", next)}
      />
      <AuthSelect
        label="Certifications (if any)"
        value={String(value.certifications)}
        options={["OSHA / Safety", "Electrical", "None"]}
        onChange={(next) => update("certifications", next)}
      />
      <AuthSelect
        label="Highest Qualification"
        value={String(value.highestQualification)}
        options={["Diploma", "ITI", "Engineering Degree", "Other"]}
        onChange={(next) => update("highestQualification", next)}
      />
      <AuthSelect
        label="Years of Hands-on Experience"
        value={String(value.handsOnExperience)}
        options={["1-2 Years", "3-5 Years", "5+ Years"]}
        onChange={(next) => update("handsOnExperience", next)}
      />
      <AuthInput
        label="Preferred Working Locations"
        placeholder="Hyderabad, Secunderabad"
        value={String(value.preferredLocations)}
        onChangeText={(next) => update("preferredLocations", next)}
      />
      <AuthInput
        label="Aadhaar Number (Optional)"
        placeholder="Enter Aadhaar number"
        value={String(value.aadhaarNumber || "")}
        onChangeText={(next) =>
          update("aadhaarNumber", next.replace(/\D/g, "").slice(0, 12))
        }
        keyboardType="number-pad"
      />
      <AuthInput
        label="Driving Licence Number (Optional)"
        placeholder="Enter licence number"
        value={String(value.drivingLicenseNumber || "")}
        onChangeText={(next) =>
          update("drivingLicenseNumber", next.toUpperCase().slice(0, 40))
        }
        autoCapitalize="characters"
      />
      <Text style={styles.fieldLabel}>Willing to Work at Heights?</Text>
      <View style={styles.segmentRow}>
        <Pressable
          style={[
            styles.segment,
            value.willingToWorkAtHeights && styles.segmentActive,
          ]}
          onPress={() => update("willingToWorkAtHeights", true)}
        >
          <Text style={styles.segmentText}>Yes</Text>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            !value.willingToWorkAtHeights && styles.segmentActive,
          ]}
          onPress={() => update("willingToWorkAtHeights", false)}
        >
          <Text style={styles.segmentText}>No</Text>
        </Pressable>
      </View>
      <Text style={styles.fieldLabel}>Travel Availability</Text>
      <View style={styles.segmentRow}>
        <Pressable
          style={[
            styles.segment,
            value.travelAvailability === "Yes, I can travel" &&
              styles.segmentActive,
          ]}
          onPress={() => update("travelAvailability", "Yes, I can travel")}
        >
          <Text style={styles.segmentText}>Yes, I can travel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            value.travelAvailability === "No, only nearby" &&
              styles.segmentActive,
          ]}
          onPress={() => update("travelAvailability", "No, only nearby")}
        >
          <Text style={styles.segmentText}>Only nearby</Text>
        </Pressable>
      </View>
      <AuthInput
        label="Additional Notes (Optional)"
        placeholder="Experience, skills, or availability"
        value={String(value.additionalNotes)}
        onChangeText={(next) => update("additionalNotes", next)}
        multiline
      />
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <AuthButton
        title={loading ? "Saving..." : "Continue to documents"}
        onPress={onNext}
        disabled={loading}
      />
      <AuthBackLink onPress={onBack} />
    </AuthFrame>
  );
}

const DOCUMENT_LABELS = [
  { type: "PROFILE_PHOTO", label: "Profile Photo" },
  { type: "EDUCATIONAL_CERTIFICATE", label: "Educational Certificate" },
  { type: "EXPERIENCE_CERTIFICATE", label: "Experience Certificate" },
  { type: "TECHNICAL_CERTIFICATION", label: "Technical Certification" },
  { type: "ADDRESS_PROOF", label: "Address Proof" },
  { type: "MEDICAL_FITNESS_CERTIFICATE", label: "Medical Fitness Certificate" },
];
function DocumentsScreen({
  documents,
  existing,
  onUpload,
  onNext,
  onBack,
  loading,
  message,
}: {
  documents: Record<string, TechnicianApplicationDocument>;
  existing: TechnicianApplicationDocument[];
  onUpload: (type: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
}) {
  const all = {
    ...Object.fromEntries(existing.map((item) => [item.documentType, item])),
    ...documents,
  };
  return (
    <AuthFrame step={4} onBack={onBack}>
      <Text style={styles.authTitle}>Supporting documents</Text>
      <Text style={styles.authSubtitle}>
        Upload documents that support your technician application. All uploads are optional.
      </Text>
      {DOCUMENT_LABELS.map((item) => (
        <Pressable
          key={item.type}
          style={styles.documentRow}
          onPress={() => onUpload(item.type)}
        >
          <View style={styles.documentIcon}><AppIcon name="document-text-outline" size={17} color={colors.info} /></View>
          <View style={styles.documentCopy}>
            <Text style={styles.documentTitle}>{item.label}</Text>
            <Text style={styles.documentMeta}>
              {all[item.type]?.originalFilename ||
                "Optional - PDF, JPG or PNG up to 5 MB"}
            </Text>
          </View>
          <Text style={all[item.type] ? styles.uploaded : styles.uploadAction}>
            {all[item.type] ? "Uploaded" : "Add"}
          </Text>
        </Pressable>
      ))}
      <View style={styles.infoStrip}>
        <AppIcon name="information-circle" size={18} color={colors.info} />
        <Text style={styles.infoText}>
          You can continue without uploading files. Review your personal and
          professional details on the next screen.
        </Text>
      </View>
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <AuthButton
        title={loading ? "Saving..." : "Review application"}
        onPress={onNext}
        disabled={loading}
      />
      <AuthBackLink onPress={onBack} />
    </AuthFrame>
  );
}

function ReviewScreen({
  application,
  documents,
  onSubmit,
  onBack,
  loading,
  message,
}: {
  application: TechnicianApplication | null;
  documents: Record<string, TechnicianApplicationDocument>;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
}) {
  const docCount =
    Object.keys(documents).length || application?.documents?.length || 0;
  return (
    <AuthFrame step={5} onBack={onBack}>
      <Text style={styles.authTitle}>Review your application</Text>
      <Text style={styles.authSubtitle}>
        Check your details below. Go back to make changes before you submit.
      </Text>
      <ReviewCard
        title="Basic Details"
        rows={[
          ["Full Name", application?.fullName],
          ["Mobile Number", application?.phone],
          ["Email", application?.email],
        ]}
      />
      <ReviewCard
        title="Professional Details"
        rows={[
          ["Experience", application?.experience],
          ["Specialization", application?.specialization],
          ["Working Locations", application?.preferredLocations],
          ["Travel", application?.travelAvailability],
          ["Aadhaar Number", application?.aadhaarNumber],
          ["Driving Licence Number", application?.drivingLicenseNumber],
        ]}
      />
      <ReviewCard
        title="Documents"
        rows={[
          [
            "Uploaded documents",
            `${docCount} optional file${docCount === 1 ? "" : "s"}`,
          ],
        ]}
      />
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <View style={styles.infoStrip}>
        <AppIcon name="checkmark-circle" size={18} color={colors.action} />
        <Text style={styles.infoText}>
          By submitting, you confirm that the information in your application is accurate.
        </Text>
      </View>
      <AuthButton
        title={loading ? "Submitting..." : "Submit application"}
        onPress={onSubmit}
        disabled={loading}
      />
      <AuthBackLink onPress={onBack} />
    </AuthFrame>
  );
}

function ReviewCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string | null | undefined]>;
}) {
  return (
    <View style={styles.reviewCard}>
      <Text style={styles.reviewTitle}>{title}</Text>
      {rows
        .filter(([, value]) => value)
        .map(([labelText, value]) => (
          <View key={labelText} style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{labelText}</Text>
            <Text style={styles.reviewValue}>{value}</Text>
          </View>
        ))}
    </View>
  );
}
function SubmittedScreen({
  onLogin,
  onStatus,
  loading,
}: {
  onLogin: () => void;
  onStatus: () => void;
  loading: boolean;
}) {
  return (
    <AuthFrame>
      <View style={styles.successIcon}><AppIcon name="checkmark" size={46} color={colors.action} /></View>
      <Text style={styles.successTitle}>Application submitted</Text>
      <Text style={styles.successText}>
        Thank you for registering as a Lift Technician. Your application has
        been submitted successfully.
      </Text>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Under Review</Text>
        <Text style={styles.muted}>
          Our team will review your details and documents. You can check the
          status of your application here.
        </Text>
      </View>
      <AuthButton
        title="Check Application Status"
        onPress={onStatus}
        disabled={loading}
      />
      <AuthButton title="Go to sign in" onPress={onLogin} secondary />
    </AuthFrame>
  );
}
function VerificationScreen({
  application,
  onRefresh,
  onLogin,
  loading,
}: {
  application: TechnicianApplication | null;
  onRefresh: () => void;
  onLogin: () => void;
  loading: boolean;
}) {
  return (
    <AuthFrame>
      <Text style={styles.authTitle}>Document Verification</Text>
      <Text style={styles.authSubtitle}>
        We are verifying your submitted documents.
      </Text>
      <View style={styles.infoStrip}>
        <AppIcon name="time-outline" size={18} color={colors.info} />
        <Text style={styles.infoText}>
          Verification in progress. You will be notified when the review is
          completed.
        </Text>
      </View>
      {application?.documents?.map((document) => (
        <View key={document.id} style={styles.documentRow}>
          <View style={styles.documentIcon}><AppIcon name="document-text-outline" size={17} color={colors.info} /></View>
          <View style={styles.documentCopy}>
            <Text style={styles.documentTitle}>
              {document.documentType.replace(/_/g, " ")}
            </Text>
            <Text style={styles.documentMeta}>{document.originalFilename}</Text>
          </View>
          <Text style={styles.uploaded}>Submitted</Text>
        </View>
      ))}
      <AuthButton
        title={loading ? "Refreshing..." : "Refresh Status"}
        onPress={onRefresh}
        disabled={loading}
      />
      <AuthButton title="Back to Login" onPress={onLogin} secondary />
    </AuthFrame>
  );
}
function ApprovedScreen({
  application,
  onLogin,
}: {
  application: TechnicianApplication | null;
  onLogin: () => void;
}) {
  return (
    <AuthFrame>
      <View style={styles.successIcon}><AppIcon name="checkmark" size={46} color={colors.action} /></View>
      <Text style={styles.successTitle}>You're Approved!</Text>
      <Text style={styles.successText}>
        Welcome to Valor Lift Services. Your documents have been verified and
        your registration is approved.
      </Text>
      <View style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Name</Text>
          <Text style={styles.reviewValue}>{application?.fullName}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Status</Text>
          <Text style={styles.uploaded}>Approved</Text>
        </View>
      </View>
      <AuthButton title="Go to sign in" onPress={onLogin} />
    </AuthFrame>
  );
}
function AuthInput(
  props: React.ComponentProps<typeof TextInput> & { label: string },
) {
  const { label: inputLabel, ...rest } = props;
  return (
    <View style={styles.authField}>
      <Text style={styles.fieldLabel}>{inputLabel}</Text>
      <TextInput
        {...rest}
        accessibilityLabel={inputLabel}
        style={styles.authInput}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}
function AuthSelect({
  label: inputLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.authField}>
      <Text style={styles.fieldLabel}>{inputLabel}</Text>
      <Pressable
        style={[styles.authInput, styles.authSelectRow]}
        accessibilityRole="button"
        accessibilityLabel={`${inputLabel}: ${value || "Select an option"}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value || `Select ${inputLabel.toLowerCase()}`}
        </Text>
        <AppIcon name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open && <View style={styles.authOptions}>
        {options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: option === value }} onPress={() => { onChange(option); setOpen(false); }} style={styles.authOption}>
          <Text style={styles.fieldValue}>{option}</Text>
          {option === value && <AppIcon name="checkmark" size={18} color={colors.info} />}
        </Pressable>)}
      </View>}
    </View>
  );
}

function AuthBackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.authBackLink} onPress={onPress}>
      <AppIcon name="chevron-back" size={18} color={colors.info} />
      <Text style={styles.authLink}>Back</Text>
    </Pressable>
  );
}

function AuthButton({
  title,
  onPress,
  disabled,
  secondary,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.authButton,
        secondary && styles.authButtonSecondary,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {!secondary && <LinearGradient colors={[colors.primary, colors.info]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />}
      <Text
        style={
          secondary ? styles.authButtonSecondaryText : styles.authButtonText
        }
      >
        {title}
      </Text>
      {!secondary ? (
        <AppIcon name="arrow-forward" size={16} color={colors.surface} />
      ) : null}
    </Pressable>
  );
}

function LoginScreen({
  onLogin,
  loading,
  message,
  onRegister,
  onBack,
}: {
  onLogin: (input: { email: string; password: string }) => void;
  loading: boolean;
  message: string | null;
  onRegister?: () => void;
  onBack?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <AuthFrame onBack={onBack}>
      <View style={styles.signInHero}>
        <View style={styles.signInIcon}><AppIcon name="construct-outline" size={34} color={colors.primary} /></View>
        <Text style={styles.authTitle}>Sign in to your account</Text>
        <Text style={styles.authSubtitle}>View assigned jobs, plan service visits, and keep your work up to date.</Text>
      </View>
      <AuthInput label="Email address" placeholder="Enter your email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <AuthInput label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      {message ? <Text accessibilityRole="alert" style={styles.authError}>{message}</Text> : null}
      <AuthButton title={loading ? "Signing in..." : "Sign in"} disabled={loading || !email.trim() || !password} onPress={() => onLogin({ email: email.trim(), password })} />
      <Text style={styles.authFooter}>New to Valor? <Text style={styles.authLink} onPress={onRegister}>Create an account</Text></Text>
    </AuthFrame>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>{children}</View>
    </SafeAreaView>
  );
}

function Header({ screen, onBack }: { screen: Screen; onBack: () => void }) {
  const detail = needsHeader(screen);
  return (
    <View style={styles.header}>
      <Pressable
        disabled={!detail}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.headerButton, detail && styles.headerIconButton]}
      >
        {detail ? (
          <AppIcon name="chevron-back" size={24} color={colors.primary} />
        ) : null}
      </Pressable>
      <Text style={styles.logo}>VALOR</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

function needsHeader(screen: Screen) {
  return (
    screen === "jobDetail" ||
    screen === "visitDetail" ||
    screen === "emergencyRequests" ||
    screen === "support" ||
    screen === "scanQr" ||
    screen === "requestParts" ||
    screen === "reportIssue" ||
    screen === "safety" ||
    (screen.startsWith("profile") && screen !== "profile")
  );
}

function Banner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <Pressable style={styles.banner} onPress={onDismiss}>
      <Text style={styles.errorText}>{message}</Text>
    </Pressable>
  );
}

function AppIcon({
  name,
  size = 18,
  color = colors.primary,
}: {
  name: IoniconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function ChevronIcon() {
  return <AppIcon name="chevron-forward" size={18} color={colors.muted} />;
}


function Jobs({ items, filter, loading, onFilter, onJob, onStartJob }: {
  items: RequestView[]; filter: number; loading: boolean;
  onFilter: (index: number) => void; onJob: (job: RequestView) => void; onStartJob: (job: RequestView) => void;
}) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(DATE_FILTERS.findIndex(item => item.key === "all"));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const visibleJobs = filterJobsByDate(items, DATE_FILTERS[dateFilter].key, year, month).filter(job => {
    const query = search.trim().toLowerCase();
    const info = jobInfo(job);
    return !query || [requestTitle(job), requestSummary(job), info.building, info.location, info.lift, label(job.status)].some(value => value.toLowerCase().includes(query));
  });
  return <FlatList style={{flex: 1}} contentContainerStyle={styles.jobsContent}
    data={loading ? [] : visibleJobs} keyExtractor={item => String(item.id)} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View style={styles.jobHeader}>
      <View style={styles.jobsIntro}>
        <Text style={styles.jobsTitle}>Assigned jobs</Text>
        <Text style={styles.jobsDescription}>Find a job, review the site details and update your progress.</Text>
      </View>
      <View style={styles.jobsSearchField}><AppIcon name="search-outline" size={20} color={colors.muted} /><TextInput accessibilityLabel="Search assigned jobs" style={styles.jobsSearchText} value={search} onChangeText={setSearch} placeholder="Search job, building or lift" placeholderTextColor={colors.muted} /></View>
      <View style={styles.jobsFilters}>
      <View style={styles.jobsFilterGroup}>
        <Text style={styles.jobsFilterLabel}>Job status</Text>
        <FilterBar labels={JOB_FILTERS.map(item => item.label)} active={filter} onChange={onFilter} wrap customerTheme />
      </View>
      <View style={styles.jobsFilterGroup}>
        <Text style={styles.jobsFilterLabel}>Visit date</Text>
        <FilterBar labels={DATE_FILTERS.map(item => item.label)} active={dateFilter} onChange={setDateFilter} wrap customerTheme />
      </View>
      {["thisMonth", "nextMonth", "pastMonth"].includes(DATE_FILTERS[dateFilter].key) && <View style={styles.subFilterRow}>
        <View style={{flex:1}}><Text style={styles.inputLabel}>Year</Text><TextInput style={styles.input} accessibilityLabel="Year" value={year} onChangeText={setYear} keyboardType="number-pad" /></View>
        <View style={{flex:1}}><Text style={styles.inputLabel}>Month (1?12)</Text><TextInput style={styles.input} accessibilityLabel="Month" value={month} onChangeText={setMonth} keyboardType="number-pad" /></View>
      </View>}
      </View>
      <View style={styles.jobsResultsRow}>
        <Text style={styles.jobsResultsTitle}>Your jobs</Text>
        <Text style={styles.jobsResultCount}>{loading ? "Loading jobs…" : `${visibleJobs.length} ${visibleJobs.length === 1 ? "job" : "jobs"} found`}</Text>
      </View>
    </View>}
    renderItem={({item}) => <AssignedJobCard job={item} onPress={() => onJob(item)} onStart={() => onStartJob(item)} />}
    ListEmptyComponent={loading ? <ActivityIndicator color={colors.info} /> : <Empty text="No jobs match these filters. Try All statuses and All dates." />}
  />;
}
function JobDetailScreen({
  detail,
  tracking,
  jobLocation,
  attachments,
  checklist,
  completionOtp,
  arrivalOtp,
  servicePayment,
  onTransition,
  onReport,
  onAttach,
  onDeleteAttachment,
  onChecklistSave,
  onRequestArrivalOtp,
  onVerifyArrivalOtp,
  onRequestOtp,
  onVerifyOtp,
  onVerifyCash,
  onOpenMaps,
}: {
  detail: JobDetail;
  tracking: TrackingState;
  jobLocation: LocationView | null;
  attachments: AttachmentView[];
  checklist: JobChecklistView | null;
  completionOtp: CompletionOtpState | null;
  arrivalOtp: ArrivalOtpState | null;
  servicePayment: TechnicianServicePayment | null;
  onTransition: (status: RequestStatus) => void;
  onReport: () => void;
  onAttach: () => void;
  onDeleteAttachment: (id: number) => void;
  onChecklistSave: (
    responses: { itemId: number; checked?: boolean; valueText?: string }[],
  ) => Promise<void>;
  onRequestArrivalOtp: () => Promise<void>;
  onVerifyArrivalOtp: (otpId: number, otp: string) => Promise<void>;
  onRequestOtp: () => Promise<void>;
  onVerifyOtp: (otpId: number, otp: string) => Promise<void>;
  onVerifyCash: (
    paymentId: number,
    otpId: number,
    otp: string,
  ) => Promise<void>;
  onOpenMaps: () => Promise<void>;
}) {
  const request = detail.request;
  const info = jobInfo(request);
  const checklistDone = !checklist || checklist.status === "COMPLETED";
  const otpDone = completionOtp?.status === "VERIFIED";
  const arrivalBlocked = request.status === "REACHED_SITE" && arrivalOtp?.status !== "VERIFIED";
  const nextStatus: RequestStatus = request.status === "REACHED_SITE" ? "DIAGNOSIS" : request.status === "DIAGNOSIS" || request.status === "WAITING_FOR_PARTS" ? "REPAIR_IN_PROGRESS" : request.status === "TESTING" ? "COMPLETED" : "TESTING";
  const nextLabel = request.status === "REACHED_SITE" ? "Start diagnosis" : request.status === "DIAGNOSIS" ? "Start repair" : request.status === "WAITING_FOR_PARTS" ? "Resume repair" : request.status === "TESTING" ? "Complete job" : "Proceed to testing";
  const nextDisabled = arrivalBlocked || (request.status === "TESTING" && (!checklistDone || !otpDone));
  const hasDocuments = attachments.length > 0;
  const openAttachment = async (attachment: AttachmentView) => {
    const url = technicianApi.attachmentUrl(request.id, attachment.id);
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };
  const documents = hasDocuments ? (
    <View style={styles.card}>
      <SectionTitle title="Documents" action="Add" onAction={onAttach} />
      {attachments.map((item) => (
        <View key={item.id} style={styles.row}>
          <Pressable style={styles.rowText} onPress={() => openAttachment(item)}>
            <Text style={styles.rowText}>{item.originalFilename}</Text>
            <Text style={styles.muted}>{item.contentType}</Text>
          </Pressable>
          <Pressable onPress={() => onDeleteAttachment(item.id)}>
            <Text style={styles.danger}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </View>
  ) : null;

  if (request.status === "COMPLETED") {
    return (
      <ScrollView contentContainerStyle={styles.detailContent}>
        <CompletedJobView
          detail={detail}
          info={info}
          servicePayment={servicePayment}
          onOpenDetails={() => undefined}
        />
        {servicePayment?.cashOtp || servicePayment?.payment?.providerReference === "CASH" ? (
          <CashPaymentPanel payment={servicePayment} onVerify={onVerifyCash} />
        ) : null}
      </ScrollView>
    );
  }

  if (request.status === "ON_THE_WAY") {
    return (
      <ScrollView contentContainerStyle={styles.detailContent}>
        <StatusHeader
          title="On The Way"
          subtitle="You are on your way to the job location"
          request={request}
          callPhone={info.phone}
        />
        <ProgressSteps status={request.status} />
        <RouteMapCard request={request} info={info} location={jobLocation} onOpenMaps={onOpenMaps} />
        <BuildingSummaryCard request={request} info={info} compact />
        <View style={styles.routeStatsGrid}>
          <RouteStat label="Distance" value={jobLocation?.route?.distanceMeters ? `${(jobLocation.route.distanceMeters / 1000).toFixed(1)} km` : "2.8 km"} />
          <RouteStat label="Estimated Time" value={jobLocation?.route?.durationSeconds ? `${Math.max(1, Math.round(jobLocation.route.durationSeconds / 60))} min` : "12 min"} />
          <RouteStat label="Scheduled Time" value={request.preferredTimeSlot || "Time pending"} />
        </View>
        <Pressable style={styles.greenButton} onPress={onOpenMaps}>
          <Text style={styles.primaryText}>Open in Maps</Text>
        </Pressable>
        <View style={styles.detailTwoCol}>
          <Pressable style={styles.outlineButton} onPress={() => callPhone(info.phone)}>
            <Text style={styles.outlineText}>Call Customer</Text>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={() => messagePhone(info.phone)}>
            <Text style={styles.outlineText}>Message</Text>
          </Pressable>
        </View>
        <Info title="Job Instructions" rows={[info.instructions || "Carry standard service kit. Check door sensors and lubrication."]} />
        <Pressable style={styles.primaryButton} onPress={() => onTransition("REACHED_SITE")}>
          <Text style={styles.primaryText}>Reached site</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (["REACHED_SITE", "DIAGNOSIS", "REPAIR_IN_PROGRESS", "WAITING_FOR_PARTS", "TESTING"].includes(request.status)) {
    return (
      <ScrollView contentContainerStyle={styles.detailContent}>
        <ServiceReveal key={request.id}>
          <ServiceHero status={request.status} jobId={request.serviceId || `SR-${request.id}`} building={info.building} service={label(request.serviceType)} />
        </ServiceReveal>
        {request.status === "REACHED_SITE" || request.status === "DIAGNOSIS" ? (
          <ArrivalOtpPanel key={request.id} state={arrivalOtp} onRequest={onRequestArrivalOtp} onVerify={onVerifyArrivalOtp} />
        ) : null}
        <ServiceReveal delay={100}>
        <View style={styles.progressNotice}>
          <AppIcon name="construct-outline" size={22} color={colors.teal} />
          <View style={styles.serviceFlexibleCopy}>
            <Text style={styles.progressNoticeTitle}>{label(request.status)}</Text>
            <Text style={styles.progressNoticeText}>{arrivalBlocked ? "Confirm arrival with the customer OTP before starting diagnosis." : "Complete the checklist and record your findings before finishing the job."}</Text>
          </View>
        </View>
        </ServiceReveal>
        <ServiceReveal delay={180}>
          <ServiceSection number="01" title="Stay connected" subtitle="Your customer, a tap away" />
        </ServiceReveal>
        <ServiceReveal delay={220}><CustomerContactCard info={info} /></ServiceReveal>
        <ServiceReveal delay={260}><ServiceSection number="02" title="At the site" subtitle="Location and equipment details" /></ServiceReveal>
        <ServiceReveal delay={300}><BuildingSummaryCard request={request} info={info} compact /></ServiceReveal>
        <ServiceReveal delay={340}><RouteMapCard request={request} info={info} location={jobLocation} onOpenMaps={onOpenMaps} curved /></ServiceReveal>
        <ServiceReveal delay={380}><ServiceSection number="03" title="The work ahead" subtitle="Check, record and complete" /></ServiceReveal>
        <ServiceReveal delay={420}>
        <View style={styles.serviceInstructionCard}>
          <View style={styles.serviceSectionHeading}><AppIcon name="clipboard-outline" size={20} color={colors.warn} /><Text style={styles.serviceCardHeading}>Job instructions</Text></View>
          <Text style={styles.serviceBodyText}>{info.instructions || "No additional instructions have been provided for this job."}</Text>
        </View>
        </ServiceReveal>
        <ChecklistPanel checklist={checklist} onSave={onChecklistSave} />

        {request.status === "TESTING" ? (
          <CompletionOtpPanel state={completionOtp} onRequest={onRequestOtp} onVerify={onVerifyOtp} />
        ) : null}
        {request.status === "TESTING" && !checklistDone ? (
          <Text style={styles.errorText}>Complete all required checklist items before completing this job.</Text>
        ) : null}
        {request.status === "TESTING" && !otpDone ? (
          <Text style={styles.errorText}>Verify the customer completion OTP before completing this job.</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.servicePrimaryAction, pressed && styles.serviceActionPressed, nextDisabled && styles.disabled]}
          disabled={nextDisabled}
          onPress={() => onTransition(nextStatus)}
        >
          <Text style={styles.primaryText}>{nextLabel}</Text>
          <AppIcon name="arrow-forward" size={20} color={colors.surface} />
        </Pressable>
        {request.status === "REPAIR_IN_PROGRESS" && <Pressable style={styles.serviceSecondaryAction} onPress={() => onTransition("WAITING_FOR_PARTS")}>
          <Text style={styles.outlineText}>Waiting for parts</Text>
        </Pressable>}
        <Pressable style={styles.serviceSecondaryAction} onPress={onReport}>
          <Text style={styles.outlineText}>Service report & notes</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.detailContent}>
      <StatusHeader
        title="Job Details"
        subtitle="Complete the job details and keep people moving safely."
        request={request}
        callPhone={info.phone}
      />
      <BuildingSummaryCard request={request} info={info} />
      <DetailInfoGrid request={request} info={info} />
      <LocationMapPreview info={info} onOpenMaps={onOpenMaps} />
      {request.description ? <Info title="Issue Reported" rows={[request.description]} /> : null}
      {info.instructions ? <Info title="Special Instructions" rows={[info.instructions]} /> : null}
      <Pressable
        style={styles.primaryButton}
        onPress={() => onTransition(request.status === "ASSIGNED" ? "ACCEPTED" : "ON_THE_WAY")}
      >
        <Text style={styles.primaryText}>Start Job</Text>
      </Pressable>
      <View style={styles.detailTwoCol}>
        <Pressable style={styles.outlineButton} onPress={onOpenMaps}>
          <Text style={styles.outlineText}>Get Directions</Text>
        </Pressable>
        {hasDocuments ? (
          <Pressable style={styles.outlineButton} onPress={() => openAttachment(attachments[0])}>
            <Text style={styles.outlineText}>View Documents</Text>
          </Pressable>
        ) : null}
      </View>
      {documents}
    </ScrollView>
  );
}
function JourneyPanel({
  status,
  location,
  onOpenMaps,
}: {
  status: RequestStatus;
  location: LocationView | null;
  onOpenMaps: () => Promise<void>;
}) {
  const steps: RequestStatus[] = [
    "ASSIGNED",
    "ON_THE_WAY",
    "REACHED_SITE",
    "DIAGNOSIS",
    "COMPLETED",
  ];
  const active =
    status === "ACCEPTED"
      ? 1
      : status === "REPAIR_IN_PROGRESS" ||
          status === "WAITING_FOR_PARTS" ||
          status === "TESTING"
        ? 3
        : Math.max(0, steps.indexOf(status));
  return (
    <View style={styles.journeyCard}>
      <Text style={styles.detailSectionTitle}>
        {status === "ON_THE_WAY"
          ? "On the Way"
          : status === "REACHED_SITE"
            ? "Arrived at Site"
            : "Service In Progress"}
      </Text>
      <View style={styles.journeySteps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.journeyStep}>
            <View
              style={[
                styles.journeyDot,
                index <= active && styles.journeyDotActive,
              ]}
            >
              <Text style={styles.journeyDotText}>
                {index <= active ? "OK" : ""}
              </Text>
            </View>
            <Text style={styles.journeyLabel}>{label(step)}</Text>
          </View>
        ))}
      </View>
      {location?.route?.available ? (
        <View style={styles.routeStats}>
          <Text style={styles.routeStat}>
            Distance{" "}
            {location.route.distanceMeters
              ? `${(location.route.distanceMeters / 1000).toFixed(1)} km`
              : "Route ready"}
          </Text>
          <Text style={styles.routeStat}>
            ETA{" "}
            {location.route.durationSeconds
              ? `${Math.max(1, Math.round(location.route.durationSeconds / 60))} min`
              : "ETA pending"}
          </Text>
          <Text style={styles.routeStat}>
            Arrive{" "}
            {location.eta?.etaAt
              ? new Date(location.eta.etaAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Updating"}
          </Text>
        </View>
      ) : (
        <Text style={styles.muted}>
          {location?.route?.status === "SITE_LOCATION_UNAVAILABLE"
            ? "Site coordinates are not available for this job."
            : "Waiting for the latest route update."}
        </Text>
      )}
      {location?.route?.available ? (
        <Pressable style={styles.mapButton} onPress={onOpenMaps}>
          <Text style={styles.mapButtonText}>Open in Maps</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusHeader({
  title,
  subtitle,
  request,
  callPhone: phone,
}: {
  title: string;
  subtitle: string;
  request: RequestView;
  callPhone?: string;
}) {
  return (
    <View style={styles.flowHeader}>
      <View style={styles.serviceFlexibleCopy}>
        <Text style={styles.jobsTitle}>{title}</Text>
        <Text style={styles.serviceBodyText}>{subtitle}</Text>
      </View>
      <View style={styles.flowHeaderRight}>
        <Badge text={label(request.status)} tone="info" />
        <Text selectable style={styles.serviceJobId}>Job ID: {request.serviceId || `SR-${request.id}`}</Text>
        {phone ? (
          <Pressable style={styles.callCircle} onPress={() => callPhone(phone)}>
            <Text style={styles.callCircleText}>Call</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProgressSteps({ status }: { status: RequestStatus }) {
  const steps: Array<{ status: RequestStatus; label: string }> = [
    { status: "ASSIGNED", label: "Assigned" },
    { status: "ON_THE_WAY", label: "On The Way" },
    { status: "REPAIR_IN_PROGRESS", label: "In Progress" },
    { status: "COMPLETED", label: "Completed" },
  ];
  const active =
    status === "ASSIGNED" || status === "ACCEPTED"
      ? 0
      : status === "ON_THE_WAY"
        ? 1
        : status === "COMPLETED"
          ? 3
          : 2;
  return (
    <View style={styles.stepTracker}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.flowStepItem}>
          <View style={[styles.stepBubble, index < active && styles.stepBubbleActive, index === active && styles.stepBubbleCurrent]}>
            {index < active ? <AppIcon name="checkmark" size={18} color={colors.surface} /> : <Text style={[styles.stepNumber, index === active && styles.stepBubbleText]}>{index + 1}</Text>}
          </View>
          <Text style={[styles.flowStepText, index === active && styles.flowStepTextActive]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BuildingSummaryCard({
  request,
  info,
  compact,
}: {
  request: RequestView;
  info: ReturnType<typeof jobInfo>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.buildingCard, compact && styles.buildingCardCompact]}>
      <View style={styles.buildingImage}>
        <AppIcon name="business-outline" size={34} color={colors.action} />
      </View>
      <View style={styles.buildingCopy}>
        <View style={styles.serviceBuildingHeading}>
          <Text style={styles.buildingTitle}>{info.building}</Text>
          <Badge text={label(request.serviceType)} tone={request.priority === "EMERGENCY" ? "danger" : "info"} />
        </View>
        <Text style={styles.assignedMeta}>{info.location}</Text>
        <Text style={styles.assignedMeta}>{info.lift}</Text>
        <Text style={styles.assignedMeta}>{info.persons}</Text>
      </View>
    </View>
  );
}

function DetailInfoGrid({
  request,
  info,
}: {
  request: RequestView;
  info: ReturnType<typeof jobInfo>;
}) {
  return (
    <>
      <DetailRow icon="construct-outline" label="Service Type" value={label(request.serviceType)} />
      <View style={styles.detailTwoCol}>
        <DetailRow icon="calendar-outline" label="Schedule Date" value={request.preferredVisitDate || "Date pending"} />
        <DetailRow icon="time-outline" label="Time" value={request.preferredTimeSlot || "Time pending"} />
      </View>
      <DetailRow icon="person-outline" label="Customer Contact" value={info.customer} />
    </>
  );
}

function LocationMapPreview({
  info,
  onOpenMaps,
}: {
  info: ReturnType<typeof jobInfo>;
  onOpenMaps: () => Promise<void>;
}) {
  return (
    <View style={styles.locationCard}>
      <View style={styles.rowBetween}>
        <View style={styles.homeJobCopy}>
          <Text style={styles.detailRowLabel}>Location</Text>
          <Text style={styles.detailRowValue}>{info.location}</Text>
        </View>
        <ChevronIcon />
      </View>
      <Pressable style={styles.fakeMapSmall} onPress={onOpenMaps}>
        <View style={styles.mapLine} />
        <Text style={styles.mapPin}>●</Text>
        <Text style={styles.mapLabel}>{info.building}</Text>
        <Text style={styles.mapOpen}>Open in Maps</Text>
      </Pressable>
    </View>
  );
}

function RouteMapCard({
  request,
  info,
  location,
  onOpenMaps,
  curved,
}: {
  request: RequestView;
  info: ReturnType<typeof jobInfo>;
  location: LocationView | null;
  onOpenMaps: () => Promise<void>;
  curved?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open directions to ${info.building}`} style={styles.serviceDirectionsCard} onPress={onOpenMaps}>
      <View style={styles.serviceSectionHeading}>
        <View style={styles.serviceLocationIcon}><AppIcon name="navigate-outline" size={24} color={colors.info} /></View>
        <View style={styles.serviceFlexibleCopy}>
          <Text style={styles.serviceCardHeading}>Site directions</Text>
          <Text style={styles.serviceBodyText}>{info.location}</Text>
        </View>
        <AppIcon name="arrow-forward" size={22} color={colors.primary} />
      </View>
      <Text style={styles.serviceBodyText}>{location?.route?.available ? "Open Maps to view the route to this site." : "Open the site location in your maps app."}</Text>
      <Text style={styles.serviceDirectionsLink}>Open directions</Text>
    </Pressable>
  );
}

function RouteStat({ label: statLabel, value }: { label: string; value: string }) {
  return (
    <View style={styles.routeStatCard}>
      <Text style={styles.routeStatValue}>{value}</Text>
      <Text style={styles.routeStatLabel}>{statLabel}</Text>
    </View>
  );
}

function CustomerContactCard({ info }: { info: ReturnType<typeof jobInfo> }) {
  return (
    <View style={styles.contactCard}>
      <View style={styles.profileAvatarSmall}>
        <AppIcon name="person" size={22} color={colors.info} />
      </View>
      <View style={styles.serviceContactCopy}>
        <Text style={styles.detailRowLabel}>Customer</Text>
        <Text style={styles.buildingTitle}>{info.customer}</Text>
      </View>
      <View style={styles.serviceContactActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Call customer" style={({ pressed }) => [styles.serviceContactButton, pressed && styles.serviceActionPressed]} onPress={() => callPhone(info.phone)}>
          <AppIcon name="call-outline" size={18} color={colors.action} /><Text style={styles.serviceActionText}>Call</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Message customer" style={({ pressed }) => [styles.serviceContactButton, pressed && styles.serviceActionPressed]} onPress={() => messagePhone(info.phone)}>
          <AppIcon name="chatbubble-outline" size={18} color={colors.info} /><Text style={styles.serviceActionText}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LocationNameCard({
  info,
  onOpenMaps,
}: {
  info: ReturnType<typeof jobInfo>;
  onOpenMaps: () => Promise<void>;
}) {
  return (
    <View style={styles.contactCard}>
      <View style={styles.detailRowIcon}>
        <AppIcon name="location-outline" size={16} color={colors.info} />
      </View>
      <View style={styles.homeJobCopy}>
        <Text style={styles.buildingTitle}>{info.building}</Text>
        <Text style={styles.assignedMeta}>{info.location}</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.serviceMapButton} onPress={onOpenMaps}>
        <Text style={styles.viewButtonText}>View on Map</Text>
      </Pressable>
    </View>
  );
}

function CompletedJobView({
  detail,
  info,
  servicePayment,
  onOpenDetails,
}: {
  detail: JobDetail;
  info: ReturnType<typeof jobInfo>;
  servicePayment: TechnicianServicePayment | null;
  onOpenDetails: () => void;
}) {
  return (
    <>
      <View style={styles.completedHero}>
        <View style={styles.completedCheck}>
          <AppIcon name="checkmark" size={46} color={colors.surface} />
        </View>
        <Text style={styles.completedTitle}>Service Completed!</Text>
        <Text style={styles.settingsSubtitle}>
          Your service request has been successfully completed.
        </Text>
      </View>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>{requestSummary(detail.request)}</Text>
            <Text style={styles.assignedMeta}>{detail.request.serviceId || `SR-${detail.request.id}`}</Text>
          </View>
          <Badge text="Completed" tone="info" />
        </View>
        <Info
          title={info.building}
          rows={[
            info.location,
            detail.request.completedAt || detail.request.preferredVisitDate,
            `Technician: ${detail.activeAssignment?.technicianProfileId || "Valor technician"}`,
            detail.report?.completionNotes || "Issue resolved. Elevator is working fine now.",
          ]}
        />
      </View>
      {servicePayment?.payment ? (
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryText}>Payment</Text>
        </Pressable>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rate Our Service</Text>
        <Text style={styles.ratingStars}>★ ★ ★ ★ ★</Text>
        <Text style={styles.successHint}>Excellent Service!</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Add a comment (optional)"
          placeholderTextColor={colors.muted}
          multiline
        />
      </View>
      <View style={styles.detailTwoCol}>
        <Pressable style={styles.outlineButton} onPress={onOpenDetails}>
          <Text style={styles.outlineText}>View Service Details</Text>
        </Pressable>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryText}>Back to Home</Text>
        </Pressable>
      </View>
    </>
  );
}

const ArrivalOtpPanel = ArrivalVerification;

function CashPaymentPanel({
  payment,
  onVerify,
}: {
  payment: TechnicianServicePayment;
  onVerify: (paymentId: number, otpId: number, otp: string) => Promise<void>;
}) {
  const [otp, setOtp] = useState("");
  const cash = payment.cashOtp;
  if (!cash || !payment.payment) return null;
  return (
    <View style={styles.cashPanel}>
      <Text style={styles.detailSectionTitle}>Cash payment</Text>
      <Text style={styles.muted}>
        {payment.invoice?.invoiceNumber || "Service invoice"} -{" "}
        {payment.invoice?.totalAmount
          ? `${payment.invoice.currency || "INR"} ${payment.invoice.totalAmount}`
          : "Amount available in invoice"}
      </Text>
      <Badge
        text={label(cash.status)}
        tone={cash.status === "VERIFIED" ? "info" : "muted"}
      />
      {cash.status === "PENDING" ? (
        <>
          <Input
            label="Cash payment OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
          />
          <Pressable
            style={styles.primaryButton}
            disabled={otp.length < 4}
            onPress={() => onVerify(payment.payment!.id, cash.id, otp)}
          >
            <Text style={styles.primaryText}>Verify Cash Payment</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.successHint}>
          Cash payment recorded and invoice updated.
        </Text>
      )}
    </View>
  );
}

function ChecklistPanel({
  checklist,
  onSave,
}: {
  checklist: JobChecklistView | null;
  onSave: (
    responses: { itemId: number; checked?: boolean; valueText?: string }[],
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<
    Record<number, { checked?: boolean; valueText?: string }>
  >({});
  useEffect(() => {
    const next: Record<number, { checked?: boolean; valueText?: string }> = {};
    checklist?.responses.forEach((row) => {
      next[row.itemId] = {
        checked: !!row.checked,
        valueText: row.valueText ?? "",
      };
    });
    setDraft(next);
  }, [checklist?.id, checklist?.updatedAt]);
  if (!checklist)
    return (
      <View style={styles.workPanel}>
        <View style={styles.serviceSectionHeading}><View style={styles.verificationIcon}><AppIcon name="list-outline" size={24} color={colors.teal} /></View><View style={styles.serviceFlexibleCopy}><Text style={styles.panelEyebrow}>SERVICE CHECKS</Text><Text style={styles.serviceCardHeading}>Checklist</Text></View><Text style={styles.panelTag}>Not assigned</Text></View>
        <View style={styles.checklistEmpty}><Text style={styles.serviceBodyText}>No checklist has been assigned for this service type.</Text></View>
      </View>
    );
  const update = (
    id: number,
    patch: { checked?: boolean; valueText?: string },
  ) =>
    setDraft((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const payload = checklist.items.map((item) => ({
    itemId: item.id,
    checked: draft[item.id]?.checked,
    valueText: draft[item.id]?.valueText,
  }));
  return (
    <View style={styles.workPanel}>
      <View style={styles.checklistHeading}>
        <Text style={styles.sectionHeading}>{checklist.templateName}</Text>
        <Badge
          text={`${checklist.requiredCompleted}/${checklist.requiredTotal} required`}
          tone={checklist.status === "COMPLETED" ? "muted" : "info"}
        />
      </View>
      {checklist.items.map((item) => (
        <View key={item.id} style={styles.checkRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: !!draft[item.id]?.checked }}
            style={[styles.checkBox, draft[item.id]?.checked && styles.checklistChecked]}
            onPress={() =>
              update(item.id, { checked: !draft[item.id]?.checked })
            }
          >
            {draft[item.id]?.checked && <AppIcon name="checkmark" size={18} color={colors.surface} />}
          </Pressable>
          <View style={styles.checkCopy}>
            <Text style={styles.cardTitle}>
              {item.label}
              {item.required ? " *" : ""}
            </Text>
            {item.description ? (
              <Text style={styles.muted}>{item.description}</Text>
            ) : null}
            {item.inputType !== "CHECKBOX" ? (
              <TextInput
                style={styles.input}
                value={draft[item.id]?.valueText ?? ""}
                onChangeText={(text) => update(item.id, { valueText: text })}
                placeholder="Response"
              />
            ) : null}
          </View>
        </View>
      ))}
      <Pressable style={styles.primaryButton} onPress={() => onSave(payload)}>
        <Text style={styles.primaryText}>Save checklist</Text>
      </Pressable>
    </View>
  );
}

function CompletionOtpPanel({
  state,
  onRequest,
  onVerify,
}: {
  state: CompletionOtpState | null;
  onRequest: () => Promise<void>;
  onVerify: (otpId: number, otp: string) => Promise<void>;
}) {
  const [otp, setOtp] = useState("");
  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeading}>Completion OTP</Text>
      <Text style={styles.muted}>
        Ask the customer for the completion OTP delivered through Valor
        communications. The code is never displayed in this app.
      </Text>
      {state ? (
        <Info
          title="OTP state"
          rows={[
            state.status,
            state.expiresAt ? `Expires: ${state.expiresAt}` : null,
            `Attempts remaining: ${state.attemptsRemaining}`,
          ]}
        />
      ) : null}
      <Pressable style={styles.outlineButton} onPress={onRequest}>
        <Text style={styles.outlineText}>Request OTP</Text>
      </Pressable>
      {state && state.status !== "VERIFIED" ? (
        <>
          <Input label="Customer OTP" value={otp} onChangeText={setOtp} />
          <Pressable
            style={styles.primaryButton}
            disabled={otp.length < 4}
            onPress={() => onVerify(state.id, otp)}
          >
            <Text style={styles.primaryText}>Verify OTP</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function VisitDetailScreen({
  visit,
  onStatus,
  onCancel,
  onReschedule,
  onAdditional,
}: {
  visit: VisitView;
  onStatus: (status: "IN_PROGRESS" | "COMPLETED") => void;
  onCancel: () => void;
  onReschedule: () => void;
  onAdditional: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>{visitTitle(visit)}</Text>
      <Text style={styles.title}>Visit detail</Text>
      <Badge text={label(visit.status)} tone="info" />
      <Info
        title="Schedule"
        rows={[
          visit.scheduledDate,
          `${visit.startTime} - ${visit.endTime}`,
          visit.notes,
        ]}
      />
      <Info
        title="Context"
        rows={[
          visit.title,
          visit.liftId ? `Lift ID ${visit.liftId}` : null,
          visit.customerProfileId
            ? `Customer profile ${visit.customerProfileId}`
            : null,
          visit.technicianProfileId
            ? `Technician profile ${visit.technicianProfileId}`
            : null,
        ]}
      />
      {visit.status === "SCHEDULED" ? (
        <Pressable
          style={styles.primaryButton}
          onPress={() => onStatus("IN_PROGRESS")}
        >
          <Text style={styles.primaryText}>Start visit</Text>
        </Pressable>
      ) : null}
      {visit.status === "IN_PROGRESS" ? (
        <Pressable
          style={styles.primaryButton}
          onPress={() => onStatus("COMPLETED")}
        >
          <Text style={styles.primaryText}>Complete visit</Text>
        </Pressable>
      ) : null}
      {visit.status !== "CANCELLED" && visit.status !== "COMPLETED" ? (
        <>
          <Pressable style={styles.outlineButton} onPress={onReschedule}>
            <Text style={styles.outlineText}>Request reschedule</Text>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={onAdditional}>
            <Text style={styles.outlineText}>Request additional visit</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={onCancel}>
            <Text style={styles.primaryText}>Cancel visit</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function notificationGroup(
  item: NotificationView,
): "Jobs" | "Emergency" | "Messages" | "System" {
  const text = `${item.title} ${item.message}`.toLowerCase();
  if (text.includes("emergency") || text.includes("breakdown"))
    return "Emergency";
  if (text.includes("message") || text.includes("supervisor"))
    return "Messages";
  if (
    text.includes("job") ||
    text.includes("assigned") ||
    text.includes("visit") ||
    text.includes("reminder") ||
    text.includes("parts")
  )
    return "Jobs";
  return "System";
}

function notificationIcon(item: NotificationView): IoniconName {
  const group = notificationGroup(item);
  return group === "Emergency"
    ? "alert-circle"
    : group === "Messages"
      ? "chatbubble-ellipses"
      : group === "Jobs"
        ? "checkmark-circle"
        : "information-circle";
}
function Notifications({
  page,
  onRefresh,
  onRead,
  onMarkAll,
  variant = "alerts",
}: {
  page: PageView<NotificationView> | null;
  onRefresh: () => void;
  onRead: (id: number) => void;
  onMarkAll: () => Promise<void>;
  variant?: "alerts" | "notifications";
}) {
  const filters = variant === "alerts" ? ["All", "Job Updates", "Emergency", "Messages"] : ["All", "Jobs", "System", "Announcements"];
  const [filter, setFilter] = useState(filters[0]);
  const allItems = page?.items ?? [];
  const items = allItems.filter((item) => {
    if (filter === "All") return true;
    const group = notificationGroup(item);
    if (filter === "Job Updates" || filter === "Jobs") return group === "Jobs";
    if (filter === "Emergency") return group === "Emergency";
    if (filter === "Messages") return group === "Messages";
    if (filter === "System") return group === "System";
    return group !== "Jobs" && group !== "Emergency" && group !== "Messages";
  });
  const grouped = variant === "notifications" ? groupNotificationItems(items) : items.length ? [{title: "", items}] : [];
  return (
    <View style={styles.contentFill}>
      <View style={styles.screenTopRow}>
        <View style={{flexGrow: 1, flexBasis: 220, minWidth: 0}}>
          <Text style={styles.jobsTitle}>{variant === "alerts" ? "Alerts & Messages" : "Notifications"}</Text>
          <Text style={styles.settingsSubtitle}>Stay updated with your jobs, alerts and important information.</Text>
        </View>
        <Pressable style={styles.filterChipButton} onPress={variant === "alerts" ? onMarkAll : onRefresh}>
          <Text style={styles.refreshText}>{variant === "alerts" ? "Mark All Read" : "Refresh"}</Text>
        </Pressable>
      </View>
      <SegmentedTabs labels={filters} active={Math.max(0, filters.indexOf(filter))} onChange={(index) => setFilter(filters[index])} />
      <FlatList
        data={grouped}
        keyExtractor={(group) => group.title || "alerts"}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: group }) => (
          <View>
            {group.title ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
            {group.items.map((item) => (
              <AlertRow key={item.id} item={item} onPress={() => onRead(item.id)} />
            ))}
          </View>
        )}
        ListEmptyComponent={<Empty text="No notifications." />}
      />
    </View>
  );
}
function ProfileDetailsPage({ profile, onSave }: { profile: TechnicianProfileView | null; onSave: (input: Partial<TechnicianProfileView>) => Promise<void> }) {
  const [draft, setDraft] = useState<Partial<TechnicianProfileView>>(profile ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof TechnicianProfileView, value: string) => setDraft(current => ({...current, [key]: value}));
  const save = async () => {
    setSaving(true); setError(null);
    try { await onSave({dateOfBirth: draft.dateOfBirth || null, gender: draft.gender || null, address: draft.address || null, emergencyContactName: draft.emergencyContactName || null, emergencyContactPhone: draft.emergencyContactPhone || null}); }
    catch (problem) { setError(err(problem)); } finally { setSaving(false); }
  };
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.profileContent}>
    <Text style={styles.jobsTitle}>Personal information</Text>
    <Text style={styles.settingsSubtitle}>Keep your contact information current. Contact your administrator to change account details.</Text>
    <Text style={styles.settingsSection}>Account details</Text>
    <View style={styles.twoColumnForm}>
      <ProfileField label="Employee ID" value={profile?.employeeId || "Not provided"} disabled />
      <ProfileField label="Phone number" value={profile?.phone || "Not provided"} disabled />
      <ProfileField label="Email address" value={profile?.email || "Not provided"} disabled />
      <ProfileField label="Assigned area" value={profile?.assignedArea || "Not assigned"} disabled />
    </View>
    <Text style={styles.settingsSection}>Personal details</Text>
    <View style={styles.twoColumnForm}>
      <ProfileField label="Date of birth (YYYY-MM-DD)" value={draft.dateOfBirth || ""} onChangeText={text => update("dateOfBirth", text)} />
      <ProfileField label="Gender (optional)" value={draft.gender || ""} onChangeText={text => update("gender", text)} />
      <ProfileField wide label="Address" value={draft.address || ""} onChangeText={text => update("address", text)} />
    </View>
    <Text style={styles.settingsSection}>Emergency contact</Text>
    <View style={styles.twoColumnForm}>
      <ProfileField label="Contact name" value={draft.emergencyContactName || ""} onChangeText={text => update("emergencyContactName", text)} />
      <ProfileField label="Contact phone" value={draft.emergencyContactPhone || ""} onChangeText={text => update("emergencyContactPhone", text)} />
    </View>
    {error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} style={[styles.greenButton, saving && styles.disabled]} onPress={save}><Text style={styles.primaryText}>{saving ? "Saving?" : "Save changes"}</Text></Pressable>
  </ScrollView>;
}
function ProfilePasswordPage({ onDone }: { onDone: () => void }) {
  return <ScrollView contentContainerStyle={styles.profileContent}>
    <Text style={styles.jobsTitle}>Password support</Text>
    <View style={styles.card}><AppIcon name="lock-closed-outline" size={32} color={colors.info} /><Text style={styles.sectionHeading}>Keep your account secure</Text><Text style={styles.muted}>Technician password changes are managed by Valor support. Contact your administrator with your employee ID to request a password reset.</Text></View>
    <Text style={styles.muted}>Never share your password or customer verification codes with anyone.</Text>
  </ScrollView>;
}
function HelpPage() {
  const [query, setQuery] = useState("");
  const faqs = ["How do I accept a job?", "What should I do after reaching the site?", "How do I mark a job as completed?", "How can I update my availability status?", "What should I do in an emergency situation?"];
  const visible = faqs.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Help & Support</Text>
      <Text style={styles.settingsSubtitle}>We're here to help you. Get the support you need.</Text>
      <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search for help (e.g. job, payment, app issue...)" placeholderTextColor={colors.muted} />
      <View style={styles.helpTilesFour}>
        <SupportTile icon="book-outline" title="User Guide" meta="Learn how to use the app" tone="blue" />
        <SupportTile icon="help-circle-outline" title="FAQs" meta="Find answers to common questions" tone="green" />
        <SupportTile icon="alert-circle-outline" title="Report an Issue" meta="Let us know about a problem" tone="red" />
        <SupportTile icon="shield-checkmark-outline" title="Safety Guidelines" meta="View safety protocols" tone="purple" />
      </View>
      <View style={styles.rowBetween}><Text style={styles.settingsSection}>Frequently Asked Questions</Text><Text style={styles.link}>View All</Text></View>
      <View style={styles.formCardSoft}>{visible.map((item) => <FaqLine key={item} text={item} />)}</View>
      <Text style={styles.settingsSection}>Contact Support</Text>
      <SupportContact icon="call-outline" title="Call Support" meta="Speak to our support team" action="+91 1800 123 4567" />
      <SupportContact icon="mail-outline" title="Email Support" meta="Send us an email" action="support@valorifts.com" />
      <SupportContact icon="chatbubble-ellipses-outline" title="Live Chat" meta="Chat with our support team" action="Start Chat" />
      <SupportContact danger icon="alert-circle-outline" title="Emergency Support" meta="For urgent issues during a job" action="Call Now" />
      <View style={styles.supportHours}><AppIcon name="information-circle" size={18} color={colors.info} /><Text style={styles.muted}>Our support team is available from Monday to Saturday, 9:00 AM - 6:00 PM (IST).</Text></View>
    </ScrollView>
  );
}
function LocationPage() {
  const [status, setStatus] = useState("Permission not requested");
  const request = async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    setStatus(
      result.granted ? "Location enabled" : "Location permission denied",
    );
  };
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Location Services</Text>
      <Text style={styles.settingsSubtitle}>
        Location is used only while tracking an active assigned job.
      </Text>
      <Info title="Current access" rows={[status]} />
      <Pressable style={styles.primaryButton} onPress={request}>
        <Text style={styles.primaryText}>Allow Location Access</Text>
      </Pressable>
    </ScrollView>
  );
}
function LanguagePage() {
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Language</Text>
      <Text style={styles.settingsSubtitle}>
        Choose your preferred language.
      </Text>
      <Pressable style={[styles.settingsRow, styles.settingsRowSelected]}>
        <View style={styles.settingsIcon}><AppIcon name="checkmark-circle" size={18} color={colors.action} /></View>
        <Text style={styles.settingsTitle}>English</Text>
        <Text style={styles.chevron}>Selected</Text>
      </Pressable>
    </ScrollView>
  );
}
function ThemePage() {
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Theme</Text>
      <Text style={styles.settingsSubtitle}>
        Choose how Valor appears on your device.
      </Text>
      <Pressable style={[styles.settingsRow, styles.settingsRowSelected]}>
        <View style={styles.settingsIcon}><AppIcon name="sunny-outline" size={18} color={colors.info} /></View>
        <Text style={styles.settingsTitle}>Light mode</Text>
        <Text style={styles.chevron}>Selected</Text>
      </Pressable>
      <Info
        title="Dark mode"
        rows={[
          "Dark mode will be available when the shared app preference is enabled.",
        ]}
      />
    </ScrollView>
  );
}
function AboutPage() {
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>About Valor</Text>
      <Text style={styles.settingsSubtitle}>Valor Lift Services</Text>
      <Info
        title="Technician app"
        rows={[
          "Built for safe, clear, and reliable field service work.",
          "Use the shared Valor platform APIs for jobs, visits, reports, checklists, and tracking.",
        ]}
      />
      <Info
        title="Terms & Privacy"
        rows={[
          "Your account and service data are handled by Valor Lift Services.",
        ]}
      />
    </ScrollView>
  );
}

function ActionModal({
  mode,
  onClose,
  onSubmit,
  onError,
}: {
  mode: ModalMode | null;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  useEffect(() => setValues({}), [mode]);
  const fields = modalFields(mode);
  const chooseImage = async (source: "camera" | "library") => {
    setPickerError(null);
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPickerError("Camera permission is required to take a photo.");
        return;
      }
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) {
      setPickerError("No image selected.");
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
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        return;
      }
      const file = result.assets[0];
      if (!file) {
        setPickerError("No document selected.");
        return;
      }
      setValues(
        validateUploadFile({
          uri: file.uri,
          name: file.name || "document.pdf",
          type: file.mimeType || "application/pdf",
          size: file.size,
        }),
      );
    } catch (error) {
      setPickerError(err(error));
      return;
    }
  };
  return (
    <Modal
      visible={!!mode}
      animationType="slide"
      onRequestClose={onClose}
      transparent
    >
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modal} accessibilityViewIsModal>
          <View style={styles.sheetHandle} />
          <LinearGradient colors={["#082A55", "#16487B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetHero}>
            <View style={styles.sheetHeroTop}><View style={styles.sheetIcon}><AppIcon name={mode === "transition" ? "checkmark-circle-outline" : "create-outline"} size={26} color="#FFFFFF" /></View><Text style={styles.sheetEyebrow}>VALOR · JOB UPDATE</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" disabled={saving} onPress={onClose} style={styles.sheetClose}><AppIcon name="close" size={22} color="#FFFFFF" /></Pressable></View>
            <Text style={styles.sheetTitle}>{modalTitle(mode)}</Text>
            <Text style={styles.sheetDescription}>{mode === "transition" ? "Add your notes and confirm the next step for this job." : "Review the details below before saving your update."}</Text>
          </LinearGradient>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetForm}>
          {mode === "attachment" || mode === "privateAttachment" ? (
            <>
              <Text style={styles.muted}>
                Choose a JPEG, PNG, WebP, or PDF up to 10 MB.
              </Text>
              <View style={styles.attachmentActions}>
                <Pressable
                  style={styles.outlineButton}
                  onPress={() => chooseImage("camera")}
                >
                  <Text style={styles.outlineText}>Camera</Text>
                </Pressable>
                <Pressable
                  style={styles.outlineButton}
                  onPress={() => chooseImage("library")}
                >
                  <Text style={styles.outlineText}>Gallery</Text>
                </Pressable>
                <Pressable
                  style={styles.outlineButton}
                  onPress={chooseDocument}
                >
                  <Text style={styles.outlineText}>PDF</Text>
                </Pressable>
              </View>
              {values.name ? (
                <View style={styles.selectedFile}>
                  <Text style={styles.cardTitle}>{values.name}</Text>
                  <Text style={styles.muted}>{values.type}</Text>
                </View>
              ) : (
                <Empty text="No file selected." />
              )}
              {pickerError ? (
                <Text style={styles.errorText}>{pickerError}</Text>
              ) : null}
            </>
          ) : (
            fields.map((field) => (
              <View key={field} style={styles.sheetField}>
              <Text style={styles.panelFieldLabel}>{label(field)}</Text>
              <TextInput
                accessibilityLabel={label(field)}
                style={[styles.sheetInput, /notes|reason|diagnosis|work/.test(field) && styles.sheetTextarea]}
                placeholder={`Enter ${label(field).toLowerCase()}`}
                placeholderTextColor={colors.muted}
                value={values[field] ?? ""}
                onChangeText={(text) =>
                  setValues((current) => ({ ...current, [field]: text }))
                }
                multiline={
                  field.includes("notes") ||
                  field.includes("reason") ||
                  field.includes("diagnosis") ||
                  field.includes("work")
                }
              />
              </View>
            ))
          )}
          </ScrollView>
          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              style={styles.sheetCancel}
              disabled={saving}
              onPress={onClose}
            >
              <Text style={styles.outlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetSubmit, saving && styles.disabled, pressed && styles.serviceActionPressed]}
              disabled={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await onSubmit(values);
                } catch (error) {
                  onError(error);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Text style={styles.primaryText}>
                {saving ? "Saving..." : mode === "transition" ? "Confirm update" : "Save details"}
              </Text>
              {saving ? <ActivityIndicator size="small" color={colors.surface} /> : <AppIcon name="arrow-forward" size={18} color={colors.surface} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function modalFields(mode: ModalMode | null) {
  if (mode === "report")
    return ["diagnosis", "workPerformed", "testingResult", "completionNotes"];
  if (mode === "transition") return ["notes"];
  if (mode === "visitCancel") return ["reason"];
  if (mode === "reschedule" || mode === "additionalVisit")
    return [
      "reason",
      "requestedDate",
      "requestedStartTime",
      "requestedEndTime",
    ];
  if (mode === "attachment" || mode === "privateAttachment") return [];
  return [];
}

function modalTitle(mode: ModalMode | null) {
  if (mode === "report") return "Service report";
  if (mode === "visitCancel") return "Cancel visit";
  if (mode === "reschedule") return "Request reschedule";
  if (mode === "additionalVisit") return "Request additional visit";
  if (mode === "attachment") return "Upload attachment";
  if (mode === "privateAttachment")
    return "Upload technician-private attachment";
  return "Confirm action";
}

function allowedTransitions(status: RequestStatus): RequestStatus[] {
  switch (status) {
    case "ASSIGNED":
      return ["ACCEPTED", "CANCELLED"];
    case "ACCEPTED":
      return ["ON_THE_WAY", "CANCELLED"];
    case "ON_THE_WAY":
      return ["REACHED_SITE", "CANCELLED"];
    case "REACHED_SITE":
      return ["DIAGNOSIS", "CANCELLED"];
    case "DIAGNOSIS":
      return ["REPAIR_IN_PROGRESS", "CANCELLED"];
    case "REPAIR_IN_PROGRESS":
      return ["WAITING_FOR_PARTS", "TESTING", "CANCELLED"];
    case "WAITING_FOR_PARTS":
      return ["REPAIR_IN_PROGRESS", "CANCELLED"];
    case "TESTING":
      return ["COMPLETED", "CANCELLED"];
    default:
      return [];
  }
}

function assetToUploadValues(asset: ImagePicker.ImagePickerAsset) {
  return validateUploadFile({
    uri: asset.uri,
    name: asset.fileName || "photo.jpg",
    type: asset.mimeType || "image/jpeg",
    size: asset.fileSize,
  });
}

function validateUploadFile(file: Partial<UploadFile> & { size?: number }) {
  if (!file.uri) throw new Error("Selected file is missing a URI.");
  if (!file.name) throw new Error("Selected file is missing a name.");
  if (!file.type || !SUPPORTED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error("Unsupported file type. Use JPEG, PNG, WebP, or PDF.");
  }
  if (file.size && file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment must be 10 MB or smaller.");
  }
  return {
    uri: file.uri,
    name: file.name,
    type: file.type,
    size: file.size ? String(file.size) : "",
  };
}

function parseAttachment(values: Record<string, string>): UploadFile {
  const file = validateUploadFile({
    uri: values.uri,
    name: values.name,
    type: values.type,
    size: values.size ? Number(values.size) : undefined,
  });
  return { uri: file.uri, name: file.name, type: file.type };
}

function FilterBar({
  labels,
  active,
  onChange,
  wrap = false,
  customerTheme = false,
}: {
  labels: string[];
  active: number;
  onChange: (index: number) => void;
  wrap?: boolean;
  customerTheme?: boolean;
}) {
  if (wrap) return <View style={styles.filterWrap}>{labels.map((item, index) => <Pressable
    key={item}
    accessibilityRole="button"
    accessibilityState={{ selected: active === index }}
    style={[styles.filter, styles.filterWrappedItem, active === index && styles.selected, customerTheme && styles.jobsFilterChip, customerTheme && active === index && styles.jobsFilterSelected]}
    onPress={() => onChange(index)}
  ><Text style={[styles.outlineText, customerTheme && styles.jobsFilterText, customerTheme && active === index && styles.jobsFilterSelectedText]}>{item}</Text></Pressable>)}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filters}
    >
      {labels.map((item, index) => (
        <Pressable
          key={item}
          style={[styles.filter, active === index && styles.selected]}
          onPress={() => onChange(index)}
        >
          <Text style={styles.outlineText}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function JobCard({ job, onPress }: { job: RequestView; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{requestTitle(job)}</Text>
        <Badge
          text={label(job.status)}
          tone={job.priority === "EMERGENCY" ? "danger" : "info"}
        />
      </View>
      <Text style={styles.muted}>{requestSummary(job)}</Text>
      <Text style={styles.muted}>
        {label(job.serviceType)} - {label(job.priority)}
      </Text>
    </Pressable>
  );
}

function TechnicianIllustration() {
  return (
    <View style={styles.techIllustration}>
      <View style={styles.techHead}>
        <AppIcon name="happy-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.techBody}>
        <Text style={styles.techBadge}>V</Text>
      </View>
      <View style={styles.techThumb}>
        <AppIcon name="thumbs-up" size={18} color={colors.primary} />
      </View>
    </View>
  );
}
function LiftIllustration({
  tone = "blue",
}: {
  tone?: "blue" | "red" | "green";
}) {
  return (
    <View
      style={[
        styles.liftIllustration,
        tone === "red" && styles.liftIllustrationRed,
        tone === "green" && styles.liftIllustrationGreen,
      ]}
    >
      <AppIcon name="business-outline" size={28} color={colors.info} />
    </View>
  );
}
function HomeMetric({
  icon,
  label: metricLabel,
  value,
  tone,
}: {
  icon: IoniconName;
  label: string;
  value?: number;
  tone: "blue" | "teal" | "amber" | "red" | "green";
}) {
  return (
    <View style={styles.homeMetric}>
      <AppIcon
        name={icon}
        size={20}
        color={
          tone === "amber"
            ? colors.warn
            : tone === "teal"
              ? colors.teal
            : tone === "red"
              ? colors.danger
              : tone === "green"
                ? colors.action
                : colors.info
        }
      />
      <Text style={styles.homeMetricValue}>{value ?? 0}</Text>
      <Text style={styles.homeMetricLabel}>{metricLabel}</Text>
    </View>
  );
}
function HomeJobRow({
  job,
  onPress,
}: {
  job: RequestView;
  onPress: () => void;
}) {
  const building =
    String((job as Record<string, unknown>).buildingName || "") ||
    requestSummary(job);
  const location =
    String((job as Record<string, unknown>).location || "") ||
    String((job as Record<string, unknown>).buildingAddress || "") ||
    "Location pending";
  const serviceTone =
    job.serviceType === "BREAKDOWN" || job.priority === "EMERGENCY"
      ? "danger"
      : job.serviceType === "INSPECTION"
        ? "muted"
        : "info";
  return (
    <Pressable style={styles.homeJobRow} onPress={onPress}>
      <Text
        style={[styles.jobTime, job.priority === "EMERGENCY" && styles.danger]}
      >
        {formatTimeSlot(job.preferredTimeSlot)}
      </Text>
      <LiftIllustration tone={job.priority === "EMERGENCY" ? "red" : "blue"} />
      <View style={styles.homeJobCopy}>
        <Text style={styles.homeJobTitle}>{building}</Text>
        <Text style={styles.homeJobMeta}>
          {job.liftId ? `Lift ${job.liftId}` : "Lift details pending"} ·{" "}
          {location}
        </Text>
      </View>
      <Badge text={label(job.serviceType)} tone={serviceTone} />
      <ChevronIcon />
    </Pressable>
  );
}
function AssignedJobCard({
  job,
  onPress,
  onStart,
}: {
  job: RequestView;
  onPress: () => void;
  onStart: () => void;
}) {
  const info = jobInfo(job);
  const canStart = job.status === "ASSIGNED" || job.status === "ACCEPTED";
  return (
    <View style={styles.assignedCardLarge}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View job at ${info.building}`} onPress={onPress} style={styles.assignedTopRow}>
        <View style={styles.jobsBuildingThumb}>
          <AppIcon name="business-outline" size={34} color={colors.primary} />
        </View>
        <View style={styles.assignedCopy}>
          <Text style={styles.assignedTitle}>{info.building}</Text>
          <Text style={styles.assignedMeta}>{info.location}</Text>
          <Text style={styles.assignedMeta}>{info.lift}</Text>
          <Text style={styles.assignedMeta}>{info.persons}</Text>
        </View>
      </Pressable>
      <View style={styles.jobStatusRow}>
        <View style={styles.jobsService}>
          <AppIcon name="construct-outline" size={17} color={colors.info} />
          <Text style={styles.assignedServiceText}>{label(job.serviceType)}</Text>
        </View>
        <View style={[styles.jobsStatusBadge, job.status === "COMPLETED" && styles.jobsStatusSuccess, job.priority === "EMERGENCY" && styles.jobsStatusEmergency]}>
          <Text style={[styles.jobsStatusText, job.status === "COMPLETED" && styles.jobsStatusSuccessText, job.priority === "EMERGENCY" && styles.jobsStatusEmergencyText]}>{label(job.status)}</Text>
        </View>
      </View>
      <View style={styles.assignedTimeBox}>
        <AppIcon name="time-outline" size={17} color={colors.muted} />
        <Text style={styles.assignedTime}>{job.preferredTimeSlot || "Visit time not scheduled"}</Text>
      </View>
      <View style={styles.assignedBottomRow}>
        <Pressable accessibilityRole="button" style={styles.viewButton} onPress={onPress}>
          <Text style={styles.viewButtonText}>View Details</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[styles.startButton, !canStart && styles.upcomingButton]}
          onPress={canStart ? onStart : onPress}
        >
          <Text style={[styles.startButtonText, !canStart && styles.upcomingButtonText]}>
            {canStart ? "Start Job" : job.status === "COMPLETED" ? "Completed" : IN_PROGRESS.includes(job.status) ? "Continue Job" : "View Status"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DetailRow({
  icon,
  label: rowLabel,
  value,
  tone,
}: {
  icon: IoniconName;
  label: string;
  value?: string | null;
  tone?: "warning";
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailRowIcon, tone === "warning" && styles.detailWarningIcon]}>
        <AppIcon name={icon} size={16} color={tone === "warning" ? colors.warn : colors.info} />
      </View>
      <View style={styles.detailRowCopy}>
        <Text style={styles.detailRowLabel}>{rowLabel}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
      <ChevronIcon />
    </View>
  );
}
function VisitCard({
  visit,
  onPress,
}: {
  visit: VisitView;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.card} disabled={!onPress} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{visitTitle(visit)}</Text>
        <Badge text={label(visit.status)} tone="info" />
      </View>
      <Text style={styles.muted}>
        {visit.scheduledDate} - {visit.startTime} to {visit.endTime}
      </Text>
      <Text style={styles.muted}>{visitContext(visit)}</Text>
    </Pressable>
  );
}

function Metric({
  label: metricLabel,
  value,
  danger,
}: {
  label: string;
  value?: number;
  danger?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, danger && styles.danger]}>
        {value ?? 0}
      </Text>
      <Text style={styles.muted}>{metricLabel}</Text>
    </View>
  );
}

function Info({
  title,
  rows,
}: {
  title: string;
  rows: Array<string | number | null | undefined>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.filter(Boolean).map((row) => (
        <Text key={String(row)} style={styles.muted}>
          {row}
        </Text>
      ))}
    </View>
  );
}

function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <Pressable onPress={onAction}>
        <Text style={styles.link}>{action}</Text>
      </Pressable>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <AppIcon name="file-tray-outline" size={24} color={colors.info} />
      </View>
      <Text style={styles.emptyTitle}>Nothing to show yet</Text>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function Badge({
  text,
  tone,
}: {
  text: string;
  tone: "info" | "danger" | "muted";
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === "danger" && styles.badgeDanger,
        tone === "muted" && styles.badgeMuted,
      ]}
    >
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label: actionLabel,
  tone,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  tone: "blue" | "red" | "green" | "amber";
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <AppIcon
        name={icon}
        size={17}
        color={
          tone === "red"
            ? colors.danger
            : tone === "green"
              ? colors.action
              : tone === "amber"
                ? colors.warn
                : colors.info
        }
      />
      <Text style={styles.quickLabel}>{actionLabel}</Text>
    </Pressable>
  );
}

function SegmentedTabs({
  labels,
  active,
  onChange,
}: {
  labels: string[];
  active: number;
  onChange: (index: number) => void;
}) {
  return (
    <View style={styles.segmentedTabs}>
      {labels.map((item, index) => (
        <Pressable
          key={item}
          style={[styles.segmentTab, active === index && styles.segmentTabActive]}
          onPress={() => onChange(index)}
        >
          <Text style={[styles.segmentTabText, active === index && styles.segmentTabTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AlertRow({ item, onPress }: { item: NotificationView; onPress: () => void }) {
  const group = notificationGroup(item);
  const tone =
    group === "Emergency"
      ? styles.alertIconDanger
      : group === "Messages"
        ? styles.alertIconAmber
        : group === "System"
          ? styles.alertIconMuted
          : styles.alertIconBlue;
  return (
    <Pressable style={styles.alertRow} onPress={onPress}>
      <View style={[styles.alertIcon, tone]}>
        <AppIcon name={notificationIcon(item)} size={19} color={group === "Emergency" ? colors.danger : group === "Messages" ? colors.warn : group === "System" ? colors.teal : colors.info} />
      </View>
      <View style={styles.notificationCopy}>
        <View style={styles.rowBetween}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
      </View>
      {item.status !== "READ" ? <View style={styles.unreadDot} /> : <ChevronIcon />}
    </Pressable>
  );
}

function groupNotificationItems(items: NotificationView[]) {
  const now = normalizeDate(new Date());
  const yesterday = addDays(now, -1);
  const todayItems: NotificationView[] = [];
  const yesterdayItems: NotificationView[] = [];
  const weekItems: NotificationView[] = [];
  items.forEach((item) => {
    const date = item.createdAt ? normalizeDate(new Date(item.createdAt)) : now;
    if (sameDay(date, now)) todayItems.push(item);
    else if (sameDay(date, yesterday)) yesterdayItems.push(item);
    else weekItems.push(item);
  });
  return [
    { title: "Today", items: todayItems },
    { title: "Yesterday", items: yesterdayItems },
    { title: "This Week", items: weekItems },
  ].filter((group) => group.items.length > 0);
}

function formatNotificationTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ProfileField({
  label: fieldLabel,
  value,
  onChangeText,
  disabled,
  wide,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <View style={[styles.profileField, wide && styles.profileFieldWide]}>
      <Text style={styles.profileFieldLabel}>{fieldLabel}</Text>
      <TextInput
        style={[styles.profileFieldInput, disabled && styles.profileFieldDisabled]}
        value={value}
        editable={!disabled}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function PasswordInput({
  label: fieldLabel,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{fieldLabel}</Text>
      <View style={styles.passwordInputWrap}>
        <AppIcon name="lock-closed-outline" size={15} color={colors.primary} />
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry
        />
        <AppIcon name="eye-off-outline" size={15} color={colors.muted} />
      </View>
    </View>
  );
}

function SupportTile({
  icon,
  title,
  meta,
  tone,
}: {
  icon: IoniconName;
  title: string;
  meta: string;
  tone: "blue" | "green" | "red" | "purple";
}) {
  return (
    <Pressable style={[styles.supportTile, styles[`supportTile${tone}` as keyof typeof styles] as object]}>
      <AppIcon name={icon} size={18} color={colors.info} />
      <Text style={styles.supportTileTitle}>{title}</Text>
      <Text style={styles.supportTileMeta}>{meta}</Text>
      <ChevronIcon />
    </Pressable>
  );
}

function FaqLine({ text }: { text: string }) {
  return (
    <View style={styles.faqRow}>
      <Text style={styles.settingsTitle}>{text}</Text>
      <ChevronIcon />
    </View>
  );
}

function SupportContact({
  icon,
  title,
  meta,
  action,
  danger,
}: {
  icon: IoniconName;
  title: string;
  meta: string;
  action: string;
  danger?: boolean;
}) {
  return (
    <View style={[styles.supportContact, danger && styles.supportContactDanger]}>
      <View style={styles.supportContactIcon}>
        <AppIcon name={icon} size={18} color={danger ? colors.danger : colors.info} />
      </View>
      <View style={styles.profileCopy}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSubtitle}>{meta}</Text>
      </View>
      <Text style={[styles.link, danger && styles.danger]}>{action}</Text>
    </View>
  );
}

function EmergencyRequestsPage({
  jobs,
  onJob,
}: {
  jobs: RequestView[];
  onJob: (job: RequestView) => void;
}) {
  return (
    <View style={styles.contentFill}>
      <Text style={styles.jobsTitle}>Emergency Requests</Text>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <AssignedJobCard
            job={item}
            onPress={() => onJob(item)}
            onStart={() => onJob(item)}
          />
        )}
        ListEmptyComponent={<Empty text="No emergency requests right now." />}
      />
    </View>
  );
}

function SupportPage({ profile }: { profile: TechnicianProfileView | null }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.jobsTitle}>Support</Text>
      <Info
        title="Supervisor Contact"
        rows={[
          profile?.assignedArea
            ? `Area supervisor for ${profile.assignedArea}`
            : "Area supervisor",
          "Call support from the official Valor contact list.",
          "Share job ID, location, lift ID, and safety risk before escalation.",
        ]}
      />
      <Text style={styles.muted}>Use the supervisor contact provided by your dispatcher. Keep your employee ID and job number ready.</Text>
    </ScrollView>
  );
}

function DeferredActionPage({ title }: { title: string }) {
  return (
    <View style={styles.contentFill}>
      <Text style={styles.jobsTitle}>{title}</Text>
      <View style={styles.empty}>
        <Text style={styles.cardTitle}>Not available yet</Text>
        <Text style={styles.muted}>
          This feature is not available yet. Open your assigned job details or contact your supervisor for assistance.
        </Text>
      </View>
    </View>
  );
}

function ReportIssuePage() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.jobsTitle}>Report Issue</Text>
      <Input label="Issue title" placeholder="Safety risk, blocked access, or tool issue" />
      <Input label="Details" placeholder="Add clear notes for the supervisor" multiline />
      <Pressable style={styles.primaryButton}>
        <Text style={styles.primaryText}>Submit Issue</Text>
      </Pressable>
    </ScrollView>
  );
}

function SafetyPage() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.jobsTitle}>Safety First</Text>
      {[
        "Wear helmet, gloves, harness, and insulated footwear.",
        "Lock out lift power before opening panels.",
        "Keep the landing door secured while diagnosing faults.",
        "Stop work and contact the supervisor for unsafe site conditions.",
      ].map((item) => (
        <View key={item} style={styles.checkRow}>
          <View style={styles.safetyIcon}><AppIcon name="checkmark" size={18} color={colors.action} /></View>
          <Text style={styles.rowText}>{item}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ReportsPage({
  jobs,
  dashboard,
  onHistory,
  onIssue,
}: {
  jobs: RequestView[];
  dashboard: TechnicianDashboard | null;
  onHistory: () => void;
  onIssue: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.jobsTitle}>Reports</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.homeMetrics}
      >
        <HomeMetric icon="checkmark-circle" label="Completed" value={dashboard?.completedJobs} tone="green" />
        <HomeMetric icon="sync" label="In Progress" value={dashboard?.inProgressJobs} tone="teal" />
        <HomeMetric icon="time-outline" label="Pending" value={dashboard?.pendingJobs} tone="amber" />
      </ScrollView>
      <Pressable style={styles.card} onPress={onHistory}>
        <Text style={styles.cardTitle}>Service History</Text>
        <Text style={styles.muted}>{jobs.length} recent jobs available.</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={onIssue}>
        <Text style={styles.cardTitle}>Work reports</Text>
        <Text style={styles.muted}>Open an assigned job to record your diagnosis, completed work and testing results.</Text>
      </Pressable>
    </ScrollView>
  );
}

function Input(
  props: React.ComponentProps<typeof TextInput> & { label: string },
) {
  const { label: inputLabel, ...rest } = props;
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{inputLabel}</Text>
      <TextInput
        {...rest}
        accessibilityLabel={props.accessibilityLabel ?? inputLabel}
        style={[styles.input, props.multiline && styles.textarea]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

