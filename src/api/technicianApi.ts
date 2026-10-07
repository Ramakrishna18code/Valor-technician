import type { Place } from "../maps/places";
import { environment } from "../config/environment";
import { Platform } from "react-native";
import { tokenStorage } from "../storage/tokens";
import { requestData, unwrapEnvelope } from "./client";
import type {
  AttachmentView,
  CompletionOtpState,
  ArrivalOtpState,
  Authentication,
  JobChecklistView,
  CurrentUser,
  JobDetail,
  LocationView,
  NotificationView,
  PageView,
  ReportView,
  RequestStatus,
  RequestView,
  TechnicianDashboard,
  TechnicianProfileView,
  UploadFile,
  PrivateAttachmentView,
  VisitChangeRequestView,
  VisitStatus,
  VisitView,
  AvailabilityStatus,
  TechnicianServicePayment,
} from "../types/technician";

const pageItems = (page: any) => ({ ...page, items: page?.items || page?.content || [] });

export interface LoginInput {
  email: string;
  password: string;
}

export interface JobsQuery {
  status?: RequestStatus;
  page?: number;
  size?: number;
}

export interface VisitsQuery {
  fromDate?: string;
  toDate?: string;
  status?: VisitStatus;
  page?: number;
  size?: number;
}

export interface ReportInput {
  diagnosis: string;
  workPerformed: string;
  testingResult: string;
  completionNotes?: string;
}

export interface ChangeRequestInput {
  reason: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
}

async function attachmentForm(file: UploadFile) {
  const data = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(file.uri);
    if (!response.ok) throw new Error("Could not read the selected attachment.");
    data.append("file", await response.blob(), file.name);
  } else {
    data.append("file", file as unknown as Blob);
  }
  return data;
}

export const technicianApi = {
  searchPlaces: (q: string) => requestData<Place[]>({ method: "GET", url: `/api/v1/locations/search?q=${encodeURIComponent(q)}` }),
  getProfilePhoto: () => requestData<{ dataUri: string | null }>({ method: "GET", url: "/api/v1/profile/photo" }),
  async uploadProfilePhoto(file: UploadFile) { return requestData<{ dataUri: string | null }>({ method: "POST", url: "/api/v1/profile/photo", data: await attachmentForm(file), headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" } }); },
  removeProfilePhoto: () => requestData<{ dataUri: string | null }>({ method: "DELETE", url: "/api/v1/profile/photo" }),
  completionOtp: (id: number) => requestData<CompletionOtpState | null>({ method: "GET", url: `/api/v1/service-requests/${id}/completion-otp` }),
  async login(input: LoginInput) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(
        `${environment.apiBaseUrl}/api/v1/auth/login/technician`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: input.email.trim(),
            password: input.password,
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        throw new Error(
          "Sign in timed out. Check the backend URL and network.",
        );
      throw new Error(
        "Unable to reach Valor. Check the backend URL and network connection.",
      );
    } finally {
      clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    const auth = unwrapEnvelope<Authentication>(data);
    if (auth.role !== "TECHNICIAN") {
      throw new Error("This account cannot use the Technician app.");
    }
    await tokenStorage.saveTokens({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    });
    return auth;
  },

  async currentUser() {
    return requestData<CurrentUser>({ method: "GET", url: "/api/v1/me" });
  },

  async logout() {
    const tokens = await tokenStorage.getTokens();
    // End the local session before contacting the server. A rejected logout must
    // not refresh the credentials, and offline devices must still sign out.
    await tokenStorage.clear();
    if (!tokens?.refreshToken) return;
    try {
      await requestData<null>({
        method: "POST",
        url: "/api/v1/auth/logout",
        data: { refreshToken: tokens.refreshToken },
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        timeout: 5_000,
      });
    } catch {
      // Server revocation is best effort once the local credentials are removed.
    }
  },

  dashboard() {
    return requestData<TechnicianDashboard>({
      method: "GET",
      url: "/api/v1/technician/me/dashboard",
    });
  },

  profile() {
    return requestData<TechnicianProfileView>({
      method: "GET",
      url: "/api/v1/technician/me/profile",
    });
  },

  updateAvailability(availabilityStatus: AvailabilityStatus) {
    return requestData<TechnicianProfileView>({
      method: "PUT",
      url: "/api/v1/technician/me/profile",
      data: { availabilityStatus },
    });
  },

  updateProfile(input: Partial<TechnicianProfileView>) {
    return requestData<TechnicianProfileView>({
      method: "PUT",
      url: "/api/v1/technician/me/profile",
      data: input,
    });
  },

  jobs(query: JobsQuery = {}) {
    return requestData<PageView<RequestView>>({
      method: "GET",
      url: "/api/v1/technician/me/jobs",
      params: {
        page: query.page ?? 0,
        size: query.size ?? 20,
        status: query.status,
      },
    });
  },

  job(id: number) {
    return requestData<JobDetail>({
      method: "GET",
      url: `/api/v1/technician/me/jobs/${id}`,
    });
  },

  parts(query: { q?: string; page?: number; size?: number } = {}) {
    return requestData<any>({ method: "GET", url: "/api/v1/parts", params: { q: query.q, page: query.page ?? 0, size: query.size ?? 50 } }).then(pageItems);
  },
  partCategories() { return requestData<any[]>({ method: "GET", url: "/api/v1/parts/categories" }); },
  partRequests(query: { page?: number; size?: number } = {}) { return requestData<any>({ method: "GET", url: "/api/v1/technician/me/part-requests", params: { page: query.page ?? 0, size: query.size ?? 50 } }).then(pageItems); },
  submitPartRequest(data: unknown) { return requestData<any>({ method: "POST", url: "/api/v1/technician/me/part-requests", data }); },
  cancelPartRequest(id: number) { return requestData<any>({ method: "POST", url: `/api/v1/technician/me/part-requests/${id}/cancel` }); },

  acceptAssignment(id: number, assignmentId: number) { return requestData<JobDetail>({ method: "POST", url: `/api/v1/service-requests/${id}/assignments/${assignmentId}/accept` }); },

  transition(id: number, toStatus: RequestStatus, notes?: string, startLatitude?: number, startLongitude?: number) {
    return requestData<JobDetail>({
      method: "POST",
      url: `/api/v1/service-requests/${id}/status`,
      data: { toStatus, notes, startLatitude, startLongitude },
    });
  },

  saveReport(id: number, input: ReportInput) {
    return requestData<ReportView>({
      method: "POST",
      url: `/api/v1/technician/me/jobs/${id}/report`,
      data: input,
    });
  },

  visits(query: VisitsQuery = {}) {
    return requestData<PageView<VisitView>>({
      method: "GET",
      url: "/api/v1/technician/me/visits",
      params: { page: query.page ?? 0, size: query.size ?? 20, ...query },
    });
  },

  visit(id: number) {
    return requestData<VisitView>({
      method: "GET",
      url: `/api/v1/technician/me/visits/${id}`,
    });
  },

  updateVisitStatus(
    id: number,
    status: Extract<VisitStatus, "IN_PROGRESS" | "COMPLETED">,
    notes?: string,
  ) {
    return requestData<VisitView>({
      method: "PUT",
      url: `/api/v1/technician/me/visits/${id}/status`,
      data: { status, notes },
    });
  },

  cancelVisit(id: number, reason: string) {
    return requestData<VisitView>({
      method: "POST",
      url: `/api/v1/technician/me/visits/${id}/cancel`,
      data: { reason },
    });
  },

  requestReschedule(id: number, input: ChangeRequestInput) {
    return requestData<VisitChangeRequestView>({
      method: "POST",
      url: `/api/v1/technician/me/visits/${id}/reschedule-requests`,
      data: input,
    });
  },

  requestAdditionalVisit(id: number, input: ChangeRequestInput) {
    return requestData<VisitChangeRequestView>({
      method: "POST",
      url: `/api/v1/technician/me/visits/${id}/additional-visit-requests`,
      data: input,
    });
  },

  attachments(requestId: number) {
    return requestData<AttachmentView[]>({
      method: "GET",
      url: `/api/v1/service-requests/${requestId}/attachments`,
    });
  },

  attachmentUrl(requestId: number, attachmentId: number) {
    return `${environment.apiBaseUrl}/api/v1/service-requests/${requestId}/attachments/${attachmentId}`;
  },

  async uploadAttachment(requestId: number, file: UploadFile) {
    const data = await attachmentForm(file);
    return requestData<AttachmentView>({
      method: "POST",
      url: `/api/v1/service-requests/${requestId}/attachments`,
      data,
      headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
    });
  },

  deleteAttachment(requestId: number, attachmentId: number) {
    return requestData<null>({
      method: "DELETE",
      url: `/api/v1/service-requests/${requestId}/attachments/${attachmentId}`,
    });
  },

  checklist(requestId: number) {
    return requestData<JobChecklistView | null>({
      method: "GET",
      url: `/api/v1/technician/me/jobs/${requestId}/checklist`,
    });
  },

  saveChecklist(
    requestId: number,
    responses: { itemId: number; checked?: boolean; valueText?: string }[],
  ) {
    return requestData<JobChecklistView>({
      method: "PUT",
      url: `/api/v1/technician/me/jobs/${requestId}/checklist/responses`,
      data: { responses },
    });
  },

  requestCompletionOtp(requestId: number) {
    return requestData<CompletionOtpState>({
      method: "POST",
      url: `/api/v1/technician/me/jobs/${requestId}/completion-otp/request`,
      data: {},
    });
  },

  verifyCompletionOtp(requestId: number, otpId: number, otp: string) {
    return requestData<CompletionOtpState>({
      method: "POST",
      url: `/api/v1/technician/me/jobs/${requestId}/completion-otp/verify`,
      data: { otpId, otp },
    });
  },

  requestArrivalOtp(requestId: number) {
    return requestData<ArrivalOtpState>({
      method: "POST",
      url: `/api/v1/technician/me/jobs/${requestId}/arrival-otp/request`,
      data: {},
    });
  },

  verifyArrivalOtp(requestId: number, otpId: number, otp: string) {
    return requestData<ArrivalOtpState>({
      method: "POST",
      url: `/api/v1/technician/me/jobs/${requestId}/arrival-otp/verify`,
      data: { otpId, otp },
    });
  },

  arrivalOtp(requestId: number) {
    return requestData<ArrivalOtpState | null>({
      method: "GET",
      url: `/api/v1/service-requests/${requestId}/arrival-otp`,
    });
  },

  servicePayment(requestId: number) {
    return requestData<TechnicianServicePayment>({
      method: "GET",
      url: `/api/v1/technician/me/jobs/${requestId}/payment`,
    });
  },

  verifyCashPayment(input: { paymentId: number; otpId: number; otp: string }) {
    return requestData<{ id: number; paymentId: number; status: string }>({
      method: "POST",
      url: "/api/v1/payments/cash/otp/verify",
      data: input,
    });
  },

  privateAttachments() {
    return requestData<PrivateAttachmentView[]>({
      method: "GET",
      url: "/api/v1/technician/me/private-attachments",
    });
  },

  privateAttachmentUrl(id: number) {
    return `${environment.apiBaseUrl}/api/v1/technician/me/private-attachments/${id}`;
  },

  async uploadPrivateAttachment(file: UploadFile) {
    const data = await attachmentForm(file);
    return requestData<PrivateAttachmentView>({
      method: "POST",
      url: "/api/v1/technician/me/private-attachments",
      data,
      headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
    });
  },

  deletePrivateAttachment(id: number) {
    return requestData<null>({
      method: "DELETE",
      url: `/api/v1/technician/me/private-attachments/${id}`,
    });
  },

  notifications(page = 0, status?: string) {
    return requestData<PageView<NotificationView>>({
      method: "GET",
      url: "/api/v1/notifications",
      params: { page, size: 20, status },
    });
  },

  markNotificationRead(id: number) {
    return requestData<NotificationView>({
      method: "PUT",
      url: `/api/v1/notifications/${id}/read`,
    });
  },
};
