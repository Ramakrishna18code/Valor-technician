const { expo } = require("./app.json");
module.exports = () => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const isDevelopment = process.env.NODE_ENV === "development" || process.env.APP_ENV === "development";
  if (!apiBaseUrl && !isDevelopment) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be configured for non-development builds.");
  }
  if (apiBaseUrl?.startsWith("http://") && !isDevelopment) {
    throw new Error("Non-development builds require an HTTPS API URL.");
  }
  return {
    ...expo,
    plugins: [
      ...(expo.plugins || []),
      ["expo-build-properties", { android: { usesCleartextTraffic: false } }],
    ],
  };
};
