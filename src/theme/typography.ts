import { Platform } from "react-native";

const systemFont = Platform?.OS === "web" ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : Platform?.OS === "ios" ? "System" : "sans-serif";
export const fontFamily = { regular: systemFont, medium: systemFont, semiBold: systemFont, bold: systemFont, extraBold: systemFont } as const;
export const fontWeight = { regular: "400", medium: "500", semiBold: "600", bold: "700", extraBold: "700" } as const;
export const fontSize = { screenTitle: 24, heroTitle: 24, sectionHeading: 20, cardTitle: 16, body: 14, secondary: 12, small: 12, button: 14, input: 14, navigation: 12, caption: 10, largeNumber: 24 } as const;
export const lineHeight = { body: 22, secondary: 18, heading: 32 } as const;

/** Shared text roles. Keep text independent of decorative layout scaling. */
export const typographyStyles = {
  screenTitle: { fontFamily: systemFont, fontSize: 24, lineHeight: 32, fontWeight: "700" },
  sectionHeading: { fontFamily: systemFont, fontSize: 20, lineHeight: 28, fontWeight: "600" },
  cardTitle: { fontFamily: systemFont, fontSize: 16, lineHeight: 24, fontWeight: "600" },
  body: { fontFamily: systemFont, fontSize: 14, lineHeight: 22, fontWeight: "400" },
  customerName: { fontFamily: systemFont, fontSize: 14, lineHeight: 22, fontWeight: "500" },
  secondary: { fontFamily: systemFont, fontSize: 12, lineHeight: 18, fontWeight: "400" },
  caption: { fontFamily: systemFont, fontSize: 10, lineHeight: 16, fontWeight: "400" },
  button: { fontFamily: systemFont, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  input: { fontFamily: systemFont, fontSize: 14, lineHeight: 22, fontWeight: "400" },
  navigation: { fontFamily: systemFont, fontSize: 12, lineHeight: 18, fontWeight: "500" },
} as const;
