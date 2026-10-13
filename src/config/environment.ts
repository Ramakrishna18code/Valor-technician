import { Platform } from "react-native";

const configuredApiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "";
const isDevelopment = process.env.NODE_ENV === "development";
if (!configuredApiBase && !isDevelopment) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL must be configured for non-development builds.");
}
if (configuredApiBase.startsWith("http://") && !isDevelopment) {
  throw new Error("Non-development builds require an HTTPS API URL.");
}

// Local web previews reach this PC directly, even after its Wi-Fi IP changes.
const localBrowser = isDevelopment && Platform.OS === "web" && typeof window !== "undefined"
  && ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localApi = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?(\/|$)/.test(configuredApiBase);
export const environment = {
  apiBaseUrl: localBrowser && (!configuredApiBase || localApi) ? "http://localhost:8081" : configuredApiBase,
  websocketUrl: '',
};
