const { expo } = require("./app.json");
module.exports = () => ({ ...expo, plugins: [...(expo.plugins || []), ["react-native-maps", {
  androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || "",
  iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY || "",
}]] });
