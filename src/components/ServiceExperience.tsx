import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
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
    const animation = Animated.timing(progress, { toValue: 1, duration: 550, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); };
  }, [enabled, delay, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>{children}</Animated.View>;
}

export function ServiceSection({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <View style={s.section}><Text style={s.sectionNumber}>{number}</Text><View style={s.flex}><Text style={s.sectionTitle}>{title}</Text><Text style={s.sectionSubtitle}>{subtitle}</Text></View><View style={s.sectionLine} /></View>;
}

export function ServiceHero({ status, jobId, building, service }: { status: string; jobId: string; building: string; service: string }) {
  const enabled = useMotionEnabled();
  const pulse = useRef(new Animated.Value(0)).current;
  const testing = status === "TESTING";
  const stage = testing ? 3 : 2;
  const journeySteps: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
    { title: "Assigned", icon: "clipboard-outline" },
    { title: "On the way", icon: "navigate-outline" },
    { title: "On site", icon: "location-outline" },
    { title: "Testing", icon: "shield-checkmark-outline" },
  ];
  useEffect(() => {
    if (!enabled) { pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [enabled, pulse]);
  const statusText = status.toLowerCase().replace(/_/g, " ");
  return <LinearGradient colors={["#061E3D", "#082A55", "#154779"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
    <View pointerEvents="none" style={s.orbitOne} /><View pointerEvents="none" style={s.orbitTwo} />
    <View style={s.heroTop}><View style={s.brand}><Ionicons name="shield-checkmark-outline" color="#A9CCFF" size={16} /><Text style={s.eyebrow}>VALOR SERVICE</Text></View><View style={s.status}><Animated.View style={[s.statusDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) }]} /><Text style={s.statusText}>{statusText}</Text></View></View>
    <View style={s.heroMain}>
      <View style={s.heroCopy}><Text style={s.title}>{testing ? "The final\nchecks." : "Great service.\nEvery detail."}</Text><Text style={s.description}>{testing ? "Verify your work and get ready to hand over." : "Your site, your checklist, your next step. All in one place."}</Text></View>
      <View style={s.emblem}>
        <Animated.View style={[s.pulseRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.12] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }]} />
        <View style={s.emblemInner}><Ionicons name={testing ? "checkmark-done-outline" : "construct-outline"} size={32} color="#FFFFFF" /></View>
        <View style={s.emblemBadge}><Ionicons name="flash" size={14} color="#082A55" /></View>
      </View>
    </View>
    <View style={s.site}><Text style={s.siteLabel}>{service}</Text><Text style={s.siteTitle}>{building}</Text><Text selectable style={s.jobId}>Job ID · {jobId}</Text></View>
    <View style={s.journey}>
      <View style={s.journeyHeader}><Text style={s.journeyTitle}>SERVICE JOURNEY</Text><Text style={s.journeyCaption}>Stage {stage + 1} of 4</Text></View>
      <View style={s.journeySummary}><Text style={s.journeyCurrentTitle}>{testing ? "Final verification" : "Service underway"}</Text><Text style={s.journeyCurrentDetail}>{testing ? "Complete testing before closing the job." : "You're on site. Keep each service detail up to date."}</Text></View>
      <View style={s.segments} accessible accessibilityLabel={`Service journey, stage ${stage + 1} of 4: ${journeySteps[stage].title}`}>
        {journeySteps.map((step, index) => <View key={step.title} style={[s.segment, index < stage && s.segmentDone, index === stage && s.segmentCurrent]}>
          {index === stage && <Animated.View style={[s.segmentGlow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.65] }) }]} />}
        </View>)}
      </View>
      <View style={s.steps}>{journeySteps.map((step, index) => {
        const current = index === stage;
        const done = index < stage;
        return <View key={step.title} accessible accessibilityLabel={`${step.title}: ${done ? "Complete" : current ? "Current stage" : "Upcoming"}`} style={s.step}>
            <View style={[s.stepDot, done && s.stepDone, current && s.stepCurrent]}>
              <Ionicons name={done ? "checkmark" : step.icon} size={16} color={current ? "#FFFFFF" : done ? "#A9EDCF" : "#9EB4CE"} />
            </View>
          <Text style={[s.stepLabel, current && s.stepLabelCurrent]}>{step.title}</Text>
        </View>;
      })}</View>
    </View>
  </LinearGradient>;
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  hero: { borderRadius: 28, padding: 24, overflow: "hidden", gap: 24 },
  orbitOne: { position: "absolute", width: 270, height: 270, borderRadius: 135, borderWidth: 1, borderColor: "#FFFFFF12", right: -110, top: 10 },
  orbitTwo: { position: "absolute", width: 360, height: 360, borderRadius: 180, borderWidth: 1, borderColor: "#FFFFFF0C", right: -155, top: -35 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, fontWeight: "700", color: "#B8D4F8" },
  status: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFFFFF14", borderWidth: 1, borderColor: "#FFFFFF20", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#80E5BF" },
  statusText: { fontSize: 11, lineHeight: 16, color: "#D3F9EB", textTransform: "capitalize", fontWeight: "600" },
  heroMain: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 20 },
  heroCopy: { flex: 1, minWidth: 155, gap: 12 },
  title: { fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: "#FFFFFF", fontWeight: "700" },
  description: { color: "#BACCE3", fontSize: 13, lineHeight: 21 },
  emblem: { width: 76, height: 76, alignItems: "center", justifyContent: "center", margin: 6 },
  pulseRing: { position: "absolute", width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: "#7AB3FF" },
  emblemInner: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#246DE3", borderWidth: 1, borderColor: "#72ABFF", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  emblemBadge: { position: "absolute", right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: "#A9EDCF", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#123C68" },
  site: { padding: 16, borderRadius: 18, backgroundColor: "#FFFFFF0D", borderWidth: 1, borderColor: "#FFFFFF18", gap: 6 },
  siteLabel: { color: "#9BBDE9", fontSize: 11, lineHeight: 17, fontWeight: "500" },
  siteTitle: { color: "#FFFFFF", fontSize: 18, lineHeight: 26, fontWeight: "600" },
  jobId: { color: "#B7CBE5", fontSize: 11, lineHeight: 18 },
  journey: { gap: 16, paddingTop: 4 },
  journeyHeader: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  journeyTitle: { color: "#B7CBE5", fontSize: 10, letterSpacing: 1.2, fontWeight: "600" },
  journeyCaption: { color: "#A9EDCF", fontSize: 11, fontWeight: "600" },
  journeySummary: { gap: 5 },
  journeyCurrentTitle: { color: "#FFFFFF", fontSize: 19, lineHeight: 27, fontWeight: "600" },
  journeyCurrentDetail: { color: "#B7CBE5", fontSize: 12, lineHeight: 19 },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 5, borderRadius: 999, backgroundColor: "#385777", overflow: "hidden" },
  segmentDone: { backgroundColor: "#94DFC1" },
  segmentCurrent: { backgroundColor: "#559BFF" },
  segmentGlow: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#D9EBFF" },
  steps: { flexDirection: "row", gap: 6 },
  step: { flex: 1, minWidth: 0, alignItems: "center", gap: 7 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF0A", alignItems: "center", justifyContent: "center" },
  stepDone: { backgroundColor: "#A9EDCF14" },
  stepCurrent: { backgroundColor: "#246DE3" },
  stepLabel: { color: "#C9D8EB", fontSize: 11, lineHeight: 17, fontWeight: "500", textAlign: "center" },
  stepLabelCurrent: { color: "#FFFFFF", fontWeight: "700" },
  section: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 4 },
  sectionNumber: { fontSize: 12, fontWeight: "700", color: "#246DE3", backgroundColor: "#EAF2FF", padding: 10, borderRadius: 12 },
  sectionTitle: { color: "#082A55", fontSize: 18, lineHeight: 26, fontWeight: "700" },
  sectionSubtitle: { color: "#66758A", fontSize: 12, lineHeight: 19 },
  sectionLine: { width: 28, height: 2, backgroundColor: "#DDE5EF" },
});
