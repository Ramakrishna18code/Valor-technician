export type Role = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'SUPER_ADMIN';

export type RequestStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'ON_THE_WAY'
  | 'REACHED_SITE'
  | 'DIAGNOSIS'
  | 'REPAIR_IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'TESTING'
  | 'COMPLETED'
  | 'CANCELLED';

export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type ServiceType = 'ROUTINE_MAINTENANCE' | 'BREAKDOWN' | 'EMERGENCY' | 'INSPECTION' | 'INSTALLATION' | 'MODERNIZATION';
export type AssignmentStatus = 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'RELEASED' | 'COMPLETED';
export type VisitStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFF_DUTY' | 'ON_LEAVE';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
  status: number;
}

export interface PageView<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TechnicianSummary {
  id: number;
  employeeId?: string | null;
  assignedArea?: string | null;
  specialization?: string | null;
  availabilityStatus: AvailabilityStatus;
  active: boolean;
}

export interface Authentication {
  accessToken: string;
  refreshToken: string;
  role: Role;
  userId: number;
  technicianProfile?: TechnicianSummary | null;
}

export interface CurrentUser {
  userId: number;
  role: Role;
  email?: string | null;
  phone?: string | null;
  technicianProfile?: TechnicianSummary | null;
}

export interface TechnicianProfileView {
  userId: number;
  technicianProfileId: number;
  email?: string | null;
  phone?: string | null;
  employeeId?: string | null;
  assignedArea?: string | null;
  specialization?: string | null;
  availabilityStatus: AvailabilityStatus;
  active: boolean;
  lastActiveAt?: string | null;
  updatedAt?: string | null;
  profilePhotoUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface TechnicianDashboard {
  profile: TechnicianProfileView;
  assignedJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  completedThisQuarter: number;
  todaysScheduledVisits: number;
  emergencyJobs: number;
}

export interface RequestView {
  id: number;
  serviceId?: string | null;
  customerProfileId?: number | null;
  liftId?: number | null;
  title?: string | null;
  description?: string | null;
  issueCategory?: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  serviceType: ServiceType;
  customerRemarks?: string | null;
  preferredVisitDate?: string | null;
  preferredTimeSlot?: string | null;
  estimatedCompletionMinutes?: number | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface AssignmentView {
  id: number;
  serviceRequestId: number;
  technicianProfileId: number;
  status: AssignmentStatus;
  assignedByUserId?: number | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  releasedAt?: string | null;
  notes?: string | null;
}

export interface HistoryView {
  id: number;
  fromStatus?: RequestStatus | null;
  toStatus: RequestStatus;
  changedByUserId?: number | null;
  notes?: string | null;
  changedAt?: string | null;
}

export interface ReportView {
  id: number;
  serviceRequestId: number;
  assignmentId?: number | null;
  diagnosis?: string | null;
  workPerformed?: string | null;
  testingResult?: string | null;
  completionNotes?: string | null;
  reportedByUserId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface JobDetail {
  request: RequestView;
  activeAssignment?: AssignmentView | null;
  history: HistoryView[];
  report?: ReportView | null;
}

export interface LocationView {
  latitude: number;
  longitude: number;
  timestamp: string;
  stale: boolean;
  trackingState: string;
}

export interface VisitView {
  id: number;
  serviceRequestId: number;
  serviceId?: string | null;
  title?: string | null;
  customerProfileId?: number | null;
  liftId?: number | null;
  technicianProfileId?: number | null;
  technicianEmployeeId?: string | null;
  technicianSpecialization?: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  status: VisitStatus;
  notes?: string | null;
  serviceType?: ServiceType | string | null;
  priority?: RequestPriority | string | null;
  history?: unknown[];
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface VisitChangeRequestView {
  id: number;
  visitId: number;
  type: 'RESCHEDULE' | 'ADDITIONAL_VISIT' | string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  reason: string;
  requestedDate?: string | null;
  requestedStartTime?: string | null;
  requestedEndTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AttachmentView {
  id: number;
  serviceRequestId: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedByUserId: number;
  createdAt?: string | null;
}

export interface PrivateAttachmentView {
  id: number;
  technicianProfileId: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedByUserId: number;
  createdAt?: string | null;
}

export type ChecklistInputType = 'CHECKBOX' | 'TEXT' | 'NUMBER' | 'PHOTO_NOTE';
export interface ChecklistItemView {
  id: number;
  templateId: number;
  label: string;
  description?: string | null;
  required: boolean;
  sortOrder: number;
  inputType: ChecklistInputType;
}
export interface ChecklistResponseView {
  itemId: number;
  checked?: boolean | null;
  valueText?: string | null;
  technicianProfileId?: number | null;
  respondedAt?: string | null;
}
export interface JobChecklistView {
  id: number;
  serviceRequestId: number;
  serviceVisitId?: number | null;
  templateId: number;
  templateName: string;
  templateVersion: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  requiredTotal: number;
  requiredCompleted: number;
  items: ChecklistItemView[];
  responses: ChecklistResponseView[];
  updatedAt?: string | null;
}
export interface CompletionOtpState {
  id: number;
  serviceRequestId: number;
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'LOCKED' | string;
  expiresAt?: string | null;
  attemptsRemaining: number;
  lockedUntil?: string | null;
  verifiedAt?: string | null;
}

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP';
export type CommunicationDeliveryStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export interface CommunicationPreference {
  userId: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
}

export interface NotificationView {
  id: number;
  recipientUserId: number;
  title: string;
  message: string;
  channel: 'IN_APP' | string;
  status: NotificationStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}
