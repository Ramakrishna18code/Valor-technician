import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { typographyStyles } from "../theme/typography";

export const COMPANY_NAME = "Valor Elevators Pvt Ltd";
/** Original transparent company artwork, kept at its supplied aspect ratio. */
export default function BrandLogo({ width = 150, compact = false, showCompanyName = false }: { width?: number; compact?: boolean; showCompanyName?: boolean }) {
  return <View style={[styles.brand, { width }]}>
    <Image source={require("../../assets/valor-company-logo.png")} resizeMode="contain" style={{ width, height: width * 322 / 775 }} accessibilityLabel={COMPANY_NAME + " logo"} />
    {showCompanyName && !compact && <Text style={styles.company}>{COMPANY_NAME}</Text>}
  </View>;
}
const styles = StyleSheet.create({ brand: { alignItems: "center", flexShrink: 1 }, company: { ...typographyStyles.caption, color: "#5D6F86", textAlign: "center", marginTop: 3 } });
