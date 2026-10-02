/**
 * Ordered screen inventory for the Valor Technician app.
 *
 * Auth screens are shown before the technician workspace. Workspace screens
 * follow the primary navigation order, with detail and utility screens grouped
 * under the page that opens them.
 */
export type Screen =
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

export const AUTH_SCREEN_ORDER = [
  "welcome",
  "login",
  "basic",
  "otp",
  "professional",
  "documents",
  "review",
  "submitted",
  "verification",
  "approved",
] as const;

export const TECHNICIAN_SCREEN_ORDER = [
  "dashboard",
  "jobs",
  "jobDetail",
  "visits",
  "visitDetail",
  "notifications",
  "history",
  "reports",
  "emergencyRequests",
  "support",
  "scanQr",
  "requestParts",
  "reportIssue",
  "safety",
  "profile",
  "profileDetails",
  "profilePassword",
  "profileHelp",
  "profileLocation",
  "profileLanguage",
  "profileTheme",
  "profileNotifications",
  "profileAbout",
] as const satisfies readonly Screen[];

export const TECHNICIAN_PRIMARY_NAV = [
  "dashboard",
  "jobs",
  "visits",
  "notifications",
  "history",
  "profile",
] as const satisfies readonly Screen[];

export const TECHNICIAN_SCREEN_LABELS: Record<Screen, string> = {
  dashboard: "Dashboard",
  jobs: "Assigned Jobs",
  visits: "Visits",
  notifications: "Notifications",
  history: "Job History",
  reports: "Reports",
  profile: "Profile & Settings",
  profileDetails: "Personal Information",
  profilePassword: "Password Support",
  profileHelp: "Help & FAQ",
  profileLocation: "Location Settings",
  profileLanguage: "Language",
  profileTheme: "Appearance",
  profileNotifications: "Notification Preferences",
  profileAbout: "About Valor",
  emergencyRequests: "Emergency Requests",
  support: "Support",
  scanQr: "Scan QR",
  requestParts: "Request Parts",
  reportIssue: "Report Issue",
  safety: "Safety",
  jobDetail: "Job Details",
  visitDetail: "Visit Details",
};
