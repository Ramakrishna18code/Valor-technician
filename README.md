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
