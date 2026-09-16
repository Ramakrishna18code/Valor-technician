import axios, {AxiosError, AxiosRequestConfig} from 'axios';
import {environment} from '../config/environment';
import {tokenStorage} from '../storage/tokens';
import type {ApiEnvelope, Authentication} from '../types/technician';

type SessionExpiredHandler = () => void;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message || 'Valor request failed.');
    this.status = status;
  }
}

export const api = axios.create({
  baseURL: environment.apiBaseUrl,
  timeout: 20_000,
});

let onSessionExpired: SessionExpiredHandler | undefined;
let refreshPromise: Promise<string | null> | null = null;

export function setSessionExpiredHandler(handler?: SessionExpiredHandler) {
  onSessionExpired = handler;
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return !!value && typeof value === 'object' && 'success' in value && 'status' in value;
}

function errorFromEnvelope(data: unknown, fallbackStatus?: number) {
  if (isEnvelope<null>(data)) {
    return new ApiError(data.message, data.status ?? fallbackStatus ?? 0);
  }
  return new ApiError('Valor request failed.', fallbackStatus ?? 0);
}

export function unwrapEnvelope<T>(payload: unknown): T {
  if (!isEnvelope<T>(payload)) {
    throw new ApiError('Unexpected response from Valor.');
  }
  if (!payload.success) {
    throw new ApiError(payload.message, payload.status);
  }
  return payload.data;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        return null;
      }
      try {
        const response = await axios.post(`${environment.apiBaseUrl}/api/v1/auth/refresh`, {refreshToken});
        const auth = unwrapEnvelope<Authentication>(response.data);
        if (auth.role !== 'TECHNICIAN') {
          throw new ApiError('This account cannot use the Technician app.', 403);
        }
        await tokenStorage.saveTokens({accessToken: auth.accessToken, refreshToken: auth.refreshToken});
        return auth.accessToken;
      } catch {
        await tokenStorage.clear();
        onSessionExpired?.();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

api.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & {_retry?: boolean}) | undefined;
    const status = error.response?.status ?? 0;
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = {...original.headers, Authorization: `Bearer ${token}`};
        return api.request(original);
      }
    }
    if (error.response) {
      throw errorFromEnvelope(error.response.data, status);
    }
    throw new ApiError('Unable to reach Valor. Check your network connection.', 0);
  },
);

export async function requestData<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request(config);
  return unwrapEnvelope<T>(response.data);
}
