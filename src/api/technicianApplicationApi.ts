import { environment } from "../config/environment";

export type TechnicianApplicationDocument = {
  id: number;
  documentType: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  createdAt?: string;
};

export type TechnicianApplication = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  experience?: string | null;
  specialization?: string | null;
  liftBrands?: string | null;
  certifications?: string | null;
  highestQualification?: string | null;
  handsOnExperience?: string | null;
  preferredLocations?: string | null;
  willingToWorkAtHeights?: boolean | null;
  travelAvailability?: string | null;
  additionalNotes?: string | null;
  aadhaarNumber?: string | null;
  drivingLicenseNumber?: string | null;
  status:
    | "DRAFT"
    | "OTP_VERIFIED"
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | string;
  otpVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents: TechnicianApplicationDocument[];
};

type Envelope<T> = { data: T; message?: string; success?: boolean };
const base = () => environment.apiBaseUrl;

async function call<T>(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };
  const isMultipart =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isMultipart && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(`${base()}${url}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "Valor request timed out. Check the backend URL and network.",
      );
    throw new Error(
      "Unable to reach Valor. Check the backend URL and network connection.",
    );
  } finally {
    clearTimeout(timeout);
  }
  const payload = (await response.json().catch(() => ({}))) as Envelope<T> & {
    message?: string;
  };
  if (!response.ok || payload.success === false)
    throw new Error(payload.message || "Valor request failed.");
  return payload.data;
}

export const technicianApplicationApi = {
  create(input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) {
    return call<{
      application: TechnicianApplication;
      applicationToken: string;
    }>("/api/v1/technician-applications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  sendOtp(id: number, token: string) {
    return call<{
      applicationId: number;
      expiresAt: string;
      developmentOnly: boolean;
      otp?: string;
    }>(`/api/v1/technician-applications/${id}/otp/send`, {
      method: "POST",
      headers: { "X-Application-Token": token },
    });
  },
  verifyOtp(id: number, token: string, otp: string) {
    return call<TechnicianApplication>(
      `/api/v1/technician-applications/${id}/otp/verify`,
      {
        method: "POST",
        headers: { "X-Application-Token": token },
        body: JSON.stringify({ otp }),
      },
    );
  },
  update(id: number, token: string, input: Record<string, unknown>) {
    return call<TechnicianApplication>(
      `/api/v1/technician-applications/${id}`,
      {
        method: "PUT",
        headers: { "X-Application-Token": token },
        body: JSON.stringify(input),
      },
    );
  },
  uploadDocument(
    id: number,
    token: string,
    documentType: string,
    file: { uri: string; name: string; type: string },
  ) {
    const data = new FormData();
    data.append("documentType", documentType);
    data.append("file", file as unknown as Blob);
    return call<TechnicianApplicationDocument>(
      `/api/v1/technician-applications/${id}/documents`,
      { method: "POST", headers: { "X-Application-Token": token }, body: data },
    );
  },
  read(id: number, token: string) {
    return call<TechnicianApplication>(
      `/api/v1/technician-applications/${id}`,
      { headers: { "X-Application-Token": token } },
    );
  },
  submit(id: number, token: string) {
    return call<TechnicianApplication>(
      `/api/v1/technician-applications/${id}/submit`,
      { method: "POST", headers: { "X-Application-Token": token } },
    );
  },
};
