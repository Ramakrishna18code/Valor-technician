# Valor Technician App

The Technician app is developed with Expo SDK 57 for Expo Go and Expo Web. It
uses the canonical Valor Backend under `/api/v1`; the source of truth is:

```text
D:\RKKKK\Valor-Backend\BACKEND_API_CONTRACT.md
```

Legacy `/api/technician` routes, the Java backend source in this repository,
and any generated bare React Native Android scaffold are not the runtime path
for this app.

## Local Setup

Start the canonical backend on port `8081`, then configure the Technician app:

```powershell
cd D:\RKKKK\Valor-technician
npm install
Copy-Item .env.example .env
```

Choose the backend URL for your target:

```env
# Expo Web on the same PC
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8081

# Expo Go on Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8081

# Expo Go on a physical device
EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_LAN_IP:8081
```

Do not commit `.env`, real LAN IPs, tokens, or credentials.

## Run With Expo

```powershell
npm start
```

From the Expo CLI:

- Press `w` for Expo Web.
- Scan the QR code with Expo Go for device testing.

Direct web command:

```powershell
npm run web
```

Web export validation:

```powershell
npm run export:web
```

## Validation

```powershell
npm test -- --runInBand
npm run typecheck
npm run export:web
```

The app uses real backend data only. It does not use fake jobs, fake
notifications, fake GPS coordinates, or legacy Technician API success states.

## Active Modules

- Technician login, `/me`, refresh, logout, role rejection, and expired-session
  handling
- Dashboard summary from `/api/v1/technician/me/dashboard`
- Jobs list/detail/history through canonical service-request assignment data
- Canonical job lifecycle actions: `ACCEPTED`, `ON_THE_WAY`, `REACHED_SITE`,
  `DIAGNOSIS`, `REPAIR_IN_PROGRESS`, `WAITING_FOR_PARTS`, `TESTING`,
  `COMPLETED`, and `CANCELLED`
- Structured technician report submission; PDF generation remains a backend
  report-download capability, not a Technician app feature
- Request-scoped attachments: JPEG, PNG, WebP, and PDF upload/list/download and
  authorized delete
- Technician visit list/detail/status, cancellation, reschedule requests, and
  additional-visit requests. Reschedule/additional requests wait for Admin
  approval; the Technician app does not directly create approved visits.
- Notifications list and read state using the shared notification inbox
- Technician profile read and availability update
- Foreground latest-location submission for active trackable jobs

Availability values are exactly `AVAILABLE`, `BUSY`, `OFF_DUTY`, and
`ON_LEAVE`.

## Foreground Location Tracking

The app uses `expo-location` to request foreground location permission when an
active assigned job is open in a trackable state (`ON_THE_WAY` through
`TESTING`). It sends the latest latitude, longitude, and timestamp about every
five minutes to:

```text
POST /api/v1/technician/me/jobs/{id}/location
```

Tracking stops when the job leaves the active state or the technician leaves the active job context. This is not background tracking, and it has not been device/emulator GPS verified in this checkpoint.

The backend resolves technician identity from the JWT; the client does not send
or trust a technician ID in the location payload. This is not background
tracking and does not include Firebase, routing, ETA, geofencing, or route
history.

## Expo Go Status

The active native modules are Expo-managed modules: `expo-location`,
`expo-secure-store`, `expo-image-picker`, and `expo-document-picker`. No active
dependency requires a custom development build for the current feature set.
Expo Go should be compatible after setting `EXPO_PUBLIC_API_BASE_URL` for the
target device or emulator.

Device/emulator validation was not performed in this phase. Real GPS behavior,
camera/gallery permission flows, and physical file picker behavior must still be
accepted manually in Expo Go by the tester.

## Phase 15 advanced operations

The Technician app now consumes backend-driven job checklists, completion OTP
state, expanded profile fields, and technician-private attachments.

- Job detail renders the assigned checklist from
  `/api/v1/technician/me/jobs/{id}/checklist`, saves partial progress, resumes
  saved responses, marks required items, and keeps completion disabled until the
  backend reports the checklist complete.
- Completion OTP is requested and verified through the backend. The app only
  displays safe delivery/verification state; it never receives or stores the OTP
  value.
- Profile editing is limited to permitted operational/profile fields:
  availability, profile photo URL, date of birth, gender, address, and emergency
  contact details. Email, phone, employee ID, assignment area, specialization,
  and active state remain read-only in the Technician app.
- Technician-private attachments are shown in a separate private area using the
  `/api/v1/technician/me/private-attachments` routes. They are distinct from
  customer-visible request attachments.

## Phase 16 advanced live tracking

The Technician app keeps automatic active-job tracking and adds Expo background
location support for development/production builds. Tracking starts only for a
trackable assigned job, avoids starting duplicate background tasks, submits the
same backend `/api/v1/technician/me/jobs/{id}/location` payload, and stops when
the job is no longer trackable.

The job detail screen shows foreground permission state, last submitted
location, background task state, and backend/geofence errors where applicable.
Expo Go cannot prove background location behavior; real device validation in a
development or production build is still required.

## Phase 17 communication foundation

The Technician app includes shared communication channel/status/preference types
for the backend communication foundation. No Technician workflow or UI was
changed for Phase 17, and no Email/SMS/WhatsApp provider activation was added.
## Phase 18 Email System Notes

Technician email notifications are backend-driven through the shared communication system for account onboarding, assignments, job status changes, visit scheduling/rescheduling, and change-request decisions.

The technician app does not send email directly and does not configure an external email provider. Safe onboarding uses the backend `/api/v1/auth/set-password` flow; raw passwords and set-password secrets must never be logged or shown outside that flow.

## Phases 19-21 Communication Notes

Technician SMS and WhatsApp notifications are backend-driven through the shared communication architecture for assignments, job updates, visit changes, and system notifications. The app should not call MSG91 or WhatsApp providers directly.

Technician communication preferences are backend-owned. Do not store a separate local preference source for SMS, WhatsApp, email, job, visit, or system notification categories.

## Phase 22 communication automation

Technician communications for assignment/reassignment, job status, visit scheduling/rescheduling, and supported system events are generated by backend communication automation. The Technician app should keep using canonical `/api/v1` job and visit data; it must not call provider APIs directly or maintain separate communication delivery state.
