import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { typographyStyles as type } from "../theme/typography";
const steps = ["Basic details", "Phone verification", "Professional details", "Documents", "Review"];
export default function ApplicationProgress({ step }: { step: number }) {
  const [reduced, setReduced] = useState(true);
  const progress = useRef(new Animated.Value(0)).current, pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => { let active = true; AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {}); const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced); return () => { active = false; listener.remove(); }; }, []);
  useEffect(() => { const target = (step - 1) / 4; if (reduced) progress.setValue(target); else { const animation = Animated.timing(progress, { toValue: target, duration: 420, useNativeDriver: false }); animation.start(); return () => animation.stop(); } }, [step, reduced, progress]);
  useEffect(() => { pulse.setValue(1); if (reduced) return; const animation = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1.07, duration: 900, useNativeDriver: Platform.OS !== "web" }), Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" })])); animation.start(); return () => animation.stop(); }, [step, reduced, pulse]);
  return <View style={s.card}>
    <View style={s.heading}><Text style={s.title}>Your application</Text><Text accessibilityLiveRegion="polite" style={s.counter}>Step {step} of 5</Text></View>
    <View style={s.track}>
      <View pointerEvents="none" style={s.line}><Animated.View style={{ height: "100%", overflow: "hidden", borderRadius: 4, width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}><LinearGradient colors={["#55BFA7", "#246DE3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /></Animated.View></View>
      {steps.map((label, i) => { const done = i + 1 < step, current = i + 1 === step; return <View key={label} style={s.step} accessible accessibilityLabel={label + (done ? ": complete" : current ? ": current step" : ": upcoming")}>
        <Animated.View style={[s.circle, done && s.done, current && s.current, current && { transform: [{ scale: pulse }] }]}>{done ? <Ionicons name="checkmark" size={21} color="#FFFFFF" /> : <Text style={[s.number, current && s.white]}>{i + 1}</Text>}</Animated.View>
        <Text style={[s.label, current && s.currentLabel]}>{label}</Text>
      </View>; })}
    </View>
  </View>;
}
const s = StyleSheet.create({ card: { marginHorizontal: 12, marginBottom: 14, backgroundColor: "#F1F6FE", borderRadius: 22, padding: 12, borderWidth: 1, borderColor: "#DDE9F8" }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }, title: { ...type.cardTitle, color: "#163958" }, counter: { ...type.secondary, backgroundColor: "#E1ECFC", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, color: "#246DE3" }, track: { flexDirection: "row", position: "relative" }, line: { position: "absolute", height: 6, top: 15, left: "10%", right: "10%", backgroundColor: "#DBE6F4", borderRadius: 4 }, step: { flex: 1, alignItems: "center", gap: 9 }, circle: { height: 36, width: 36, borderRadius: 18, backgroundColor: "#E6EDF7", borderWidth: 3, borderColor: "#F1F6FE", alignItems: "center", justifyContent: "center" }, current: { backgroundColor: "#246DE3", borderColor: "#CDDFFC", shadowColor: "#246DE3", shadowOpacity: .2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, done: { backgroundColor: "#29A786" }, number: { ...type.body, color: "#68829C" }, white: { color: "#FFFFFF" }, label: { ...type.caption, textAlign: "center", color: "#71879E" }, currentLabel: { color: "#246DE3" } });
