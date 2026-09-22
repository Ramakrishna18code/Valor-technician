# Valor Technician Backend Reference

Source of truth: this document is derived only from the `Valor-Backend` Java code and Flyway migrations. The active schema is the Flyway schema under `src/main/resources/db/migration`. `schema.sql` contains older/fresh-reference table names and should not be treated as the current runtime contract.

## Technician Domain Scope

The technician backend is centered on a `users` row with role `TECHNICIAN` and a one-to-one `technician_profiles` row. Technician work then connects through assignments, jobs, service visits, reports, checklists, completion OTPs, private attachments, live tracking, notifications, and communication events.

Technician job access is assignment-based. A technician can read and update only jobs or visits tied to their active `technician_profiles` row unless acting through admin endpoints.

## Core Backend Files

- Identity/staff: `src/main/java/com/valor/auth/AuthController.java`, `AuthComponents.java`, `TechnicianProfile.java`, `StaffController.java`, `DirectoryController.java`
- Technician profile/dashboard: `src/main/java/com/valor/workflow/TechnicianMeController.java`, `TechnicianDtos.java`
- Workflow/jobs/reports: `WorkflowController.java`, `WorkflowService.java`, `WorkflowDtos.java`
- Visits: `ServiceVisitController.java`, `ServiceVisitService.java`, `ServiceVisitDtos.java`
- Advanced technician operations: `Phase15Controller.java`, `ChecklistService.java`, `CompletionOtpService.java`, `TechnicianPrivateAttachmentService.java`
- Tracking: `src/main/java/com/valor/tracking/TrackingController.java`, `TrackingService.java`, tracking models/repositories
- Notifications/communication: `NotificationController.java`, `CommunicationService.java`, `EmailEventService.java`

## Identity And Profile Tables

- `users`: shared identity row. Technician rows use `role = TECHNICIAN`.
- `technician_profiles`: one row per technician user. Fields include `user_id`, `employee_id`, `assigned_area`, `specialization`, `availability_status`, `rating`, `last_working_day`, `last_active_at`, `is_active`, timestamps.
- Phase 15 profile fields: `profile_photo_url`, `date_of_birth`, `gender`, `address`, `emergency_contact_name`, `emergency_contact_phone`.
- `refresh_tokens`: refresh-token rotation state.
- `onboarding_tokens`: password setup links for admin-created technicians.

Technician availability values are `AVAILABLE`, `BUSY`, `OFF_DUTY`, and `ON_LEAVE`.

## Technician Auth And Provisioning APIs

- `POST /api/v1/auth/login/technician`: technician email/password login.
- `POST /api/v1/auth/refresh`: refresh-token rotation.
- `POST /api/v1/auth/logout`: revoke refresh token.
- `POST /api/v1/auth/set-password`: set password from onboarding token.
- `GET /api/v1/me`: current identity plus technician profile when actor is a technician.
- `POST /api/v1/admin/users`: create admin or technician staff user. For technicians, creates both `users` and `technician_profiles`.
- `DELETE /api/v1/admin/users/{userId}`: deactivate staff; technician deactivation also marks `technician_profiles.is_active = false`.
- `GET /api/v1/admin/technicians`: paged technician directory with `page`, `size`, `q`, and `active`.
- `GET /api/v1/admin/technicians/{id}`: technician profile by profile ID.
- `PUT /api/v1/admin/technicians/{id}`: admin update of technician availability, assigned area, specialization, and editable profile fields.

Staff creation is SUPER_ADMIN-only in `StaffService`. Technician fields are allowed only for role `TECHNICIAN`; admin staff cannot include technician profile fields. Unknown JSON fields are rejected by strict DTOs where implemented.

## Technician Self APIs

- `GET /api/v1/technician/me/profile`
- `PUT /api/v1/technician/me/profile`
- `GET /api/v1/technician/me/dashboard`

Editable self profile fields include availability status, profile photo URL, date of birth, gender, address, emergency contact name, and emergency contact phone. Updating the profile also refreshes `last_active_at`.

## Job And Assignment Tables

- `service_requests`: the underlying job/request raised by customer or admin.
- `technician_assignments`: links technician profiles to service requests. Tracks assignment status, assigned-by user, assigned/accepted/released timestamps, and notes.
- `service_reports`: technician-submitted work report for an assignment.
- `service_status_history`: request status transitions.
- `service_request_attachments`: shared files attached to service requests.
- `service_request_feedback`: customer feedback after completion.

## Technician Job APIs

- `GET /api/v1/technician/me/jobs`: assigned technician jobs.
- `GET /api/v1/technician/me/jobs/{id}`: assigned job detail.
- `POST /api/v1/technician/me/jobs/{id}/report`: submit service report. Required fields are `diagnosis`, `workPerformed`, and `testingResult`; `completionNotes` is optional.
- `POST /api/v1/service-requests/{id}/assignments/{assignmentId}/accept`: accept an assignment.
- `POST /api/v1/service-requests/{id}/status`: technician status updates for assigned jobs.
- `GET/POST/GET/DELETE /api/v1/service-requests/{id}/attachments...`: shared request attachments, subject to request access.
- `GET /api/v1/service-requests/{id}/completion-otp`: latest completion OTP state for a request.
- `GET /api/v1/technician/me/jobs/{id}/location`: latest technician location plus route/ETA data for the assigned job.
- `GET /api/v1/technician/me/jobs/{id}/payment`: invoice, payment, and cash-OTP state for the assigned job when an invoice exists.

Before a request can move to completion, the backend requires completed checklists and a verified completion OTP when those controls are active.

## Service Visit Tables

- `service_visits`: scheduled job visits connected to service request and technician profile.
- `visit_change_requests`: technician requests for reschedule, additional visit, or cancellation.
- `service_visit_history`: status and assignment history for visits.

## Technician Visit APIs

- `GET /api/v1/technician/me/visits`
- `GET /api/v1/technician/me/visits/{id}`
- `PUT /api/v1/technician/me/visits/{id}/status`
- `POST /api/v1/technician/me/visits/{id}/reschedule-requests`
- `POST /api/v1/technician/me/visits/{id}/additional-visit-requests`
- `POST /api/v1/technician/me/visits/{id}/cancel`

Admin review APIs for technician visit change requests:

- `GET /api/v1/admin/visit-change-requests`
- `POST /api/v1/admin/visit-change-requests/{id}/approve`
- `POST /api/v1/admin/visit-change-requests/{id}/reject`

## Checklist And Completion Tables

- `checklist_templates`: admin-managed checklist definitions.
- `checklist_template_service_types`: maps templates to workflow service types.
- `checklist_items`: ordered template questions/items; input types are `CHECKBOX`, `TEXT`, `NUMBER`, `PHOTO_NOTE`.
- `job_checklists`: per-request checklist instance, unique by `service_request_id`.
- `checklist_responses`: technician responses to checklist items.
- `completion_otps`: customer/technician-linked OTPs used to confirm completion.

## Arrival, Checklist And Completion APIs

Admin checklist template APIs:

- `GET /api/v1/admin/checklist-templates`
- `POST /api/v1/admin/checklist-templates`
- `PUT /api/v1/admin/checklist-templates/{id}`
- `POST /api/v1/admin/checklist-templates/{id}/items`
- `PUT /api/v1/admin/checklist-templates/{id}/items/{itemId}`
- `DELETE /api/v1/admin/checklist-templates/{id}/items/{itemId}`

Technician checklist APIs:

- `GET /api/v1/technician/me/jobs/{id}/checklist`
- `PUT /api/v1/technician/me/jobs/{id}/checklist/responses`

Completion OTP APIs:

- `POST /api/v1/technician/me/jobs/{id}/completion-otp/request`
- `POST /api/v1/technician/me/jobs/{id}/completion-otp/verify`
- `GET /api/v1/service-requests/{id}/completion-otp`

Arrival OTP APIs:

- `POST /api/v1/technician/me/jobs/{id}/arrival-otp/request`: creates or refreshes the customer arrival code after the job reaches `REACHED_SITE`.
- `POST /api/v1/technician/me/jobs/{id}/arrival-otp/verify`: verifies the code supplied by the customer.
- `GET /api/v1/service-requests/{id}/arrival-otp`: customer-visible state; the code is revealed only after the request reaches site.

The workflow rejects the transition from `REACHED_SITE` to `DIAGNOSIS` until arrival OTP verification has succeeded. This prevents a technician from starting work without the customer's arrival confirmation.

Checklist instances are created from an active template matching the request service type. Required checklist items must be answered before completion.

## Private Technician Attachment Tables And APIs

Table: `technician_private_attachments`, linked to `technician_profiles`.

Technician self APIs:

- `GET /api/v1/technician/me/private-attachments`
- `POST /api/v1/technician/me/private-attachments`
- `GET /api/v1/technician/me/private-attachments/{id}`
- `DELETE /api/v1/technician/me/private-attachments/{id}`

Admin technician file APIs:

- `GET /api/v1/admin/technicians/{id}/private-attachments`
- `POST /api/v1/admin/technicians/{id}/private-attachments`
- `GET /api/v1/admin/technicians/{id}/private-attachments/{attachmentId}`
- `DELETE /api/v1/admin/technicians/{id}/private-attachments/{attachmentId}`

Private attachments are profile-scoped and separate from service request attachments.

## Tracking And Geofence Tables

- `technician_latest_locations`: latest technician location for a service request; unique by `service_request_id`.
- `technician_location_history`: append-only historical location samples.
- `service_request_geofence_states`: current geofence state for a request.
- `service_request_geofence_events`: entered/exited events.
- `buildings.latitude` and `buildings.longitude`: target coordinates for geofence/routing.

## Tracking APIs

- `POST /api/v1/technician/me/jobs/{id}/location`: technician updates current coordinates for an assigned request. Payload requires valid `latitude` and `longitude`; optional fields include accuracy, speed, heading, and battery.
- `GET /api/v1/technician/me/jobs/{id}/location`: technician reads the latest location, geofence, route, and ETA for the assigned request. Route availability depends on valid building and technician coordinates and the configured routing provider.
- `GET /api/v1/customers/me/service-requests/{id}/technician-location`: customer reads latest technician location for an owned request.

The default geofence radius is configured in backend properties and falls back to 150 meters when invalid or missing.

## Notifications And Communication

- `GET /api/v1/notifications`
- `POST /api/v1/notifications`
- `PUT /api/v1/notifications/{id}/read`

Communication tables use `users.id`, not technician profile IDs:

- `communication_preferences`
- `communication_events`
- `communication_messages`
- `communication_templates`

Technician-related communication events include technician account creation, service assignment, service updates, visit updates, report notifications, and system/admin alerts.

## Payment And Cash Completion

Payment is intentionally downstream of service completion. The technician app does not create a quote or invent a payment amount. An admin creates the service invoice through the shared backend, and the customer chooses the supported payment method in the customer flow.

- `POST /api/v1/admin/service-requests/{id}/invoice`: admin creates the service invoice/quote.
- `POST /api/v1/payments/cash/otp/request`: customer requests cash confirmation for the invoice; the cash OTP is valid for five minutes.
- `POST /api/v1/payments/cash/otp/verify`: assigned technician or admin verifies the customer-provided cash OTP. Successful verification marks the payment succeeded and the invoice paid.
- `GET /api/v1/technician/me/jobs/{id}/payment`: technician reads the invoice/payment state and may see only cash OTP metadata, never the customer's code.

For cash, the technician verifies the payment OTP after the customer has selected cash and requested the code. For UPI, the gateway/webhook remains authoritative and no cash OTP is shown. Revisit or additional-visit requests continue through the visit change-request APIs and require admin review where configured.

## Job Lifecycle Used By The App

The technician UI follows the backend transition contract:

`ASSIGNED` -> `ACCEPTED` -> `ON_THE_WAY` -> `REACHED_SITE` -> `DIAGNOSIS` -> `REPAIR_IN_PROGRESS` / `WAITING_FOR_PARTS` -> `TESTING` -> `COMPLETED`.

The customer sees the service status after every successful transition. The arrival OTP is required before `DIAGNOSIS`; the completion OTP, service report, and required checklist are required before `COMPLETED`. `CANCELLED` is terminal. Visit reschedule, cancellation, and additional-visit requests are separate visit operations and do not silently change the service request to completed.

## Cross-Domain Rules

- Technician identity is `users.id`; technician work ownership is `technician_profiles.id`.
- Assignments, visits, checklists, private attachments, latest location, location history, and geofence rows use technician profile IDs.
- Communication, notifications, refresh tokens, audit actors, and onboarding tokens use user IDs.
- Technician access to a service request depends on an active assignment to the technician profile.
- Admin-created technicians should use onboarding/set-password flow where possible; raw passwords must not be exposed.
- Customer completion flows cross technician and customer domains through `service_requests`, `completion_otps`, checklist completion, and customer-visible technician tracking.

## Technician Self-Registration Contract (V30)

The technician Expo app uses `Valor-Backend` for registration as well as signed-in work. The technician repository must not run or introduce a second backend.

### Application lifecycle

`DRAFT` -> `OTP_VERIFIED` -> `SUBMITTED` -> `UNDER_REVIEW` -> `APPROVED` or `REJECTED`.

Approval provisions the shared `users` and `technician_profiles` rows with role `TECHNICIAN`. An applicant cannot use technician login until an administrator approves the application.

### Anonymous application APIs

- `POST /api/v1/technician-applications` creates a draft from `fullName`, `email`, `phone`, and `password`. The response returns `application` and an opaque `applicationToken`; the token is held only by the client during onboarding.
- `POST /api/v1/technician-applications/{id}/otp/send` with `X-Application-Token` sends the mobile OTP. Development/test responses may expose the OTP; production delivery must be supplied by the configured provider.
- `POST /api/v1/technician-applications/{id}/otp/verify` with `X-Application-Token` and `{ "otp": "123456" }` marks the application `OTP_VERIFIED`.
- `PUT /api/v1/technician-applications/{id}` saves professional details: `experience`, `specialization`, `liftBrands`, `certifications`, `highestQualification`, `handsOnExperience`, `preferredLocations`, `willingToWorkAtHeights`, `travelAvailability`, and `additionalNotes`.
- `POST /api/v1/technician-applications/{id}/documents` accepts multipart `documentType` and `file` with `X-Application-Token`. Supported types are `PROFILE_PHOTO`, `AADHAAR_CARD`, `DRIVING_LICENSE`, `EDUCATIONAL_CERTIFICATE`, `EXPERIENCE_CERTIFICATE`, `TECHNICAL_CERTIFICATION`, `ADDRESS_PROOF`, and `MEDICAL_FITNESS_CERTIFICATE`. Supported formats are JPG, PNG, and PDF up to 5 MB per file.
- `GET /api/v1/technician-applications/{id}` reads the applicant's current status and uploaded document metadata with `X-Application-Token`.
- `POST /api/v1/technician-applications/{id}/submit` validates OTP, professional details, and at least one document, then moves the application to `SUBMITTED`.

### Admin review APIs

- `GET /api/v1/admin/technician-applications?page=0&size=20` lists applications newest first.
- `PUT /api/v1/admin/technician-applications/{id}/status` with `{ "status": "UNDER_REVIEW" | "APPROVED" | "REJECTED" }` records review state. `APPROVED` creates the shared technician login/profile.

### Client screen mapping

- Basic Details creates the application.
- Verify Your Mobile Number sends and verifies the application OTP.
- Professional Details updates the application.
- Upload Documents uploads real files to the shared backend.
- Review & Submit calls the submit endpoint.
- Registration Submitted and Document Verification read the backend application status; the Approved screen is shown only when the backend returns `APPROVED`.

`Valor-technician/src/main` and its generated `target` contents are legacy artifacts and are not used by the Expo client. Runtime API ownership remains exclusively in `Valor-Backend`.
