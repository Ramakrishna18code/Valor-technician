import {api, ApiError, unwrapEnvelope} from '../src/api/client';
import {technicianApi} from '../src/api/technicianApi';
import {tokenStorage} from '../src/storage/tokens';

jest.mock('../src/config/environment', () => ({
  environment: {apiBaseUrl: 'http://10.0.2.2:8081', websocketUrl: ''},
}));

jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
}));

const store = {accessToken: 'access-token', refreshToken: 'refresh-token'};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => (
    store.accessToken && store.refreshToken
      ? JSON.stringify(store)
      : null
  )),
  setItemAsync: jest.fn(async (_key: string, value: string) => {
    Object.assign(store, JSON.parse(value));
  }),
  deleteItemAsync: jest.fn(async () => {
    store.accessToken = '';
    store.refreshToken = '';
  }),
}));

const ok = <T,>(data: T, status = 200) => ({success: true, message: 'ok', data, status});
const fail = (message: string, status = 400) => ({success: false, message, data: null, status});

type CapturedCall = {method?: string; url?: string; data?: unknown; params?: unknown; headers?: unknown};

function captureApi(responseFactory: (call: CapturedCall) => unknown = () => ({})) {
  const calls: CapturedCall[] = [];
  api.defaults.adapter = async config => {
    const call = {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params,
      headers: config.headers,
    };
    calls.push(call);
    return {
      data: ok(responseFactory(call)),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  return calls;
}

function rejectApi(message: string, status = 422) {
  api.defaults.adapter = async config => {
    throw {
      config,
      response: {
        data: fail(message, status),
        status,
        statusText: 'Rejected',
        headers: {},
        config,
      },
      isAxiosError: true,
    };
  };
}

describe('canonical technician API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.accessToken = 'access-token';
    store.refreshToken = 'refresh-token';
  });

  it('unwraps canonical envelopes and rejects malformed or failed responses', () => {
    expect(unwrapEnvelope(ok({value: 1}))).toEqual({value: 1});
    expect(() => unwrapEnvelope({value: 1})).toThrow('Unexpected response from Valor.');
    expect(() => unwrapEnvelope(fail('Nope', 403))).toThrow('Nope');
  });

  it('logs in through the technician route and stores both tokens', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ok({accessToken: 'a2', refreshToken: 'r2', role: 'TECHNICIAN', userId: 1}),
    })) as jest.Mock;

    await technicianApi.login({email: ' tech@valor.local ', password: 'secret'});

    expect(global.fetch).toHaveBeenCalledWith('http://10.0.2.2:8081/api/v1/auth/login/technician', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({email: 'tech@valor.local', password: 'secret'}),
    }));
    expect(store).toEqual({accessToken: 'a2', refreshToken: 'r2'});
  });

  it('rejects invalid login and non-technician roles', async () => {
    global.fetch = jest.fn(async () => ({json: async () => fail('Bad credentials', 401)})) as jest.Mock;
    await expect(technicianApi.login({email: 'tech@valor.local', password: 'bad'})).rejects.toThrow('Bad credentials');

    global.fetch = jest.fn(async () => ({
      json: async () => ok({accessToken: 'admin', refreshToken: 'refresh', role: 'ADMIN', userId: 2}),
    })) as jest.Mock;
    await expect(technicianApi.login({email: 'admin@valor.local', password: 'secret'})).rejects.toThrow('Technician app');
  });

  it('restores and clears session tokens through secure storage', async () => {
    expect(await tokenStorage.getTokens()).toEqual({accessToken: 'access-token', refreshToken: 'refresh-token'});
    await tokenStorage.saveTokens({accessToken: 'new-access', refreshToken: 'new-refresh'});
    expect(await tokenStorage.getAccessToken()).toBe('new-access');
    expect(await tokenStorage.getRefreshToken()).toBe('new-refresh');
    await tokenStorage.clear();
    expect(await tokenStorage.getTokens()).toBeNull();
  });

  it('loads dashboard, profile and availability through canonical endpoints', async () => {
    const calls = captureApi(call => call.url?.includes('/dashboard')
      ? {assignedJobs: 0, pendingJobs: 0, inProgressJobs: 0, completedJobs: 0, completedThisQuarter: 0, todaysScheduledVisits: 0, emergencyJobs: 0, profile: {availabilityStatus: 'AVAILABLE'}}
      : {availabilityStatus: 'AVAILABLE'});

    await technicianApi.dashboard();
    await technicianApi.profile();
    await technicianApi.updateAvailability('BUSY');

    expect(calls.map(call => `${call.method?.toUpperCase()} ${call.url}`)).toEqual([
      'GET /api/v1/technician/me/dashboard',
      'GET /api/v1/technician/me/profile',
      'PUT /api/v1/technician/me/profile',
    ]);
    expect(JSON.parse(calls[2].data as string)).toEqual({availabilityStatus: 'BUSY'});
  });

  it('loads jobs with canonical paging/filtering and job detail mapping', async () => {
    const calls = captureApi(call => call.url?.endsWith('/42')
      ? {request: {id: 42, priority: 'HIGH', status: 'ASSIGNED', serviceType: 'BREAKDOWN'}, history: []}
      : {items: [], page: 0, size: 20, totalElements: 0, totalPages: 0});

    await technicianApi.jobs({status: 'ASSIGNED', page: 2, size: 10});
    await technicianApi.job(42);

    expect(calls[0]).toMatchObject({method: 'get', url: '/api/v1/technician/me/jobs', params: {page: 2, size: 10, status: 'ASSIGNED'}});
    expect(calls[1]).toMatchObject({method: 'get', url: '/api/v1/technician/me/jobs/42'});
  });

  it('submits lifecycle transitions, cancellation notes and backend rejection errors', async () => {
    const calls = captureApi(() => ({request: {id: 42, status: 'ON_THE_WAY'}, history: []}));
    await technicianApi.transition(42, 'ON_THE_WAY', 'Travel started');
    expect(calls[0]).toMatchObject({method: 'post', url: '/api/v1/service-requests/42/status'});
    expect(JSON.parse(calls[0].data as string)).toEqual({toStatus: 'ON_THE_WAY', notes: 'Travel started'});

    rejectApi('Invalid transition', 409);
    await expect(technicianApi.transition(42, 'COMPLETED')).rejects.toMatchObject(new ApiError('Invalid transition', 409));
  });

  it('uses canonical visit detail, status, cancellation and change-request endpoints', async () => {
    const calls = captureApi(() => ({id: 9, status: 'SCHEDULED'}));

    await technicianApi.visits({status: 'SCHEDULED'});
    await technicianApi.visit(9);
    await technicianApi.updateVisitStatus(9, 'IN_PROGRESS', 'Started');
    await technicianApi.cancelVisit(9, 'Cannot attend');
    await technicianApi.requestReschedule(9, {reason: 'Traffic', requestedDate: '2026-09-20', requestedStartTime: '10:00', requestedEndTime: '11:00'});
    await technicianApi.requestAdditionalVisit(9, {reason: 'Needs parts', requestedDate: '2026-09-21', requestedStartTime: '12:00', requestedEndTime: '13:00'});

    expect(calls.map(call => `${call.method?.toUpperCase()} ${call.url}`)).toEqual([
      'GET /api/v1/technician/me/visits',
      'GET /api/v1/technician/me/visits/9',
      'PUT /api/v1/technician/me/visits/9/status',
      'POST /api/v1/technician/me/visits/9/cancel',
      'POST /api/v1/technician/me/visits/9/reschedule-requests',
      'POST /api/v1/technician/me/visits/9/additional-visit-requests',
    ]);
    expect(JSON.parse(calls[3].data as string)).toEqual({reason: 'Cannot attend'});
  });

  it('saves structured service reports through the assigned job endpoint', async () => {
    const calls = captureApi(() => ({id: 1, serviceRequestId: 42}));

    await technicianApi.saveReport(42, {
      diagnosis: 'Controller fault',
      workPerformed: 'Reset controller',
      testingResult: 'Passed',
      completionNotes: 'Customer informed',
    });

    expect(calls[0]).toMatchObject({method: 'post', url: '/api/v1/technician/me/jobs/42/report'});
    expect(JSON.parse(calls[0].data as string)).toEqual({
      diagnosis: 'Controller fault',
      workPerformed: 'Reset controller',
      testingResult: 'Passed',
      completionNotes: 'Customer informed',
    });
  });

  it('lists, uploads and deletes request-scoped attachments', async () => {
    const calls = captureApi(() => []);

    await technicianApi.attachments(42);
    await technicianApi.uploadAttachment(42, {uri: 'file:///photo.jpg', name: 'photo.jpg', type: 'image/jpeg'});
    await technicianApi.deleteAttachment(42, 7);

    expect(calls.map(call => `${call.method?.toUpperCase()} ${call.url}`)).toEqual([
      'GET /api/v1/service-requests/42/attachments',
      'POST /api/v1/service-requests/42/attachments',
      'DELETE /api/v1/service-requests/42/attachments/7',
    ]);
    expect(String(calls[1].headers)).toContain('multipart/form-data');
    expect(technicianApi.attachmentUrl(42, 7)).toBe('http://10.0.2.2:8081/api/v1/service-requests/42/attachments/7');
  });

  it('loads notifications and marks unread items read', async () => {
    const calls = captureApi(() => ({items: [], page: 0, size: 20, totalElements: 0, totalPages: 0}));

    await technicianApi.notifications(1, 'PENDING');
    await technicianApi.markNotificationRead(4);

    expect(calls[0]).toMatchObject({method: 'get', url: '/api/v1/notifications', params: {page: 1, size: 20, status: 'PENDING'}});
    expect(calls[1]).toMatchObject({method: 'put', url: '/api/v1/notifications/4/read'});
  });

  it('logs out through the canonical refresh-token route and clears local credentials', async () => {
    const calls = captureApi(() => null);

    await technicianApi.logout();

    expect(calls[0]).toMatchObject({method: 'post', url: '/api/v1/auth/logout'});
    expect(JSON.parse(calls[0].data as string)).toEqual({refreshToken: 'refresh-token'});
    expect(await tokenStorage.getTokens()).toBeNull();
  });
});
