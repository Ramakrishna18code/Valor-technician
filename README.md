# Valor Technician App

The Technician app is developed with Expo for Expo Go and Expo Web. It uses the canonical Valor Backend under `/api/v1`; the source of truth is:

```text
D:\RKKKK\Valor-Backend\BACKEND_API_CONTRACT.md
```

Legacy `/api/technician` routes, the Java backend source in this repository, and any generated bare React Native Android scaffold are not the runtime path for this app.

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

The app uses real backend data only. It does not use fake jobs, fake notifications, or legacy Technician API success states.

## Phase 1B Foreground Location Tracking

The app uses `expo-location` to request foreground location permission when an active assigned job is open in a trackable state (`ON_THE_WAY` through `TESTING`). It sends the latest latitude, longitude, and timestamp to:

```text
POST /api/v1/technician/me/jobs/{id}/location
```

Tracking stops when the job leaves the active state or the technician leaves the active job context. This is not background tracking, and it has not been device/emulator GPS verified in this checkpoint.

Phase 1B.1 note: local Android device/emulator verification was blocked because
`adb` and emulator tooling were unavailable in the current environment. The
foreground tracking implementation passed TypeScript, Jest, and web export
checks, but real coordinates reaching MySQL through a device/emulator remain
unverified.
