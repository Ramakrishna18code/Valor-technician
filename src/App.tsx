import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
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

type Screen =
  | "dashboard"
  | "jobs"
  | "visits"
  | "notifications"
  | "history"
  | "reports"
  | "profile"
  | "profileDetails"
  | "profilePassword"
  | "profileHelp"
  | "profileLocation"
  | "profileLanguage"
  | "profileTheme"
  | "profileNotifications"
  | "profileAbout"
  | "emergencyRequests"
  | "support"
  | "scanQr"
  | "requestParts"
  | "reportIssue"
  | "safety"
  | "jobDetail"
  | "visitDetail";
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
  "ACCEPTED",
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
  { label: "In Progress", statuses: IN_PROGRESS },
  { label: "Completed", status: "COMPLETED" },
  { label: "Cancelled", status: "CANCELLED" },
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
    "15 Persons";
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
  const [authStage, setAuthStage] = useState<AuthStage>("login");
  const [application, setApplication] = useState<TechnicianApplication | null>(
    null,
  );
  const [applicationToken, setApplicationToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [dashboard, setDashboard] = useState<TechnicianDashboard | null>(null);
  const [profile, setProfile] = useState<TechnicianProfileView | null>(null);
  const [jobs, setJobs] = useState<PageView<RequestView> | null>(null);
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
        !JOB_FILTERS[jobFilter].statuses ||
        JOB_FILTERS[jobFilter].statuses?.includes(item.status),
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
            jobs={jobs?.items ?? []}
            visits={visits?.items ?? []}
            loading={loading}
            onRefresh={loadCore}
            onJobs={() => setScreen("jobs")}
            onJob={openJob}
            onStartJob={async (job) => {
              try {
                if (job.status === "ASSIGNED") {
                  await technicianApi.transition(job.id, "ACCEPTED");
                  await technicianApi.transition(job.id, "ON_THE_WAY");
                } else if (job.status === "ACCEPTED") {
                  await technicianApi.transition(job.id, "ON_THE_WAY");
                }
                await loadCore();
              } catch (error) {
                setMessage(err(error));
              }
            }}
            onNotifications={() => setScreen("notifications")}
            onProfile={() => setScreen("profile")}
            onMenu={() => setScreen("profile")}
            onEmergency={() => setScreen("emergencyRequests")}
            onSupport={() => setScreen("support")}
            onScanQr={() => setScreen("scanQr")}
            onRequestParts={() => setScreen("requestParts")}
            onHistory={() => setScreen("history")}
            onReportIssue={() => setScreen("reportIssue")}
            onSafety={() => setScreen("safety")}
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
          <History
            items={history?.items ?? []}
            filter={historyFilter}
            onLoad={() =>
              loadHistory().catch((error) => setMessage(err(error)))
            }
            onFilter={(index) =>
              loadHistory(index).catch((error) => setMessage(err(error)))
            }
            onJob={openJob}
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
            onIssue={() => setScreen("reportIssue")}
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
          <Visits
            visits={visits?.items ?? []}
            loading={loading}
            onVisit={openVisit}
            onRefresh={loadCore}
          />
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
          <Profile
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
              onChange={(next) => {
                if (next === "history")
                  loadHistory().catch((error) => setMessage(err(error)));
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
              if (pendingStatus === "REACHED_SITE")
                setArrivalOtp(
                  await technicianApi.requestArrivalOtp(selectedJob.request.id),
                );
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
      const created = await technicianApplicationApi.create({
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
          `Use OTP ${sent.otp} for now. SMS delivery will be connected later.`,
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
    login: (
      <LoginScreen
        onLogin={onLogin}
        loading={loading}
        message={message}
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
        onBack={() => onStage("login")}
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
      <View style={styles.authTop}>
        <Pressable onPress={onBack} style={styles.authBack}>
          {onBack ? (
            <AppIcon name="chevron-back" size={24} color={colors.primary} />
          ) : null}
        </Pressable>
        <View style={styles.brand}>
          <Text style={styles.brandMark}>V</Text>
          <View>
            <Text style={styles.brandName}>VALOR</Text>
            <Text style={styles.brandSub}>LIFT SERVICES</Text>
          </View>
        </View>
        <Text style={styles.stepText}>{step ? `Step ${step} of 4` : ""}</Text>
      </View>
      {step ? (
        <View style={styles.stepper}>
          {["Basic Details", "Professional", "Documents", "Verify"].map(
            (item, index) => (
              <View key={item} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    index + 1 <= step && styles.stepDotActive,
                  ]}
                >
                  <Text style={styles.stepDotText}>
                    {index + 1 <= step ? "OK" : index + 1}
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
  loading,
  message,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
}) {
  const update = (key: string, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <AuthFrame step={1} onBack={onBack}>
      <Text style={styles.authTitle}>Create Account</Text>
      <Text style={styles.authSubtitle}>
        Join as a Technician and be part of safer buildings.
      </Text>
      <Text style={styles.authSectionTitle}>Basic Details</Text>
      <Text style={styles.authHelper}>
        Enter your personal information to get started.
      </Text>
      <AuthInput
        label="Full Name"
        placeholder="Enter your full name"
        value={value.fullName}
        onChangeText={(next) => update("fullName", next)}
      />
      <AuthInput
        label="Phone Number"
        placeholder="Enter 10 digit mobile number"
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
        placeholder="Enter a strong password"
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
        title={loading ? "Creating account..." : "Next"}
        onPress={onNext}
        disabled={loading}
      />
      <Text style={styles.authFooter}>
        Already have an account?{" "}
        <Text style={styles.authLink} onPress={onBack}>
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
    <AuthFrame onBack={onBack}>
      <View style={styles.otpIllustration}>
        <AppIcon name="phone-portrait-outline" size={44} color={colors.info} />
        <Text style={styles.otpBubble}>OTP</Text>
      </View>
      <Text style={styles.otpTitle}>Verify Your Mobile Number</Text>
      <Text style={styles.authSubtitle}>We sent a 4-digit OTP to</Text>
      <Text style={styles.otpPhoneText}>{phone}</Text>
      <Text style={styles.authHelper}>
        For now, use the temporary OTP shown above.
      </Text>
      <TextInput
        style={styles.otpInput}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="1  1  1  1"
        placeholderTextColor={colors.muted}
      />
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <Text style={styles.otpHint}>
        SMS delivery will be connected after provider setup.
      </Text>
      <AuthButton
        title={loading ? "Verifying..." : "Verify"}
        onPress={onVerify}
        disabled={loading || value.length !== 4}
      />
      <Text style={styles.authLink} onPress={onBack}>
        Change Mobile Number
      </Text>
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
    <AuthFrame step={2} onBack={onBack}>
      <Text style={styles.authTitle}>Professional Details</Text>
      <Text style={styles.authSubtitle}>
        Tell us about your experience and expertise.
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
        title={loading ? "Saving..." : "Next"}
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
    <AuthFrame step={3} onBack={onBack}>
      <Text style={styles.authTitle}>Documents (Optional)</Text>
      <Text style={styles.authSubtitle}>
        You can submit now and let the Admin verify documents later.
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
          Aadhaar and driving licence are recorded as numbers, not uploaded
          documents. All file uploads are optional until Admin verification is
          enabled.
        </Text>
      </View>
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <AuthButton
        title={loading ? "Saving..." : "Continue"}
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
    <AuthFrame step={4} onBack={onBack}>
      <Text style={styles.authTitle}>Review & Submit</Text>
      <Text style={styles.authSubtitle}>
        Please review your details before submitting.
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
          I confirm that all information provided is true and correct.
        </Text>
      </View>
      <AuthButton
        title={loading ? "Submitting..." : "Submit Registration"}
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
      <Text style={styles.successTitle}>Registration Submitted!</Text>
      <Text style={styles.successText}>
        Thank you for registering as a Lift Technician. Your application has
        been submitted successfully.
      </Text>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Under Review</Text>
        <Text style={styles.muted}>
          Our team will verify your details and documents. This may take 1-2
          business days.
        </Text>
      </View>
      <AuthButton
        title="Check Application Status"
        onPress={onStatus}
        disabled={loading}
      />
      <AuthButton title="Go to Login" onPress={onLogin} secondary />
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
      <AuthButton title="Go to Login" onPress={onLogin} />
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
  return (
    <View style={styles.authField}>
      <Text style={styles.fieldLabel}>{inputLabel}</Text>
      <Pressable
        style={styles.authInput}
        onPress={() =>
          onChange(options[(options.indexOf(value) + 1) % options.length])
        }
      >
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value || `Select ${inputLabel.toLowerCase()}`}
        </Text>
        <ChevronIcon />
      </Pressable>
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
      style={[
        styles.authButton,
        secondary && styles.authButtonSecondary,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
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
}: {
  onLogin: (input: { email: string; password: string }) => void;
  loading: boolean;
  message: string | null;
  onRegister?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Shell>
      <Text style={styles.logo}>VALOR</Text>
      <Text style={styles.title}>Technician sign in</Text>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {message ? <Text style={styles.errorText}>{message}</Text> : null}
      <Pressable
        style={[styles.primaryButton, loading && styles.disabled]}
        disabled={loading || !email.trim() || !password}
        onPress={() => onLogin({ email, password })}
      >
        <Text style={styles.primaryText}>
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>
      <Text style={styles.authFooter}>
        New to Valor?{" "}
        <Text style={styles.authLink} onPress={onRegister}>
          Create Account
        </Text>
      </Text>
    </Shell>
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

function Dashboard({
  dashboard,
  jobs,
  visits,
  loading,
  onRefresh,
  onJobs,
  onJob,
  onStartJob,
  onNotifications,
  onProfile,
  onMenu,
  onEmergency,
  onSupport,
  onScanQr,
  onRequestParts,
  onHistory,
  onReportIssue,
  onSafety,
}: {
  dashboard: TechnicianDashboard | null;
  jobs: RequestView[];
  visits: VisitView[];
  loading: boolean;
  onRefresh: () => void;
  onJobs: () => void;
  onJob: (job: RequestView) => void;
  onStartJob: (job: RequestView) => void;
  onNotifications: () => void;
  onProfile: () => void;
  onMenu: () => void;
  onEmergency: () => void;
  onSupport: () => void;
  onScanQr: () => void;
  onRequestParts: () => void;
  onHistory: () => void;
  onReportIssue: () => void;
  onSafety: () => void;
}) {
  const name =
    dashboard?.profile.email?.split("@")[0] ||
    dashboard?.profile.employeeId ||
    "Technician";
  const todayJobs = todayOnly(jobs).slice(0, 3);
  const alertCount = unreadCountFromJobs(jobs, dashboard);
  return (
    <ScrollView contentContainerStyle={styles.homeContent}>
      <View style={styles.homeTop}>
        <Pressable onPress={onMenu} style={styles.iconButton}>
          <AppIcon name="menu-outline" size={24} color={colors.primary} />
        </Pressable>
        <View style={styles.valorMark}>
          <Text style={styles.valorV}>V</Text>
          <View>
            <Text style={styles.logo}>VALOR</Text>
            <Text style={styles.logoSub}>LIFT SERVICES</Text>
          </View>
        </View>
        <View style={styles.homeTopActions}>
          <Pressable onPress={onNotifications} style={styles.iconButton}>
            <AppIcon name="notifications-outline" size={19} color={colors.primary} />
            {alertCount > 0 ? (
              <Text style={styles.iconBadge}>{Math.min(alertCount, 9)}</Text>
            ) : null}
          </Pressable>
          <Pressable onPress={onProfile} style={styles.avatarCircle}>
            <AppIcon name="person" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>Good Morning,</Text>
          <Text style={styles.heroTitle}>{label(name)}</Text>
          <Text style={styles.heroMeta}>
            Technician · {dashboard?.profile.employeeId || "Valor team"}
          </Text>
          <View style={styles.availability}>
            <View style={styles.availabilityDot} />
            <Text style={styles.availabilityText}>
              {label(dashboard?.profile.availabilityStatus)}
            </Text>
            <Text style={styles.availabilityChevron}>⌄</Text>
          </View>
        </View>
        <TechnicianIllustration />
        <View style={styles.heroServiceBox}>
          <Text style={styles.heroServiceText}>
            Service{"\n"}Today{"\n"}Safer{"\n"}Tomorrow
          </Text>
        </View>
      </View>
      <View style={styles.homeMetrics}>
        <HomeMetric icon="briefcase" label="Assigned\nJobs" value={dashboard?.assignedJobs} tone="blue" />
        <HomeMetric icon="sync" label="In\nProgress" value={dashboard?.inProgressJobs} tone="amber" />
        <HomeMetric icon="time-outline" label="Pending\nJobs" value={dashboard?.pendingJobs} tone="red" />
        <HomeMetric icon="checkmark-circle" label="Completed\nThis Month" value={dashboard?.completedThisQuarter ?? dashboard?.completedJobs} tone="green" />
      </View>
      <View style={styles.homeSectionHeader}>
        <Text style={styles.homeSectionTitle}>Today's Jobs</Text>
        <Pressable style={styles.homeViewAllButton} onPress={onJobs}>
          <Text style={styles.homeViewAll}>View All</Text>
          <AppIcon name="chevron-forward" size={13} color={colors.info} />
        </Pressable>
      </View>
      {loading && !dashboard ? (
        <ActivityIndicator color={colors.info} />
      ) : (
        todayJobs.map((job) => (
          <HomeJobRow key={job.id} job={job} onPress={() => onJob(job)} />
        ))
      )}
      {todayJobs.length === 0 ? <Empty text="No jobs assigned for today." /> : null}
      <View style={styles.homeDualRow}>
        <Pressable style={styles.emergencyCard} onPress={onEmergency}>
          <AppIcon name="alert-circle" size={24} color={colors.danger} />
          <View style={styles.dualCopy}>
            <Text style={styles.dualTitle}>Emergency{"\n"}Requests</Text>
            <Text style={styles.dualText}>{dashboard?.emergencyJobs ?? 0} request received</Text>
          </View>
          <ChevronIcon />
        </Pressable>
        <Pressable style={styles.supportCard} onPress={onSupport}>
          <AppIcon name="headset" size={24} color={colors.info} />
          <View style={styles.dualCopy}>
            <Text style={styles.dualTitle}>Support</Text>
            <Text style={styles.dualText}>Contact supervisor{"\n"}for assistance</Text>
          </View>
          <ChevronIcon />
        </Pressable>
      </View>
      <Text style={styles.homeSectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        <QuickAction icon="qr-code" label="Scan QR" tone="blue" onPress={onScanQr} />
        <QuickAction icon="cube" label="Request Parts" tone="red" onPress={onRequestParts} />
        <QuickAction icon="document-text" label="Service History" tone="green" onPress={onHistory} />
        <QuickAction icon="warning" label="Report Issue" tone="amber" onPress={onReportIssue} />
      </View>
      <Pressable style={styles.safetyCard} onPress={onSafety}>
        <View style={styles.safetyIcon}>
          <AppIcon name="shield-checkmark" size={18} color={colors.action} />
        </View>
        <View style={styles.safetyCopy}>
          <Text style={styles.safetyTitle}>Safety First</Text>
          <Text style={styles.safetyText}>
            Follow safety guidelines and use proper equipment at all times.
          </Text>
        </View>
        <ChevronIcon />
      </Pressable>
    </ScrollView>
  );
}
function Jobs({
  items,
  filter,
  loading,
  onFilter,
  onJob,
  onStartJob,
}: {
  items: RequestView[];
  filter: number;
  loading: boolean;
  onFilter: (index: number) => void;
  onJob: (job: RequestView) => void;
  onStartJob: (job: RequestView) => void;
}) {
  const [dateFilter, setDateFilter] = useState(0);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const dateFiltered = filterJobsByDate(items, DATE_FILTERS[dateFilter].key, year, month);
  return (
    <View style={styles.contentFill}>
      <Text style={styles.jobsTitle}>Jobs</Text>
      <View style={styles.datePicker}>
        <AppIcon name="calendar-outline" size={15} color={colors.info} />
        <Text style={styles.dateText}>{DATE_FILTERS[dateFilter].label}</Text>
        <ChevronIcon />
      </View>
      <FilterBar
        labels={DATE_FILTERS.map((item) => item.label)}
        active={dateFilter}
        onChange={setDateFilter}
      />
      <View style={styles.subFilterRow}>
        <TextInput
          style={styles.subFilterInput}
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          placeholder="Year"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.subFilterInput}
          value={month}
          onChangeText={setMonth}
          keyboardType="number-pad"
          placeholder="Month"
          placeholderTextColor={colors.muted}
        />
      </View>
      <FilterBar
        labels={JOB_FILTERS.map((item) => item.label)}
        active={filter}
        onChange={onFilter}
      />
      {loading ? (
        <ActivityIndicator color={colors.info} />
      ) : (
        <FlatList
          data={dateFiltered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <AssignedJobCard
              job={item}
              onPress={() => onJob(item)}
              onStart={() => onStartJob(item)}
            />
          )}
          ListEmptyComponent={<Empty text="No jobs for this filter." />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}
function History({
  items,
  filter,
  onLoad,
  onFilter,
  onJob,
}: {
  items: RequestView[];
  filter: number;
  onLoad: () => void;
  onFilter: (index: number) => void;
  onJob: (job: RequestView) => void;
}) {
  useEffect(() => {
    onLoad();
  }, []);
  return (
    <View style={styles.contentFill}>
      <View style={styles.screenTopRow}>
        <View>
          <Text style={styles.jobsTitle}>Job History</Text>
          <Text style={styles.settingsSubtitle}>View all your completed, cancelled and past jobs.</Text>
        </View>
        <Pressable style={styles.filterChipButton}>
          <Text style={styles.refreshText}>Filter</Text>
        </Pressable>
      </View>
      <SegmentedTabs
        labels={["All", "Completed", "Cancelled", "Emergency"]}
        active={filter}
        onChange={onFilter}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <HistoryJobRow job={item} onPress={() => onJob(item)} />}
        ListEmptyComponent={<Empty text="No history for this filter." />}
      />
    </View>
  );
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
          <Text style={styles.primaryText}>Slide to Reached Location</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (["REACHED_SITE", "DIAGNOSIS", "REPAIR_IN_PROGRESS", "WAITING_FOR_PARTS", "TESTING"].includes(request.status)) {
    return (
      <ScrollView contentContainerStyle={styles.detailContent}>
        <StatusHeader
          title="Service In Progress"
          subtitle="Our technician is working on your service request."
          request={request}
          callPhone={info.phone}
        />
        <ProgressSteps status={request.status} />
        <View style={styles.progressNotice}>
          <Text style={styles.progressNoticeTitle}>Service in Progress</Text>
          <Text style={styles.progressNoticeText}>Technician is working on the issue. We will notify you once it is completed.</Text>
        </View>
        <CustomerContactCard info={info} />
        <LocationNameCard info={info} onOpenMaps={onOpenMaps} />
        <RouteMapCard request={request} info={info} location={jobLocation} onOpenMaps={onOpenMaps} curved />
        <BuildingSummaryCard request={request} info={info} compact />
        <Info title="Job Instructions" rows={[info.instructions || "Check door sensors and lubrication. Carry standard service kit."]} />
        <ChecklistPanel checklist={checklist} onSave={onChecklistSave} />
        {request.status === "REACHED_SITE" || request.status === "DIAGNOSIS" ? (
          <ArrivalOtpPanel state={arrivalOtp} onRequest={onRequestArrivalOtp} onVerify={onVerifyArrivalOtp} />
        ) : null}
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
          style={[styles.primaryButton, request.status === "TESTING" && (!checklistDone || !otpDone) && styles.disabled]}
          disabled={request.status === "TESTING" && (!checklistDone || !otpDone)}
          onPress={() => onTransition(request.status === "TESTING" ? "COMPLETED" : "TESTING")}
        >
          <Text style={styles.primaryText}>Completed Job</Text>
        </Pressable>
        <Pressable style={styles.outlineButton} onPress={() => onTransition("WAITING_FOR_PARTS")}>
          <Text style={styles.outlineText}>Request Revisit</Text>
        </Pressable>
        <Pressable style={styles.outlineButton} onPress={onReport}>
          <Text style={styles.outlineText}>View Service Details</Text>
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
      <View>
        <Text style={styles.jobsTitle}>{title}</Text>
        <Text style={styles.settingsSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.flowHeaderRight}>
        <Badge text={label(request.status)} tone="info" />
        <Text style={styles.detailId}>Job ID: {request.serviceId || `SR-${request.id}`}</Text>
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
          <View style={[styles.stepBubble, index <= active && styles.stepBubbleActive]}>
            <Text style={styles.stepBubbleText}>{index <= active ? "✓" : ""}</Text>
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
        <AppIcon name="business-outline" size={34} color={colors.primary} />
      </View>
      <View style={styles.buildingCopy}>
        <View style={styles.rowBetween}>
          <Text style={styles.buildingTitle}>{info.building}</Text>
          <Badge text={label(request.serviceType)} tone={request.priority === "EMERGENCY" ? "danger" : "info"} />
        </View>
        <Text style={styles.assignedMeta}>{info.location}</Text>
        <Text style={styles.assignedMeta}>{info.lift}</Text>
        <Text style={styles.assignedMeta}>{info.persons} | Schindler</Text>
      </View>
      <ChevronIcon />
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
    <Pressable style={styles.routeMap} onPress={onOpenMaps}>
      <Text style={styles.mapChipLeft}>Your Location</Text>
      <Text style={styles.mapBlueDot}>●</Text>
      <View style={[styles.routeLine, curved && styles.routeLineDotted]} />
      <Text style={styles.mapRedPin}>●</Text>
      <Text style={styles.mapChipRight}>{info.building}</Text>
      <Text style={styles.mapCity}>{fieldText(request as Record<string, unknown>, ["area", "city"]) || "Banjara Hills"}</Text>
      <Text style={styles.mapCorner}>◎</Text>
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
      <View style={styles.homeJobCopy}>
        <Text style={styles.detailRowLabel}>Customer</Text>
        <Text style={styles.buildingTitle}>{info.customer}</Text>
      </View>
      <Pressable style={styles.callCircle} onPress={() => callPhone(info.phone)}>
        <Text style={styles.callCircleText}>Call</Text>
      </Pressable>
      <Pressable style={styles.callCircle} onPress={() => messagePhone(info.phone)}>
        <Text style={styles.callCircleText}>Msg</Text>
      </Pressable>
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
      <Pressable style={styles.viewButton} onPress={onOpenMaps}>
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

function ArrivalOtpPanel({
  state,
  onRequest,
  onVerify,
}: {
  state: ArrivalOtpState | null;
  onRequest: () => Promise<void>;
  onVerify: (otpId: number, otp: string) => Promise<void>;
}) {
  const [otp, setOtp] = useState("");
  return (
    <View style={styles.otpPanel}>
      <Text style={styles.detailSectionTitle}>Arrival verification</Text>
      <Text style={styles.muted}>
        Ask the customer for the arrival OTP shown in their Valor app. Verify it
        before starting the service.
      </Text>
      {state ? (
        <Badge
          text={label(state.status)}
          tone={state.status === "VERIFIED" ? "info" : "muted"}
        />
      ) : null}
      {state?.status !== "VERIFIED" ? (
        <>
          <Pressable style={styles.outlineButton} onPress={onRequest}>
            <Text style={styles.outlineText}>
              {state ? "Send OTP Again" : "Request Arrival OTP"}
            </Text>
          </Pressable>
          {state ? (
            <>
              <Input
                label="Customer arrival OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
              />
              <Pressable
                style={styles.primaryButton}
                disabled={otp.length < 4}
                onPress={() => onVerify(state.id, otp)}
              >
                <Text style={styles.primaryText}>Verify Arrival OTP</Text>
              </Pressable>
            </>
          ) : null}
        </>
      ) : (
        <Text style={styles.successHint}>
          Arrival verified. You can continue the job.
        </Text>
      )}
    </View>
  );
}

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
      <Info
        title="Checklist"
        rows={[
          "No active checklist template is assigned for this service type.",
        ]}
      />
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
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionHeading}>{checklist.templateName}</Text>
        <Badge
          text={`${checklist.requiredCompleted}/${checklist.requiredTotal} required`}
          tone={checklist.status === "COMPLETED" ? "muted" : "info"}
        />
      </View>
      {checklist.items.map((item) => (
        <View key={item.id} style={styles.checkRow}>
          <Pressable
            style={styles.checkBox}
            onPress={() =>
              update(item.id, { checked: !draft[item.id]?.checked })
            }
          >
            <Text style={styles.outlineText}>
              {draft[item.id]?.checked ? "OK" : ""}
            </Text>
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

function Visits({
  visits,
  loading,
  onVisit,
  onRefresh,
}: {
  visits: VisitView[];
  loading: boolean;
  onVisit: (visit: VisitView) => void;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.contentFill}>
      <SectionTitle title="Visits" action="Refresh" onAction={onRefresh} />
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <VisitCard visit={item} onPress={() => onVisit(item)} />
          )}
          ListEmptyComponent={<Empty text="No visits assigned." />}
        />
      )}
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
  const grouped = variant === "notifications" ? groupNotificationItems(items) : [{title: "", items}];
  return (
    <View style={styles.contentFill}>
      <View style={styles.screenTopRow}>
        <View>
          <Text style={styles.jobsTitle}>{variant === "alerts" ? "Alerts & Messages" : "Notifications"}</Text>
          <Text style={styles.settingsSubtitle}>Stay updated with your jobs, alerts and important information.</Text>
        </View>
        <Pressable style={styles.filterChipButton} onPress={variant === "alerts" ? onMarkAll : onRefresh}>
          <Text style={styles.refreshText}>{variant === "alerts" ? "Mark All Read" : "Notification Settings"}</Text>
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
function Profile({
  profile,
  dashboard,
  onNavigate,
  onLogout,
}: {
  profile: TechnicianProfileView | null;
  dashboard: TechnicianDashboard | null;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}) {
  const name =
    profile?.email?.split("@")[0] || profile?.employeeId || "Technician";
  const row = (
    icon: IoniconName,
    title: string,
    subtitle: string,
    target: Screen,
  ) => (
    <Pressable style={styles.settingsRow} onPress={() => onNavigate(target)}>
      <View style={styles.settingsIcon}>
        <AppIcon name={icon} size={19} color={colors.info} />
      </View>
      <View style={styles.settingsCopy}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSubtitle}>{subtitle}</Text>
      </View>
      <ChevronIcon />
    </Pressable>
  );
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Settings</Text>
      <Text style={styles.settingsSubtitle}>Manage your account and app preferences</Text>
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <AppIcon name="person" size={30} color={colors.info} />
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{label(name)}</Text>
          <Text style={styles.profileEmail}>{profile?.email || "Technician account"}</Text>
          <Text style={styles.profilePhone}>{profile?.phone || profile?.employeeId || "Valor Lift Services"}</Text>
        </View>
        <Pressable style={styles.editPill} onPress={() => onNavigate("profileDetails")}>
          <Text style={styles.editPillText}>Edit Profile</Text>
        </Pressable>
      </View>
      <Text style={styles.settingsSection}>Account Settings</Text>
      {row("person-outline", "Personal Information", "Manage your personal details", "profileDetails")}
      {row("lock-closed-outline", "Change Password", "Update your password securely", "profilePassword")}
      {row("notifications-outline", "Notifications", "Manage your notification preferences", "profileNotifications")}
      {row("language-outline", "Language", "Choose your preferred language", "profileLanguage")}
      <Text style={styles.settingsSection}>App Settings</Text>
      {row("location-outline", "Location Services", "Allow location access for job tracking", "profileLocation")}
      {row("moon-outline", "Dark Mode", "Switch between light and dark theme", "profileTheme")}
      <Text style={styles.settingsSection}>Support & About</Text>
      {row("help-circle-outline", "Help & Support", "Get help and contact support", "profileHelp")}
      {row("shield-checkmark-outline", "Terms & Privacy", "Read our terms and privacy policy", "profileAbout")}
      {row("information-circle-outline", "About", "App version and company information", "profileAbout")}
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <View style={styles.logoutRow}><AppIcon name="log-out-outline" size={18} color={colors.danger} /><Text style={styles.logoutText}>Logout</Text></View>
      </Pressable>
    </ScrollView>
  );
}
function ProfileDetailsPage({
  profile,
  onSave,
}: {
  profile: TechnicianProfileView | null;
  onSave: (input: Partial<TechnicianProfileView>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<TechnicianProfileView>>(profile ?? {});
  const update = (key: keyof TechnicianProfileView, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Personal Information</Text>
      <Text style={styles.settingsSubtitle}>View and update your personal details</Text>
      <View style={styles.profileHeaderCard}>
        <View style={styles.profilePhotoLarge}><AppIcon name="person" size={28} color={colors.info} /></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{label(profile?.email?.split("@")[0] || "Ramesh Kumar")}</Text>
          <Text style={styles.profileEmail}>{profile?.specialization || "Technician"}</Text>
          <Text style={styles.profilePhone}>{profile?.employeeId || "EMP001"}</Text>
        </View>
        <Pressable style={styles.changePhotoButton}><Text style={styles.viewButtonText}>Change Photo</Text></Pressable>
      </View>
      <Text style={styles.settingsSection}>Basic Information</Text>
      <View style={styles.twoColumnForm}>
        <ProfileField label="Full Name" value={String(draft.email?.split("@")[0] || "Ramesh Kumar")} onChangeText={() => undefined} />
        <ProfileField label="Employee ID" value={profile?.employeeId || "EMP001"} disabled />
        <ProfileField label="Date of Birth" value={String(draft.dateOfBirth ?? "15 Mar 1995")} onChangeText={(text) => update("dateOfBirth", text)} />
        <ProfileField label="Gender" value={String(draft.gender ?? "Male")} onChangeText={(text) => update("gender", text)} />
        <ProfileField label="Phone Number" value={profile?.phone || "+91 98765 43210"} disabled />
        <ProfileField label="Email Address" value={profile?.email || "ramesh.kumar@valorifts.com"} disabled />
      </View>
      <Text style={styles.settingsSection}>Address Information</Text>
      <View style={styles.formCardSoft}>
        <ProfileField wide label="Address" value={String(draft.address ?? "H.No. 12-3-45, Sri Sai Nagar, Bandlaguda, Hyderabad")} onChangeText={(text) => update("address", text)} />
        <View style={styles.twoColumnFormInner}>
          <ProfileField label="City" value="Hyderabad" />
          <ProfileField label="State" value="Telangana" />
          <ProfileField label="Pincode" value="500008" />
          <ProfileField label="Country" value="India" />
        </View>
      </View>
      <Text style={styles.settingsSection}>Emergency Contact</Text>
      <View style={styles.twoColumnForm}>
        <ProfileField label="Contact Name" value={String(draft.emergencyContactName ?? "Suresh Kumar")} onChangeText={(text) => update("emergencyContactName", text)} />
        <ProfileField label="Relationship" value="Brother" />
        <ProfileField label="Phone Number" value={String(draft.emergencyContactPhone ?? "+91 99876 54321")} onChangeText={(text) => update("emergencyContactPhone", text)} />
        <ProfileField label="Alternate Number" value="+91 90000 11122" />
      </View>
      <Pressable style={styles.primaryButton} onPress={() => onSave(draft)}><Text style={styles.primaryText}>Save Changes</Text></Pressable>
    </ScrollView>
  );
}
function ProfilePasswordPage({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.jobsTitle}>Change Password</Text>
      <Text style={styles.settingsSubtitle}>For your security, please enter your current password and set a new one.</Text>
      <View style={styles.securityCardBlue}>
        <View style={styles.securityLock}><AppIcon name="lock-closed" size={24} color={colors.surface} /></View>
        <View style={styles.profileCopy}>
          <Text style={styles.cardTitle}>Keep your account secure</Text>
          <Text style={styles.muted}>Use a strong password that you don't use on other websites.</Text>
        </View>
      </View>
      <PasswordInput label="Current Password" value={current} onChangeText={setCurrent} placeholder="Enter your current password" />
      <PasswordInput label="New Password" value={next} onChangeText={setNext} placeholder="Enter your new password" />
      <PasswordInput label="Confirm New Password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter your new password" />
      <View style={styles.passwordRulesCard}>
        <Text style={styles.cardTitle}>Password must contain:</Text>
        {["At least 8 characters", "At least one uppercase letter", "At least one lowercase letter", "At least one number", "At least one special character"].map((item) => <Text key={item} style={styles.ruleText}>○ {item}</Text>)}
      </View>
      <Pressable style={styles.primaryButton} onPress={onDone}><Text style={styles.primaryText}>Update Password</Text></Pressable>
      <Pressable style={styles.outlineButton}><Text style={styles.outlineText}>Cancel</Text></Pressable>
    </ScrollView>
  );
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
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.sectionHeading}>{modalTitle(mode)}</Text>
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
              <Input
                key={field}
                label={label(field)}
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
            ))
          )}
          <View style={styles.actions}>
            <Pressable
              style={styles.outlineButton}
              disabled={saving}
              onPress={onClose}
            >
              <Text style={styles.outlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, saving && styles.disabled]}
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
                {saving ? "Saving..." : "Submit"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
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
}: {
  labels: string[];
  active: number;
  onChange: (index: number) => void;
}) {
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
  tone: "blue" | "amber" | "red" | "green";
}) {
  return (
    <View style={styles.homeMetric}>
      <AppIcon
        name={icon}
        size={20}
        color={
          tone === "amber"
            ? colors.warn
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
    <Pressable style={styles.assignedCardLarge} onPress={onPress}>
      <View style={styles.assignedTopRow}>
        <View style={styles.buildingThumb}>
          <AppIcon name="business-outline" size={34} color={colors.primary} />
        </View>
        <View style={styles.assignedCopy}>
          <View style={styles.rowBetween}>
            <Text style={styles.assignedTitle}>{info.building}</Text>
            <Badge
              text={label(job.serviceType)}
              tone={job.priority === "EMERGENCY" ? "danger" : "info"}
            />
          </View>
          <Text style={styles.assignedMeta}>{info.location}</Text>
          <Text style={styles.assignedMeta}>{info.lift}</Text>
          <Text style={styles.assignedMeta}>{info.persons} | Schindler</Text>
        </View>
        <View style={styles.assignedTimeBox}>
          <Text style={styles.assignedTime}>{job.preferredTimeSlot || "Time pending"}</Text>
        </View>
      </View>
      <View style={styles.assignedBottomRow}>
        <View style={styles.serviceMini}>
          <AppIcon name="construct-outline" size={15} color={colors.info} />
          <View>
            <Text style={styles.detailRowLabel}>Service Type</Text>
            <Text style={styles.assignedServiceText}>{label(job.serviceType)}</Text>
          </View>
        </View>
        <Pressable style={styles.viewButton} onPress={onPress}>
          <Text style={styles.viewButtonText}>View Details</Text>
        </Pressable>
        <Pressable
          style={[styles.startButton, !canStart && styles.upcomingButton]}
          onPress={canStart ? onStart : onPress}
        >
          <Text style={[styles.startButtonText, !canStart && styles.upcomingButtonText]}>
            {canStart ? "Start Job" : job.status === "COMPLETED" ? "Completed" : "Upcoming"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
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

function HistoryJobRow({ job, onPress }: { job: RequestView; onPress: () => void }) {
  const info = jobInfo(job);
  const tone = job.status === "CANCELLED" ? "danger" : job.priority === "EMERGENCY" ? "danger" : "info";
  return (
    <Pressable style={styles.historyListRow} onPress={onPress}>
      <View style={styles.historyIconBox}><AppIcon name="business-outline" size={20} color={colors.info} /></View>
      <View style={styles.historyCopy}>
        <View style={styles.rowBetween}>
          <Text style={styles.historyJobId}>{job.serviceId || `JOB-${job.id}`}</Text>
          <Badge text={job.priority === "EMERGENCY" ? "Emergency" : label(job.status)} tone={tone} />
        </View>
        <Text style={styles.historyBuilding}>{info.building}</Text>
        <Text style={styles.historyMeta}>{info.location}</Text>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historyMeta}>{job.preferredVisitDate || "Date pending"}</Text>
          <Text style={styles.historyMeta}>{label(job.serviceType)}</Text>
          <Text style={styles.link}>{job.status === "COMPLETED" ? "View Report" : "View Details"}</Text>
        </View>
      </View>
    </Pressable>
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
        <AppIcon name={notificationIcon(item)} size={19} color={colors.primary} />
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
      <Pressable style={styles.primaryButton}>
        <Text style={styles.primaryText}>Contact Supervisor</Text>
      </Pressable>
    </ScrollView>
  );
}

function DeferredActionPage({ title }: { title: string }) {
  return (
    <View style={styles.contentFill}>
      <Text style={styles.jobsTitle}>{title}</Text>
      <View style={styles.empty}>
        <Text style={styles.cardTitle}>Deferred for now</Text>
        <Text style={styles.muted}>
          This action is intentionally parked until the backend contract is
          connected.
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
      <View style={styles.homeMetrics}>
        <HomeMetric icon="checkmark-circle" label="Completed" value={dashboard?.completedJobs} tone="green" />
        <HomeMetric icon="sync" label="In Progress" value={dashboard?.inProgressJobs} tone="amber" />
        <HomeMetric icon="time-outline" label="Pending" value={dashboard?.pendingJobs} tone="red" />
      </View>
      <Pressable style={styles.card} onPress={onHistory}>
        <Text style={styles.cardTitle}>Service History</Text>
        <Text style={styles.muted}>{jobs.length} recent jobs available.</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={onIssue}>
        <Text style={styles.cardTitle}>Report Issue</Text>
        <Text style={styles.muted}>Create a supervisor-facing issue note.</Text>
      </Pressable>
    </ScrollView>
  );
}

function BottomNav({
  screen,
  onChange,
}: {
  screen: Screen;
  onChange: (screen: Screen) => void;
}) {
  const items: Array<{ screen: Screen; label: string; icon: IoniconName; badge?: number }> = [
    { screen: "dashboard", label: "Home", icon: "home-outline" },
    { screen: "jobs", label: "Jobs", icon: "briefcase-outline" },
    { screen: "notifications", label: "Alerts", icon: "notifications-outline", badge: 3 },
    { screen: "reports", label: "Reports", icon: "bar-chart-outline" },
    { screen: "profile", label: "Profile", icon: "person-outline" },
  ];
  return (
    <View style={styles.nav}>
      {items.map((item) => (
        <Pressable
          key={item.screen}
          style={styles.navItem}
          onPress={() => onChange(item.screen)}
        >
          <View>
            <AppIcon
              name={item.icon}
              size={21}
              color={screen === item.screen ? colors.info : colors.muted}
            />
            {item.badge ? <Text style={styles.navBadge}>{item.badge}</Text> : null}
          </View>
          <Text
            style={[styles.navText, screen === item.screen && styles.navActive]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
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
        style={[styles.input, props.multiline && styles.textarea]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const colors = {
  background: "#F6F8FB",
  surface: "#FFFFFF",
  text: "#102033",
  muted: "#66758A",
  primary: "#082A55",
  action: "#168A4A",
  info: "#246DE3",
  border: "#DDE5EF",
  danger: "#D64545",
  warn: "#F59E0B",
  yellow: "#F6A800",
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 },
  app: { flex: 1 },
  center: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  header: {
    height: 56,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: { width: 60, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerIconButton: { borderRadius: 22 },
  logo: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
    color: colors.primary,
  },
  content: { padding: 16, paddingBottom: 96, gap: 10 },
  contentFill: { flex: 1, padding: 16, paddingBottom: 86 },
  pageHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 11, color: colors.info, fontWeight: "900" },
  listContent: { paddingBottom: 12 },
  kicker: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    fontSize: 25,
    color: colors.text,
    fontWeight: "900",
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 17,
    color: colors.text,
    fontWeight: "900",
    marginVertical: 8,
  },
  muted: { color: colors.muted, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: "800" },
  banner: {
    backgroundColor: "#FFF3E8",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#FFD9B8",
  },
  errorText: { color: colors.danger, lineHeight: 20 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 12,
  },
  metric: {
    width: "31%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  metricValue: { fontSize: 25, color: colors.primary, fontWeight: "900" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "900",
    marginBottom: 5,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  rowText: { color: colors.text, flex: 1 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  checkRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkBox: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCopy: { flex: 1, minWidth: 0 },
  empty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 18,
    alignItems: "center",
    marginVertical: 8,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#E2F1EF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeDanger: { backgroundColor: "#F9E0E0" },
  badgeMuted: { backgroundColor: "#ECEFF2" },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  filters: { maxHeight: 48, marginBottom: 10 },
  filter: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: "#E2F1EF" },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginVertical: 5,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginVertical: 5,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginVertical: 5,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  outlineText: { color: colors.primary, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  danger: { color: colors.danger },
  nav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
  },
  navItem: { alignItems: "center", minWidth: 50 },
  navIcon: {
    fontSize: 20,
    color: colors.muted,
    textAlign: "center",
    fontWeight: "900",
  },
  navBadge: {
    position: "absolute",
    right: -8,
    top: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    color: colors.surface,
    textAlign: "center",
    lineHeight: 16,
    fontSize: 9,
    fontWeight: "900",
  },
  navText: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  navActive: { color: colors.primary },
  inputGroup: { gap: 5, marginBottom: 8 },
  inputLabel: { fontSize: 12, color: colors.muted, fontWeight: "800" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  textarea: { minHeight: 78, textAlignVertical: "top" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.background,
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "88%",
  },
  actions: { flexDirection: "row", gap: 10 },
  attachmentActions: { flexDirection: "row", gap: 8, marginVertical: 10 },
  selectedFile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  homeContent: {
    padding: 12,
    paddingBottom: 92,
    gap: 10,
    backgroundColor: colors.background,
  },
  homeTop: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  valorMark: { flexDirection: "row", alignItems: "center", gap: 7 },
  valorV: { color: colors.yellow, fontSize: 28, fontWeight: "900" },
  logoSub: {
    fontSize: 6,
    color: colors.primary,
    fontWeight: "900",
    marginTop: -2,
  },
  homeTopActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  homeIcon: { fontSize: 18, color: colors.primary },
  iconBadge: {
    position: "absolute",
    right: 0,
    top: 0,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.danger,
    color: colors.surface,
    fontSize: 9,
    textAlign: "center",
    lineHeight: 15,
    fontWeight: "900",
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFE5BE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  homeAvatar: { fontSize: 20 },
  heroCard: {
    minHeight: 126,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    overflow: "hidden",
  },
  heroCopy: { flex: 1, zIndex: 2 },
  heroKicker: { fontSize: 10, color: "#DDE5EF" },
  heroTitle: {
    fontSize: 19,
    color: colors.surface,
    fontWeight: "900",
    marginTop: 4,
  },
  heroMeta: { fontSize: 10, color: "#DDE5EF", marginTop: 4 },
  availability: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.action,
  },
  availabilityText: { fontSize: 10, color: colors.action, fontWeight: "800" },
  availabilityChevron: { fontSize: 13, color: colors.muted },
  heroServiceBox: {
    position: "absolute",
    right: 10,
    top: 28,
    width: 48,
    padding: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  heroServiceText: {
    color: colors.surface,
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  techIllustration: {
    width: 116,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  techHead: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F6C79A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 7,
    borderColor: "#0B2347",
  },
  techFace: { color: "#1B3152", fontSize: 12 },
  techBody: {
    width: 72,
    height: 58,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#12345F",
    alignItems: "center",
    justifyContent: "center",
  },
  techBadge: { color: colors.yellow, fontSize: 20, fontWeight: "900" },
  techThumb: {
    position: "absolute",
    right: 2,
    bottom: 34,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  homeMetrics: { flexDirection: "row", gap: 8 },
  homeMetric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeMetricIcon: { color: colors.info, fontSize: 19, fontWeight: "900" },
  homeMetricAmber: { color: colors.warn },
  homeMetricRed: { color: colors.danger },
  homeMetricGreen: { color: colors.action },
  homeMetricValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  homeMetricLabel: {
    color: colors.muted,
    fontSize: 9,
    textAlign: "center",
    lineHeight: 12,
  },
  homeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  homeSectionTitle: { fontSize: 15, color: colors.primary, fontWeight: "900" },
  homeViewAll: { color: colors.info, fontSize: 11, fontWeight: "800" },
  homeViewAllButton: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  homeJobRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    minHeight: 68,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobTime: { fontSize: 9, color: colors.primary, fontWeight: "900", width: 52 },
  homeJobCopy: { flex: 1, minWidth: 0 },
  homeJobTitle: { fontSize: 11, color: colors.primary, fontWeight: "900" },
  homeJobMeta: { fontSize: 9, color: colors.muted, marginTop: 4 },
  homeDualRow: { flexDirection: "row", gap: 8 },
  emergencyCard: {
    flex: 1,
    minHeight: 70,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supportCard: {
    flex: 1,
    minHeight: 70,
    backgroundColor: "#EAF2FF",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dualIcon: { fontSize: 23 },
  dualCopy: { flex: 1, minWidth: 0 },
  dualTitle: { fontSize: 11, color: colors.primary, fontWeight: "900" },
  dualText: { fontSize: 9, color: colors.muted, lineHeight: 12, marginTop: 2 },
  quickGrid: { flexDirection: "row", gap: 7 },
  quickAction: {
    flex: 1,
    minHeight: 58,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickIcon: { color: colors.info, fontSize: 16, fontWeight: "900" },
  quickIconRed: { color: colors.danger },
  quickIconGreen: { color: colors.action },
  quickIconAmber: { color: colors.warn },
  quickLabel: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: "800",
    marginTop: 5,
    textAlign: "center",
  },
  safetyCard: {
    backgroundColor: "#EAF7EF",
    borderRadius: 8,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  safetyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#C6EED5",
    color: colors.action,
    textAlign: "center",
    lineHeight: 34,
    fontWeight: "900",
    fontSize: 19,
  },
  safetyCopy: { flex: 1 },
  safetyTitle: { fontSize: 11, color: colors.primary, fontWeight: "900" },
  safetyText: {
    fontSize: 9,
    color: colors.muted,
    lineHeight: 13,
    marginTop: 2,
  },
  chevron: { fontSize: 20, color: colors.muted },
  jobsTitle: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: "900",
    marginBottom: 8,
  },
  datePicker: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dateIcon: { color: colors.info, fontSize: 15, marginRight: 8 },
  dateText: { flex: 1, color: colors.primary, fontSize: 11, fontWeight: "800" },
  subFilterRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  subFilterInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: colors.text,
    fontWeight: "800",
  },
  assignedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
    flexDirection: "row",
    gap: 9,
  },
  assignedVisual: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF2FF",
    borderRadius: 7,
    padding: 6,
  },
  assignedService: {
    fontSize: 8,
    color: colors.primary,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "800",
  },
  assignedCopy: { flex: 1, minWidth: 0 },
  assignedTitle: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "900",
    flex: 1,
  },
  assignedMeta: { fontSize: 9, color: colors.muted, marginTop: 4 },
  assignedActions: { flexDirection: "row", gap: 6, marginTop: 8 },
  assignedCardLarge: {
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D8E8FF",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  assignedTopRow: { flexDirection: "row", gap: 10 },
  buildingThumb: {
    width: 78,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#DDEBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  assignedTimeBox: { width: 62, alignItems: "flex-end", justifyContent: "center" },
  assignedTime: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
  },
  assignedBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  serviceMini: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  assignedServiceText: { fontSize: 9, color: colors.primary, fontWeight: "900" },
  upcomingButton: { backgroundColor: "#E9F1FB" },
  upcomingButtonText: { color: colors.muted },
  viewButton: {
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flex: 1,
    alignItems: "center",
  },
  viewButtonText: { fontSize: 9, color: colors.info, fontWeight: "800" },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flex: 1,
    alignItems: "center",
  },
  startButtonText: { fontSize: 9, color: colors.surface, fontWeight: "800" },
  flowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  flowHeaderRight: { alignItems: "flex-end", gap: 5 },
  callCircle: {
    minWidth: 42,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E9F4FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  callCircleText: { color: colors.info, fontSize: 10, fontWeight: "900" },
  stepTracker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flowStepItem: { alignItems: "center", flex: 1, gap: 4 },
  stepBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DDE5EF",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBubbleActive: { backgroundColor: colors.action },
  stepBubbleText: { color: colors.surface, fontWeight: "900", fontSize: 12 },
  flowStepText: { fontSize: 8, color: colors.muted, fontWeight: "800", textAlign: "center" },
  flowStepTextActive: { color: colors.primary },
  buildingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  buildingCardCompact: { padding: 8 },
  buildingImage: {
    width: 92,
    height: 92,
    borderRadius: 8,
    backgroundColor: "#DDEBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  buildingGlyph: { fontSize: 36, color: colors.primary, fontWeight: "900" },
  buildingCopy: { flex: 1, minWidth: 0 },
  buildingTitle: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  locationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  fakeMapSmall: {
    height: 96,
    borderRadius: 8,
    backgroundColor: "#E5F0EA",
    overflow: "hidden",
    position: "relative",
  },
  mapLine: {
    position: "absolute",
    left: 30,
    right: 46,
    top: 46,
    height: 3,
    backgroundColor: colors.info,
    transform: [{ rotate: "-8deg" }],
  },
  mapPin: { position: "absolute", right: 62, top: 36, color: colors.danger, fontSize: 20 },
  mapLabel: {
    position: "absolute",
    right: 10,
    top: 28,
    color: colors.primary,
    fontSize: 8,
    fontWeight: "900",
  },
  mapOpen: {
    position: "absolute",
    right: 8,
    bottom: 8,
    color: colors.info,
    fontSize: 9,
    fontWeight: "900",
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  routeMap: {
    height: 210,
    borderRadius: 10,
    backgroundColor: "#E6EEF2",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  mapChipLeft: {
    position: "absolute",
    left: 42,
    top: 48,
    color: colors.info,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "900",
  },
  mapBlueDot: { position: "absolute", left: 38, top: 76, color: colors.info, fontSize: 28 },
  routeLine: {
    position: "absolute",
    left: 62,
    right: 66,
    top: 108,
    height: 4,
    backgroundColor: colors.info,
    transform: [{ rotate: "-10deg" }],
  },
  routeLineDotted: { borderStyle: "dotted", borderWidth: 2, borderColor: colors.info, backgroundColor: "transparent" },
  mapRedPin: { position: "absolute", right: 45, top: 112, color: colors.danger, fontSize: 28 },
  mapChipRight: {
    position: "absolute",
    right: 26,
    top: 88,
    color: colors.primary,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "900",
  },
  mapCity: { position: "absolute", left: "42%", top: 74, color: colors.muted, fontSize: 10 },
  mapCorner: { position: "absolute", right: 14, bottom: 14, color: colors.info, fontSize: 20 },
  routeStatsGrid: { flexDirection: "row", gap: 8 },
  routeStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  routeStatValue: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  routeStatLabel: { color: colors.muted, fontSize: 9, marginTop: 3 },
  greenButton: {
    backgroundColor: colors.action,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginVertical: 5,
  },
  progressNotice: {
    backgroundColor: "#E8F8ED",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#C6EED5",
  },
  progressNoticeTitle: { color: colors.action, fontSize: 13, fontWeight: "900" },
  progressNoticeText: { color: colors.action, fontSize: 10, marginTop: 4, lineHeight: 14 },
  contactCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileAvatarSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9F4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  completedHero: { alignItems: "center", paddingVertical: 18 },
  completedCheck: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#20C768",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  completedCheckText: { color: colors.surface, fontSize: 46, fontWeight: "900" },
  completedTitle: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  ratingStars: {
    color: colors.yellow,
    fontSize: 26,
    textAlign: "center",
    marginVertical: 8,
    fontWeight: "900",
  },
  detailContent: {
    padding: 12,
    paddingBottom: 96,
    gap: 8,
    backgroundColor: colors.background,
  },
  detailHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  detailId: { fontSize: 9, color: colors.muted, marginTop: 1 },
  detailIdentity: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  detailIdentityCopy: { flex: 1 },
  detailPlace: { fontSize: 14, color: colors.primary, fontWeight: "900" },
  detailMeta: { fontSize: 10, color: colors.muted, marginTop: 4 },
  liftIllustration: {
    width: 62,
    height: 54,
    backgroundColor: "#CFE0FF",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  liftIllustrationRed: { backgroundColor: "#FFE0E0" },
  liftIllustrationGreen: { backgroundColor: "#D7F3E1" },
  liftIcon: { fontSize: 30, color: colors.info, fontWeight: "900" },
  detailTwoCol: { flexDirection: "row", gap: 8 },
  detailRow: {
    flex: 1,
    minHeight: 58,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  detailRowIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EAF2FF",
    color: colors.info,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "900",
  },
  detailWarningIcon: { backgroundColor: "#FFF5E6", color: colors.warn },
  detailRowCopy: { flex: 1 },
  detailRowLabel: { fontSize: 9, color: colors.muted },
  detailRowValue: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "800",
    marginTop: 3,
  },
  detailSectionTitle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "900",
    marginTop: 4,
  },
  alertToolbar: {
    backgroundColor: "#EAF2FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertCount: { fontSize: 12, color: colors.primary, fontWeight: "900" },
  notificationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  notificationUnread: { borderColor: "#BFD4F6", backgroundColor: "#FBFDFF" },
  notificationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIconDanger: { backgroundColor: "#FFF0F0" },
  notificationIconText: { fontSize: 16, color: colors.info, fontWeight: "900" },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTitle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "900",
    flex: 1,
  },
  notificationMessage: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 3,
  },
  notificationMeta: {
    fontSize: 10,
    color: colors.info,
    fontWeight: "800",
    marginTop: 6,
  },
  notificationTime: { fontSize: 9, color: colors.muted },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.info,
    marginTop: 5,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#EAF7EF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyIconText: { color: colors.action, fontWeight: "900", fontSize: 18 },
  historyCopy: { flex: 1, minWidth: 0 },
  historyMeta: { fontSize: 10, color: colors.muted, marginTop: 5 },
  journeyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
  },
  journeySteps: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  journeyStep: { flex: 1, alignItems: "center", gap: 5 },
  journeyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ECEFF2",
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDotActive: { backgroundColor: colors.action },
  journeyDotText: { fontSize: 14, color: colors.muted, fontWeight: "900" },
  journeyLabel: { fontSize: 9, color: colors.muted, textAlign: "center" },
  routeStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  routeStat: {
    flex: 1,
    fontSize: 11,
    color: colors.primary,
    fontWeight: "800",
    textAlign: "center",
  },
  mapButton: {
    backgroundColor: "#EAF2FF",
    borderRadius: 8,
    padding: 11,
    alignItems: "center",
    marginTop: 10,
  },
  mapButtonText: { color: colors.info, fontWeight: "900" },
  otpPanel: {
    backgroundColor: "#EAF2FF",
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
    gap: 4,
  },
  cashPanel: {
    backgroundColor: "#EAF7EF",
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
    gap: 4,
  },
  successHint: { color: colors.action, fontWeight: "800", marginTop: 6 },
  profileContent: {
    padding: 14,
    paddingBottom: 96,
    backgroundColor: colors.background,
    gap: 8,
  },
  profileCard: {
    backgroundColor: "#EAF2FF",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  profileEditCard: {
    backgroundColor: "#EAF2FF",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  securityCard: {
    backgroundColor: "#EAF2FF",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  securityIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#CFE0FF",
    color: colors.info,
    textAlign: "center",
    lineHeight: 34,
    fontWeight: "900",
    fontSize: 18,
  },
  helpTiles: { flexDirection: "row", gap: 8 },
  helpTile: {
    flex: 1,
    minHeight: 86,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 9,
  },
  helpTileIcon: { color: colors.info, fontWeight: "900", fontSize: 17 },
  helpTileTitle: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "900",
    marginTop: 7,
  },
  helpTileMeta: {
    fontSize: 9,
    color: colors.muted,
    lineHeight: 13,
    marginTop: 3,
  },
  faqRow: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#D1E0FA",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 23 },
  profileCopy: { flex: 1 },
  profileName: { fontSize: 13, color: colors.primary, fontWeight: "900" },
  profileEmail: { fontSize: 9, color: colors.muted, marginTop: 3 },
  profilePhone: { fontSize: 9, color: colors.muted, marginTop: 2 },
  editPill: {
    backgroundColor: colors.info,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  editPillText: { fontSize: 9, color: colors.surface, fontWeight: "800" },
  settingsSection: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "900",
    marginTop: 11,
    marginBottom: 2,
  },
  settingsRow: {
    backgroundColor: colors.surface,
    minHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  settingsRowSelected: {
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 8,
  },
  settingsIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EAF2FF",
    color: colors.info,
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "900",
  },
  settingsCopy: { flex: 1 },
  settingsTitle: { fontSize: 11, color: colors.primary, fontWeight: "800" },
  settingsSubtitle: { fontSize: 9, color: colors.muted, lineHeight: 14 },
  logoutButton: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  logoutText: { color: colors.danger, fontSize: 11, fontWeight: "800" },
  authSafe: { flex: 1, backgroundColor: colors.surface, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 },
  authFrame: { flex: 1, backgroundColor: colors.surface },
  authTop: {
    height: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authBack: { width: 48, height: 48, justifyContent: "center", alignItems: "flex-start" },
  authBackLink: { alignSelf: "center", minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandMark: {
    fontSize: 33,
    color: colors.yellow,
    fontWeight: "900",
    transform: [{ rotate: "180deg" }],
  },
  brandName: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: "900",
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 6,
    color: colors.primary,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  stepText: {
    width: 48,
    textAlign: "right",
    fontSize: 10,
    color: colors.primary,
  },
  stepper: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 14,
    justifyContent: "space-between",
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E6EBF2",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: colors.info },
  stepDotText: { fontSize: 11, color: colors.primary, fontWeight: "800" },
  stepLabel: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 5,
    textAlign: "center",
  },
  authContent: { padding: 14, paddingBottom: 30 },
  authTitle: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: "900",
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 18,
  },
  authSectionTitle: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "900",
    marginTop: 4,
  },
  authHelper: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 16,
  },
  authField: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "800",
    marginBottom: 5,
  },
  authInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  fieldPlaceholder: { color: colors.muted, fontSize: 12 },
  fieldValue: { color: colors.text, fontSize: 12 },
  selectChevron: {
    position: "absolute",
    right: 12,
    top: 12,
    color: colors.muted,
    fontSize: 16,
  },
  infoStrip: {
    backgroundColor: "#EAF2FF",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.info,
    color: colors.surface,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "900",
  },
  infoText: { fontSize: 10, color: colors.muted, lineHeight: 15, flex: 1 },
  authButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.info,
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authButtonText: { color: colors.surface, fontWeight: "800", fontSize: 13 },
  authButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.info,
  },
  authButtonSecondaryText: {
    color: colors.info,
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
    flex: 1,
  },
  authFooter: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    marginTop: 14,
  },
  authLink: { color: colors.info, fontWeight: "800" },
  authError: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
    marginVertical: 6,
  },
  fieldValueText: { color: colors.text },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  segment: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentActive: { borderColor: colors.info, backgroundColor: "#EAF2FF" },
  segmentText: { fontSize: 11, color: colors.primary, fontWeight: "700" },
  otpIllustration: {
    height: 130,
    width: 130,
    borderRadius: 65,
    backgroundColor: "#EAF2FF",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 18,
  },
  otpPhone: { fontSize: 76, color: "#8FA5D5", lineHeight: 84 },
  otpBubble: {
    position: "absolute",
    right: 18,
    top: 44,
    backgroundColor: colors.info,
    color: colors.surface,
    borderRadius: 8,
    padding: 9,
    fontWeight: "900",
  },
  otpTitle: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  otpPhoneText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  otpInput: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 22,
    color: colors.text,
    marginVertical: 10,
  },
  otpHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 18,
  },
  otpResend: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
  },
  documentRow: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 7,
  },
  documentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EAF2FF",
    color: colors.info,
    textAlign: "center",
    lineHeight: 32,
    fontWeight: "900",
  },
  documentCopy: { flex: 1 },
  documentTitle: { fontSize: 11, color: colors.primary, fontWeight: "800" },
  documentMeta: { fontSize: 9, color: colors.muted, marginTop: 2 },
  uploadAction: { color: colors.info, fontSize: 10, fontWeight: "800" },
  uploaded: {
    color: colors.action,
    backgroundColor: "#EAF7EF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: "800",
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  reviewTitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "900",
    marginBottom: 8,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  reviewLabel: { fontSize: 10, color: colors.muted, flex: 1 },
  reviewValue: {
    fontSize: 10,
    color: colors.text,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  successIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#EAF7EF",
    color: colors.action,
    textAlign: "center",
    lineHeight: 92,
    fontSize: 58,
    fontWeight: "900",
    alignSelf: "center",
    marginTop: 38,
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  successText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  screenTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  filterChipButton: {
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  segmentedTabs: {
    flexDirection: "row",
    backgroundColor: "#EAF1FB",
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
  },
  segmentTab: {
    flex: 1,
    minHeight: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  segmentTabActive: { backgroundColor: colors.info },
  segmentTabText: { color: colors.primary, fontSize: 10, fontWeight: "800", textAlign: "center" },
  segmentTabTextActive: { color: colors.surface },
  historyListRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
  },
  historyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyJobId: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  historyBuilding: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: 2 },
  historyMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 7 },
  groupTitle: { color: colors.primary, fontSize: 12, fontWeight: "900", marginVertical: 8 },
  alertRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  alertIconBlue: { backgroundColor: "#EAF2FF" },
  alertIconDanger: { backgroundColor: "#FFE8E8" },
  alertIconAmber: { backgroundColor: "#FFF4D8" },
  alertIconMuted: { backgroundColor: "#EEF2F7" },
  alertIconText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  profileHeaderCard: {
    backgroundColor: "#F1F6FF",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#DDEBFF",
    marginVertical: 10,
  },
  profilePhotoLarge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#DDEBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoButton: {
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  twoColumnForm: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  twoColumnFormInner: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  formCardSoft: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 10 },
  profileField: { width: "48%", gap: 5 },
  profileFieldWide: { width: "100%" },
  profileFieldLabel: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  profileFieldInput: {
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 11,
    backgroundColor: colors.surface,
  },
  profileFieldDisabled: { backgroundColor: "#F4F7FB", color: colors.muted },
  securityCardBlue: { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10 },
  securityLock: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.info, alignItems: "center", justifyContent: "center" },
  passwordInputWrap: { height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8 },
  passwordLock: { color: colors.primary, fontWeight: "900" },
  passwordInput: { flex: 1, color: colors.text, fontSize: 11 },
  passwordEye: { color: colors.muted, fontWeight: "900" },
  passwordRulesCard: { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginVertical: 10 },
  ruleText: { color: colors.primary, fontSize: 11, marginTop: 6 },
  searchInput: { height: 40, borderRadius: 8, backgroundColor: "#EEF4FB", paddingHorizontal: 12, color: colors.text, marginVertical: 10 },
  helpTilesFour: { flexDirection: "row", gap: 8, marginBottom: 12 },
  supportTile: { flex: 1, minHeight: 94, borderRadius: 10, padding: 8, alignItems: "center" },
  supportTileblue: { backgroundColor: "#EAF2FF" },
  supportTilegreen: { backgroundColor: "#EAF8EF" },
  supportTilered: { backgroundColor: "#FFEDED" },
  supportTilepurple: { backgroundColor: "#F2EAFE" },
  supportTileIcon: { color: colors.info, fontSize: 17, fontWeight: "900" },
  supportTileTitle: { color: colors.primary, fontSize: 10, fontWeight: "900", textAlign: "center", marginTop: 5 },
  supportTileMeta: { color: colors.muted, fontSize: 8, textAlign: "center", lineHeight: 11, marginTop: 3 },
  supportContact: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  supportContactDanger: { backgroundColor: "#FFF2F2", borderColor: "#FFD0D0" },
  supportContactIcon: { width: 30, textAlign: "center", color: colors.info, fontWeight: "900" },
  supportHours: { backgroundColor: "#EAF2FF", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  logoutRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
