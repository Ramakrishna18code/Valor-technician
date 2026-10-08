const { expo } = require("./app.json");
module.exports = () => ({ ...expo, plugins: [...(expo.plugins || []), ["expo-build-properties", { android: { usesCleartextTraffic: process.env.EXPO_PUBLIC_API_BASE_URL?.startsWith("http://") === true } }]] });
