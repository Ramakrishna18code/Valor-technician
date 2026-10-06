import { typographyStyles as appTypography } from "../theme/typography";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

function useMotionEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => { if (mounted) setEnabled(!reduced); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => setEnabled(!reduced));
    return () => { mounted = false; listener.remove(); };
  }, []);
  return enabled;
}

export function ServiceReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const enabled = useMotionEnabled();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 280, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => { animation.stop(); };
  }, [enabled, delay, progress]);
  return <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

export function ServiceSection({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <View style={s.section}><Text style={s.sectionNumber}>{number}</Text><View style={s.flex}><Text style={s.sectionTitle}>{title}</Text><Text style={s.sectionSubtitle}>{subtitle}</Text></View><View style={s.sectionLine} /></View>;
}

export function ServiceHero({ status, jobId, building, service, arrivalVerified = false }: { status: string; jobId: string; building: string; service: string; arrivalVerified?: boolean }) {
  const enabled = useMotionEnabled();
  const pulse = useRef(new Animated.Value(0)).current;
  const testing = status === "TESTING";
  const stage = ["ASSIGNED", "ACCEPTED"].includes(status) ? 0 : status === "ON_THE_WAY" ? 1 : testing ? 4 : ["DIAGNOSIS", "REPAIR_IN_PROGRESS", "WAITING_FOR_PARTS"].includes(status) ? 3 : 2;
  const journeySteps: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
    { title: "Assigned", icon: "clipboard-outline" },
    { title: "On the way", icon: "navigate-outline" },
    { title: "On site", icon: "location-outline" },
    { title: "Working", icon: "construct-outline" },
    { title: "Testing", icon: "shield-checkmark-outline" },
  ];
  useEffect(() => {
    if (!enabled) { pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web", isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web", isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [enabled, pulse]);
  const statusText = status.toLowerCase().replace(/_/g, " ");
  return <LinearGradient colors={["#F0F8FF", "#EDF8F5", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
    <View pointerEvents="none" style={s.orbitOne} /><View pointerEvents="none" style={s.orbitTwo} />
    <View style={s.heroTop}><View style={s.brand}><Ionicons name="shield-checkmark-outline" color="#367B94" size={16} /><Text style={s.eyebrow}>SERVICE VISIT</Text></View><View style={s.status}><Animated.View style={[s.statusDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) }]} /><Text style={s.statusText}>{statusText}</Text></View></View>
    <View style={s.heroMain}>
      <View style={s.heroCopy}><Text style={s.title}>{testing ? "Final checks" : service}</Text><Text style={s.description}>{testing ? "Complete testing before handover." : status === "ASSIGNED" ? "Review the site details and accept this job." : status === "ACCEPTED" ? "Job accepted. Start travel when you are ready." : status === "ON_THE_WAY" ? "Travel to the site, then confirm your arrival." : status === "REACHED_SITE" ? (arrivalVerified ? "Arrival confirmed. You can begin diagnosis." : "Confirm your arrival, then begin diagnosis.") : status === "DIAGNOSIS" ? "Inspect the lift and record your findings." : status === "WAITING_FOR_PARTS" ? "Resume work when the required parts arrive." : "Carry out the repair before final testing."}</Text></View>
      <View style={s.emblem}><Ionicons name={testing ? "shield-checkmark-outline" : "construct-outline"} size={24} color="#2870D5" /></View>
    </View>
    <View style={s.site}><Text style={s.siteLabel}>{service}</Text><Text style={s.siteTitle}>{building}</Text><Text selectable style={s.jobId}>Job ID · {jobId}</Text></View>
    <View style={s.journey}>
      <View style={s.journeyHeader}><Text style={s.journeyTitle}>SERVICE JOURNEY</Text><Text style={s.journeyCaption}>Stage {stage + 1} of 5</Text></View>
      <View style={s.segments} accessible accessibilityLabel={`Service journey, stage ${stage + 1} of 5: ${journeySteps[stage].title}`}>
        {journeySteps.map((step, index) => <View key={step.title} style={[s.segment, index < stage && s.segmentDone, index === stage && s.segmentCurrent]}>
          {index === stage && <Animated.View style={[s.segmentGlow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.65] }) }]} />}
        </View>)}
      </View>
      <View style={s.steps}>{journeySteps.map((step, index) => {
        const current = index === stage;
        const done = index < stage;
        return <View key={step.title} accessible accessibilityLabel={`${step.title}: ${done ? "Complete" : current ? "Current stage" : "Upcoming"}`} style={s.step}>
            <View style={[s.stepDot, done && s.stepDone, current && s.stepCurrent]}>
              <Ionicons name={done ? "checkmark" : step.icon} size={16} color={current ? "#FFFFFF" : done ? "#247B70" : "#758594"} />
            </View>
          <Text style={[s.stepLabel, current && s.stepLabelCurrent]}>{step.title}</Text>
        </View>;
      })}</View>
    </View>
  </LinearGradient>;
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  hero: { borderWidth: 1, borderColor: "#DCEAE7", borderRadius: 20, padding: 16, overflow: "hidden", gap: 12 },
  orbitOne: { position: "absolute", width: 270, height: 270, borderRadius: 135, borderWidth: 1, borderColor: "#FFFFFF12", right: -110, top: 10 },
  orbitTwo: { position: "absolute", width: 360, height: 360, borderRadius: 180, borderWidth: 1, borderColor: "#FFFFFF0C", right: -155, top: -35 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { ...appTypography.caption, letterSpacing: 1.8, color: "#567287" },
  status: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#E4F3EE", borderWidth: 1, borderColor: "#CDE6DD", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#80E5BF" },
  statusText: { ...appTypography.secondary, color: "#247B70", textTransform: "capitalize" },
  heroMain: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 20 },
  heroCopy: { flex: 1, minWidth: 140, gap: 5 },
  title: { ...appTypography.screenTitle, letterSpacing: -0.3, color: "#203C49" },
  description: { ...appTypography.body, color: "#617487" },
  emblem: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#E3EDFF", alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: "#7AB3FF" },
  emblemInner: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#246DE3", borderWidth: 1, borderColor: "#72ABFF", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  emblemBadge: { position: "absolute", right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: "#A9EDCF", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#123C68" },
  site: { padding: 12, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE7EE", gap: 6 },
  siteLabel: { ...appTypography.secondary, color: "#567287" },
  siteTitle: { ...appTypography.cardTitle, color: "#203C49" },
  jobId: { ...appTypography.secondary, color: "#617487" },
  journey: { gap: 10, paddingTop: 4 },
  journeyHeader: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  journeyTitle: { ...appTypography.caption, color: "#617487", letterSpacing: 1.2 },
  journeyCaption: { ...appTypography.caption, color: "#247B70" },
  journeySummary: { gap: 5 },
  journeyCurrentTitle: { ...appTypography.cardTitle, color: "#203C49" },
  journeyCurrentDetail: { ...appTypography.body, color: "#617487" },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 5, borderRadius: 999, backgroundColor: "#DCE7EE", overflow: "hidden" },
  segmentDone: { backgroundColor: "#94DFC1" },
  segmentCurrent: { backgroundColor: "#559BFF" },
  segmentGlow: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#D9EBFF" },
  steps: { flexDirection: "row", gap: 6 },
  step: { flex: 1, minWidth: 0, alignItems: "center", gap: 7 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF0A", alignItems: "center", justifyContent: "center" },
  stepDone: { backgroundColor: "#A9EDCF14" },
  stepCurrent: { backgroundColor: "#246DE3" },
  stepLabel: { ...appTypography.caption, color: "#617487", textAlign: "center" },
  stepLabelCurrent: {  color: "#203C49" },
  section: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4, paddingBottom: 0 },
  sectionNumber: { ...appTypography.body, color: "#246DE3", backgroundColor: "#EAF2FF", padding: 10, borderRadius: 12 },
  sectionTitle: { ...appTypography.sectionHeading, color: "#082A55" },
  sectionSubtitle: { ...appTypography.secondary, color: "#66758A" },
  sectionLine: { width: 28, height: 2, backgroundColor: "#DDE5EF" },
});
