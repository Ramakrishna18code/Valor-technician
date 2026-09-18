import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {environment} from '../config/environment';
import {tokenStorage} from '../storage/tokens';

const TASK_NAME = 'valor-technician-background-location';
let activeRequestId: number | null = null;

TaskManager.defineTask(TASK_NAME, async ({data, error}) => {
  if (error || !activeRequestId) return;
  const locations = (data as {locations?: Location.LocationObject[]})?.locations ?? [];
  const latest = locations[locations.length - 1];
  if (!latest) return;
  const token = await tokenStorage.getAccessToken();
  if (!token) return;
  await fetch(`${environment.apiBaseUrl}/api/v1/technician/me/jobs/${activeRequestId}/location`, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      timestamp: new Date(latest.timestamp).toISOString(),
    }),
  }).catch(() => undefined);
});

export async function ensureBackgroundTracking(requestId: number) {
  activeRequestId = requestId;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return {started: false, state: 'FOREGROUND_DENIED'};
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return {started: false, state: 'BACKGROUND_DENIED'};
  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (!running) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000,
      distanceInterval: 100,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Valor tracking active',
        notificationBody: 'Location is shared only for your active assigned job.',
      },
    });
  }
  return {started: true, state: running ? 'RUNNING' : 'STARTED'};
}

export async function stopBackgroundTracking() {
  activeRequestId = null;
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}
