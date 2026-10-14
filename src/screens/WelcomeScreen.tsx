import BrandLogo from "../components/BrandLogo";
import WelcomeServiceScene from "../components/WelcomeServiceScene";
import { ServiceReveal } from "../components/ServiceExperience";
import { typographyStyles as t } from "../theme/typography";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function WelcomeScreen({ onGetStarted, onSignIn }: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.5;
  const graphicWidth = Math.min(300, width - 72);
  return <LinearGradient colors={["#EAF0F8", "#F6F8FC", "#EAF3F0"]} style={s.screen}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={[s.layout, wide && s.wide]}>
        <View style={[s.intro, wide && s.introWide]}>
          <BrandLogo width={150} showCompanyName />
          <ServiceReveal><View style={s.artPanel}>
            <View style={s.eyebrow}><View style={s.eyebrowDot} /><Text style={s.eyebrowText}>VALOR TECHNICIAN</Text></View>
            <WelcomeServiceScene width={graphicWidth} />
            <View style={s.features}>
              <View style={s.feature}><Ionicons name="construct-outline" size={16} color="#5F7BA7" /><Text style={s.featureText}>Service</Text></View>
              <View style={s.feature}><Ionicons name="calendar-outline" size={16} color="#8A75A5" /><Text style={s.featureText}>Schedule</Text></View>
              <View style={s.feature}><Ionicons name="shield-checkmark-outline" size={16} color="#4F8A7B" /><Text style={s.featureText}>Safety</Text></View>
            </View>
          </View></ServiceReveal>
        </View>
        <View style={[s.actions, wide && s.actionsWide]}>
          <ServiceReveal delay={80}>
            <Text style={s.title}>Welcome, Technician</Text>
            <Text style={s.tagline}>Keep every lift moving.</Text>
            <Text style={s.description}>Your jobs, site visits and service updates, together in one place.</Text>
          </ServiceReveal>
          <View style={s.buttons}>
            <Pressable accessibilityRole="button" accessibilityLabel="Get Started" onPress={onGetStarted} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
              <LinearGradient colors={["#5474A3", "#4F838B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.fill}>
                <Text style={s.primaryText}>Get Started</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Sign In" onPress={onSignIn} style={({ pressed }) => [s.signIn, pressed && s.pressed]}>
              <Ionicons name="log-in-outline" size={20} color="#506F96" /><Text style={s.signInText}>Sign In</Text>
            </Pressable>
          </View>
          <View style={s.divider}><View style={s.line} /><Text style={s.or}>More ways to connect</Text><View style={s.line} /></View>
          <View style={s.socialRow}>
            <Pressable disabled accessibilityRole="button" accessibilityLabel="Continue with Google, coming soon" accessibilityState={{ disabled: true }} style={s.social}>
              <View style={s.googleFrame}><Image source={require("../../assets/google-logo.png")} style={s.google} /></View><Text style={s.socialText}>Google</Text>
            </Pressable>
            <Pressable disabled accessibilityRole="button" accessibilityLabel="Continue with Apple, coming soon" accessibilityState={{ disabled: true }} style={s.social}>
              <Ionicons name="logo-apple" size={23} color="#617086" /><Text style={s.socialText}>Apple</Text>
            </Pressable>
          </View>
          <Text style={s.availability}>Google and Apple sign-in coming soon</Text>
        </View>
      </View>
      <View style={s.footer}><Ionicons name="business-outline" size={14} color="#64828F" /><Text style={s.footerText}>Built for your work in the field.</Text></View>
    </ScrollView>
  </LinearGradient>;
}
const s = StyleSheet.create({
  screen: { flex: 1 }, scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 22 },
  layout: { width: "100%", maxWidth: 440, gap: 22 }, wide: { maxWidth: 1000, flexDirection: "row", alignItems: "center", gap: 56 },
  intro: { alignItems: "center", gap: 20 }, introWide: { flex: 1 },
  artPanel: { alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#D5E1ED", borderRadius: 28, backgroundColor: "#F4F8FCB8", gap: 6 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 }, eyebrowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#729F94" }, eyebrowText: { ...t.caption, letterSpacing: 1.5, color: "#5D7995" },
  features: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, paddingVertical: 5 }, feature: { flexDirection: "row", alignItems: "center", gap: 4 }, featureText: { ...t.caption, color: "#5C7089" },
  actions: { gap: 12 }, actionsWide: { flex: 1, maxWidth: 390 }, title: { ...t.screenTitle, color: "#29476A", textAlign: "center" }, tagline: { ...t.cardTitle, color: "#5C8290", textAlign: "center", marginTop: 6 }, description: { ...t.body, color: "#60738A", textAlign: "center", marginTop: 8 },
  buttons: { gap: 10, marginTop: 5 }, primary: { borderRadius: 16, overflow: "hidden" }, fill: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 12 }, primaryText: { ...t.button, color: "#FFFFFF" },
  signIn: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#BBCDDC", backgroundColor: "#FFFFFFB8", borderRadius: 16, padding: 10 }, signInText: { ...t.button, color: "#506F96" }, pressed: { opacity: 0.82 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }, line: { flex: 1, height: 1, backgroundColor: "#D5E0E9" }, or: { ...t.caption, color: "#687C90" },
  socialRow: { flexDirection: "row", gap: 10 }, social: { flex: 1, flexDirection: "row", flexWrap: "wrap", minHeight: 44, alignItems: "center", justifyContent: "center", gap: 8, padding: 8, borderWidth: 1, borderColor: "#D8E2EB", backgroundColor: "#F5F8FB", borderRadius: 14 }, socialText: { ...t.secondary, color: "#65758A" },
  googleFrame: { width: 22, height: 22, overflow: "hidden" }, google: { position: "absolute", width: 101.4, height: 57.1, left: -40.3, top: -17.8 },
  availability: { ...t.caption, color: "#687C90", textAlign: "center" }, footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }, footerText: { ...t.caption, color: "#64828F" },
});
