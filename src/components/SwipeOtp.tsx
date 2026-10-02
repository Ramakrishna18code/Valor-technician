import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

/** The handle starts on the right; only a completed leftward drag submits. */
export default function SwipeOtp({ onRequest, resend = false, onContinue }: { onRequest: () => Promise<void>; resend?: boolean; onContinue?: () => void }) {
  const offset = useRef(new Animated.Value(0)).current;
  const travel = useRef(0);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(resend);
  const success = useRef(new Animated.Value(resend ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(success, { toValue: sent ? 1 : 0, duration: reduceMotion ? 0 : 350, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [sent, success, reduceMotion]);
  const reset = () => Animated.spring(offset, { toValue: 0, useNativeDriver: true, overshootClamping: true }).start();
  const submit = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await onRequest();
      offset.setValue(-travel.current);
      setSent(true);
    } catch {
      setError(sent ? "Could not resend OTP. Try again." : "Could not send OTP. Swipe again.");
      if (!sent) reset();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !sent && !locked.current && travel.current > 0,
    onMoveShouldSetPanResponder: (_, gesture) => !sent && !locked.current && gesture.dx < -5 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => offset.setValue(Math.max(-travel.current, Math.min(0, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (travel.current > 0 && gesture.dx <= -travel.current * 0.85) {
        offset.setValue(-travel.current);
        void submit();
      } else reset();
    },
    onPanResponderTerminate: reset,
    onPanResponderTerminationRequest: () => false,
  });
  return <View style={s.container}>
    <View style={[s.track, sent && s.trackSent]} onLayout={event => { travel.current = Math.max(0, event.nativeEvent.layout.width - 68); if (sent || locked.current) offset.setValue(-travel.current); }}
      accessible accessibilityRole={sent ? "text" : "button"} accessibilityLabel={sent ? "OTP sent" : "Generate arrival OTP"}
      accessibilityHint={sent ? "Use the button below to continue." : "Swipe the handle from right to left, or activate to request the code."}
      accessibilityState={{ disabled: busy || sent, busy }} accessibilityActions={sent ? [] : [{ name: "activate", label: "Generate OTP" }]}
      onAccessibilityAction={event => { if (!sent && event.nativeEvent.actionName === "activate") void submit(); }}>
      <LinearGradient pointerEvents="none" colors={["#082A55", "#174D83"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fill} />
      <Animated.View pointerEvents="none" style={[s.fill, { opacity: success }]}><LinearGradient colors={["#E2F5EA", "#F0FAF4"]} style={s.fill} /></Animated.View>
      <View pointerEvents="none" style={s.copy}>
        <Text accessibilityLiveRegion="polite" style={[s.label, sent && s.labelSent]}>{busy ? "Sending code…" : sent ? "Code sent" : "Slide to send code"}</Text>
        <Text style={[s.hint, sent && s.hintSent]}>{sent ? "Ready to verify" : "Swipe right to left"}</Text>
      </View>
      {sent && <Animated.View pointerEvents="none" style={[s.sentMark, { opacity: success, transform: [{ scale: success.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}><Ionicons name="checkmark-circle" size={24} color="#168A4A" /></Animated.View>}
      <Animated.View {...pan.panHandlers} style={[s.handle, sent && s.handleSent, { transform: [{ translateX: offset }] }]}>
        {busy ? <ActivityIndicator color="#082A55" /> : <Ionicons name="arrow-back" size={24} color={sent ? "#168A4A" : "#082A55"} />}
      </Animated.View>
    </View>
    {sent && <Pressable accessibilityRole="button" disabled={busy} onPress={onContinue || (() => void submit())} style={({ pressed }) => [s.continueButton, busy && s.resendDisabled, pressed && s.pressed]}>
      <View style={s.continueIcon}><Ionicons name={onContinue ? "shield-checkmark-outline" : "refresh-outline"} size={20} color="#FFFFFF" /></View>
      <Text style={s.continueText}>{onContinue ? "Verify customer code" : busy ? "Resending…" : "Resend OTP"}</Text>
      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
    </Pressable>}
    {!!error && <Text accessibilityLiveRegion="polite" style={[s.feedback, s.error]}>{error}</Text>}
  </View>;
}

const s = StyleSheet.create({
  container: { gap: 12 },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  track: { minHeight: 68, borderRadius: 999, backgroundColor: "#082A55", borderWidth: 1, borderColor: "#234C7D", justifyContent: "center", overflow: "hidden" },
  copy: { alignItems: "center", justifyContent: "center", paddingHorizontal: 62, paddingVertical: 14, gap: 3 },
  label: { flexShrink: 1, color: "#FFFFFF", fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  labelSent: { color: "#126A3B" },
  hint: { color: "#B7CDE8", fontSize: 10, lineHeight: 15, textAlign: "center" },
  hintSent: { color: "#42745A" },
  sentMark: { position: "absolute", right: 20, top: 21 },
  handle: { position: "absolute", right: 7, top: 7, width: 52, height: 52, borderRadius: 26, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" },
  feedback: { fontSize: 12, lineHeight: 19 },
  error: { color: "#D64545" },
  trackSent: { backgroundColor: "#E2F5EA", borderColor: "#B9DFC9" },
  handleSent: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C5E6D3" },
  continueButton: { minHeight: 58, borderRadius: 999, backgroundColor: "#082A55", paddingVertical: 10, paddingLeft: 12, paddingRight: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  continueIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF14", alignItems: "center", justifyContent: "center" },
  continueText: { flex: 1, color: "#FFFFFF", fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  pressed: { opacity: 0.85 },
  resendDisabled: { opacity: 0.5 },
});
