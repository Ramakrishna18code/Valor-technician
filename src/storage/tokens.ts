import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'valor.technician.tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function parseTokens(value: string | null): StoredTokens | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as StoredTokens;
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function getStoredValue() {
  if (Platform.OS === 'web') {
    return globalThis.sessionStorage?.getItem(KEY) ?? null;
  }
  return SecureStore.getItemAsync(KEY);
}

async function setStoredValue(value: string) {
  if (Platform.OS === 'web') {
    globalThis.sessionStorage?.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

async function deleteStoredValue() {
  if (Platform.OS === 'web') {
    globalThis.sessionStorage?.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

export const tokenStorage = {
  async getTokens(): Promise<StoredTokens | null> {
    const parsed = parseTokens(await getStoredValue());
    if (!parsed) {
      await this.clear();
      return null;
    }
    return parsed;
  },

  async getAccessToken(): Promise<string | null> {
    return (await this.getTokens())?.accessToken ?? null;
  },

  async getRefreshToken(): Promise<string | null> {
    return (await this.getTokens())?.refreshToken ?? null;
  },

  async saveTokens(tokens: StoredTokens): Promise<void> {
    await setStoredValue(JSON.stringify(tokens));
  },

  async clear(): Promise<void> {
    await deleteStoredValue();
  },
};
