import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = { width?: number };

/** Compact welcome illustration for the technician service journey. */
export default function WelcomeServiceScene({ width = 300 }: Props) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      animation?.stop();
      motion.setValue(0);
      if (reduced || !mounted) return;
      const move = (toValue: number) => Animated.timing(motion, {
        toValue,
        duration: 1900,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      });
      animation = Animated.loop(Animated.sequence([move(1), move(0)]), { iterations: 2 });
      animation.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => { mounted = false; animation?.stop(); listener.remove(); };
  }, [motion]);

  return <View
    pointerEvents="none"
    accessible={false}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[s.scene, { width }]}
  >
    <View style={s.halo} />
    <View style={s.route}><View style={s.routeDot} /><View style={s.routeLine} /><View style={s.routeDot} /></View>
    <Animated.View style={[s.lift, { transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-42, 42] }) }] }]}>
      <View style={s.liftBody}><View style={s.liftDoor} /><View style={s.liftDoor} /></View>
      <View style={s.liftBadge}><Ionicons name="construct" size={17} color="#FFFFFF" /></View>
    </Animated.View>
    <View style={s.sparkOne} /><View style={s.sparkTwo} />
  </View>;
}

const s = StyleSheet.create({
  scene: { height: 154, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  halo: { position: "absolute", width: 142, height: 142, borderRadius: 71, backgroundColor: "#FFFFFF4A", borderWidth: 1, borderColor: "#FFFFFF80" },
  route: { position: "absolute", width: 210, top: 84, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  routeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#79AFA6", borderWidth: 2, borderColor: "#F4F8FC" },
  routeLine: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#9CB9C7" },
  lift: { alignItems: "center", justifyContent: "center" },
  liftBody: { width: 76, height: 78, padding: 5, borderRadius: 16, borderWidth: 2, borderColor: "#789DB1", backgroundColor: "#DCECF0", flexDirection: "row", gap: 3 },
  liftDoor: { flex: 1, borderRadius: 8, backgroundColor: "#8FB7C2", borderTopWidth: 2, borderTopColor: "#F8FFFF" },
  liftBadge: { position: "absolute", right: -18, bottom: -10, width: 35, height: 35, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#5576A5", borderWidth: 3, borderColor: "#F4F8FC" },
  sparkOne: { position: "absolute", left: 34, top: 37, width: 7, height: 7, borderRadius: 4, backgroundColor: "#E4C895" },
  sparkTwo: { position: "absolute", right: 34, top: 48, width: 5, height: 5, borderRadius: 3, backgroundColor: "#A7D7C5" },
});
