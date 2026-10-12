import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CalendarGraphic() {
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      animation?.stop(); motion.setValue(0);
      if (reduced || !live) return;
      const step = (toValue: number) => Animated.timing(motion, { toValue, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web", isInteraction: false });
      animation = Animated.loop(Animated.sequence([step(1), step(0)]), { iterations: 2 });
      animation.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => { live = false; animation?.stop(); listener.remove(); };
  }, [motion]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.scene}>
    <View style={s.orbit} />
    <Animated.View style={[s.page, { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }) }, { rotate: "-7deg" }] }]}>
      <View style={s.top}><View style={s.ring} /><View style={s.ring} /></View>
      <View style={s.grid}>{Array.from({ length: 9 }, (_, i) => <View key={i} style={[s.day, i === 4 && s.selected]}>{i === 4 && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}</View>)}</View>
    </Animated.View>
    <View style={s.clock}><Ionicons name="time-outline" size={21} color="#516FA0" /></View>
    <View style={s.spark} />
  </View>;
}
const s = StyleSheet.create({
  scene: { width: 94, height: 102, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  orbit: { position: "absolute", width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: "#FFFFFF36", backgroundColor: "#FFFFFF0D" },
  page: { width: 65, height: 76, backgroundColor: "#F4F8FC", borderRadius: 12, padding: 8, gap: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#D7E1EE", paddingBottom: 5 },
  ring: { width: 4, height: 10, borderRadius: 3, backgroundColor: "#7FAEAC" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, day: { width: 13, height: 11, borderRadius: 3, backgroundColor: "#D8E4F2", alignItems: "center", justifyContent: "center" }, selected: { backgroundColor: "#6A9F96" },
  clock: { position: "absolute", bottom: 4, right: 0, width: 31, height: 31, backgroundColor: "#DBE8FA", borderWidth: 2, borderColor: "#7395AC", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  spark: { position: "absolute", left: 1, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: "#E7CCA5" },
});
