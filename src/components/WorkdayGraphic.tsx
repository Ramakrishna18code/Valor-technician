import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Decorative lift illustration; transform-only motion settles after two cycles. */
export default function WorkdayGraphic() {
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      animation?.stop();
      travel.setValue(0);
      if (reduced || !mounted) return;
      const timing = (toValue: number) => Animated.timing(travel, {
        toValue, duration: 2200, easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web", isInteraction: false,
      });
      animation = Animated.loop(Animated.sequence([timing(1), timing(0)]), { iterations: 2 });
      animation.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => { mounted = false; animation?.stop(); listener.remove(); };
  }, [travel]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.scene}>
    <View style={s.halo} />
    <View style={s.shaft}>
      <View style={s.signal}><Ionicons name="chevron-up" size={12} color="#D4F4ED" /><Ionicons name="chevron-down" size={12} color="#D4F4ED" /></View>
      <View style={s.rail} />
      <Animated.View style={[s.cabin, { transform: [{ translateY: travel.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }] }]}>
        <View style={s.door} /><View style={s.door} />
      </Animated.View>
    </View>
    <View style={s.badge}><Ionicons name="checkmark" size={18} color="#287367" /></View>
    <View style={s.spark} />
  </View>;
}

const s = StyleSheet.create({
  scene: { width: 90, height: 104, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  halo: { position: "absolute", width: 86, height: 86, borderRadius: 43, backgroundColor: "#FFFFFF12", borderWidth: 1, borderColor: "#FFFFFF25" },
  shaft: { width: 57, height: 82, borderRadius: 13, borderWidth: 1, borderColor: "#D6EAF57A", backgroundColor: "#FFFFFF18", alignItems: "center" },
  signal: { flexDirection: "row", paddingTop: 4, gap: 4 },
  rail: { position: "absolute", top: 24, bottom: 7, width: 1, backgroundColor: "#FFFFFF45" },
  cabin: { position: "absolute", bottom: 7, width: 40, height: 42, padding: 3, borderRadius: 5, backgroundColor: "#D9EAF0", flexDirection: "row", gap: 2 },
  door: { flex: 1, backgroundColor: "#9ABBCB", borderRadius: 2, borderTopWidth: 1, borderTopColor: "#F3FAFC" },
  badge: { position: "absolute", right: 0, bottom: 5, width: 29, height: 29, borderRadius: 11, backgroundColor: "#D2EDE1", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#5C899E" },
  spark: { position: "absolute", left: 2, top: 11, width: 6, height: 6, borderRadius: 3, backgroundColor: "#DCCCA1" },
});
