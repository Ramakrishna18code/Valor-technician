import BrandLogo from "../components/BrandLogo";
import { typographyStyles as appTypography } from "../theme/typography";
import React from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function WelcomeScreen({ onGetStarted, onSignIn }: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  const { width } = useWindowDimensions();
  const scale = Math.min(width, 508) / 508;
  const s = makeStyles(scale);

  return (
    <View style={s.screen}>
      <View style={s.frame}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LinearGradient colors={["#EAF2FF", "#F8FBFF", "#FFF5E6"]} style={StyleSheet.absoluteFill} />
          <View style={s.topCircle} />
          <View style={s.bottomCircle} />
        </View>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <View style={{ marginBottom: 20 }}><BrandLogo width={170} showCompanyName /></View>
            <View style={s.portrait}>
              <Image source={require("../../assets/valor-field-technician.png")} style={s.illustration} resizeMode="contain" accessibilityLabel="Valor service technician in a navy and gold uniform holding a wrench and diagnostic tablet" />
            </View>
            <Text style={s.title}>Welcome, Technician</Text>
            <Text style={s.subtitle}>Your jobs, service visits, and daily work.{"\n"}All in one place.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onGetStarted} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
            <LinearGradient colors={["#082A55", "#246DE3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.fill}>
              <Text style={s.primaryText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <View style={s.divider}><View style={s.line} /><Text style={s.or}>Or</Text><View style={s.line} /></View>
          <Pressable disabled accessibilityRole="button" accessibilityLabel="Continue with Google, coming soon" accessibilityState={{ disabled: true }} style={s.social}>
            <View style={s.googleFrame}><Image source={require("../../assets/google-logo.png")} style={s.google} /></View>
            <Text style={s.socialText}>Continue with Google</Text>
          </Pressable>
          <Pressable disabled accessibilityRole="button" accessibilityLabel="Continue with Apple, coming soon" accessibilityState={{ disabled: true }} style={s.social}>
            <Ionicons name="logo-apple" size={32 * scale} color="#102033" />
            <Text style={s.socialText}>Continue with Apple</Text>
          </Pressable>
          <Text style={s.availability}>Google and Apple sign-in coming soon</Text>
          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account?</Text>
            <Pressable accessibilityRole="button" onPress={onSignIn} hitSlop={12}><Text style={s.link}>Sign In</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const serif = Platform.select({ ios: "Georgia", android: "serif", default: "'Times New Roman', serif" });
const makeStyles = (r: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#EDF3FB" },
  frame: { flex: 1, width: "100%", maxWidth: 508, alignSelf: "center", overflow: "hidden" },
  topCircle: { position: "absolute", width: 416 * r, height: 416 * r, borderRadius: 208 * r, top: -208 * r, right: -214 * r, backgroundColor: "#DCE9FF", opacity: 0.65 },
  bottomCircle: { position: "absolute", width: 360 * r, height: 360 * r, borderRadius: 180 * r, bottom: -160 * r, left: -202 * r, backgroundColor: "#FBE7BF", opacity: 0.45 },
  content: { flexGrow: 1, paddingHorizontal: 32 * r, paddingTop: 16 * r, paddingBottom: 10 * r },
  hero: { alignItems: "center", marginBottom: 42 * r },
  portrait: { width: 208 * r, height: 208 * r, borderRadius: 104 * r, backgroundColor: "#EAF2FF", overflow: "hidden", marginBottom: 34 * r },
  illustration: { width: 208 * r, height: 208 * r },
  title: { ...appTypography.screenTitle, color: "#102033", textAlign: "center" },
  subtitle: { ...appTypography.body, color: "#667A98", textAlign: "center", marginTop: 14 * r },
  primary: { borderRadius: 25, overflow: "hidden", width: "100%", maxWidth: 320, alignSelf: "center" },
  fill: { minHeight: 50, flexDirection: "row", gap: 14 * r, justifyContent: "center", alignItems: "center" },
  primaryText: { ...appTypography.button, color: "#FFFFFF" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  divider: { flexDirection: "row", alignItems: "center", gap: 20 * r, height: 54 },
  line: { flex: 1, height: 1, backgroundColor: "#E8EEF5" },
  or: { ...appTypography.body, color: "#667A98" },
  social: { minHeight: 48, borderRadius: 38 * r, borderWidth: 1, borderColor: "#D7E1EE", backgroundColor: "#F0F5FB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 * r, marginBottom: 16 * r },
  socialText: { ...appTypography.button, color: "#102033" },
  googleFrame: { width: 36 * r, height: 36 * r, overflow: "hidden" },
  google: { position: "absolute", width: 166 * r, height: 93.5 * r, left: -65.9 * r, top: -29.1 * r },
  availability: { ...appTypography.secondary, color: "#667A98", textAlign: "center" },
  footer: { flexGrow: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "center", gap: 6 * r, paddingTop: 24 },
  footerText: { ...appTypography.secondary, color: "#667A98" },
  link: { ...appTypography.button, color: "#246DE3" },
});
