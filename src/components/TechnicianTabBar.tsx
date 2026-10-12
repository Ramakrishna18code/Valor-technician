import { typographyStyles as appTypography } from "../theme/typography";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TECHNICIAN_PRIMARY_NAV, type Screen } from "../screens/screenRegistry";

const tabs = {
  dashboard: { label: "Home", icon: "home-outline", color: "#5275A8", tint: "#EDF3FC" },
  jobs: { label: "Jobs", icon: "construct-outline", color: "#92734C", tint: "#FAF5EC" },
  visits: { label: "Visits", icon: "calendar-outline", color: "#527F72", tint: "#EFF7F3" },
  notifications: { label: "Alerts", icon: "notifications-outline", color: "#A06480", tint: "#FBF1F5" },
  profile: { label: "Profile", icon: "person-outline", color: "#557F8C", tint: "#EFF6F8" },
} as const;

function TabItem({ tab, selected, reduceMotion, unreadCount, onChange }: {
  tab: keyof typeof tabs; selected: boolean; reduceMotion: boolean;
  unreadCount: number; onChange: (screen: Screen) => void;
}) {
  const item = tabs[tab];
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) { progress.setValue(selected ? 1 : 0); return; }
    const animation = Animated.timing(progress, {
      toValue: selected ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web", isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reduceMotion, progress]);
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected}
    accessibilityLabel={item.label} onPress={() => onChange(tab)}
    style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
    <Animated.View style={[styles.icon, { backgroundColor: item.tint,
      borderColor: selected ? item.color + "55" : "transparent",
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }]}>
      <Ionicons name={item.icon} size={22} color={item.color} />
      {tab === "notifications" && unreadCount > 0 ? <Text accessibilityLabel={`${unreadCount} unread alerts`}
        style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</Text> : null}
    </Animated.View>
    <Text style={[styles.label, selected && { color: item.color, fontWeight: "600" }]}>{item.label}</Text>
    <View style={[styles.indicator, { backgroundColor: selected ? item.color : "transparent" }]} />
  </Pressable>;
}

export default function TechnicianTabBar({ screen, unreadCount, onChange }: {
  screen: Screen; unreadCount: number; onChange: (screen: Screen) => void;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const activeScreen = screen === "reports" ? "dashboard" : screen;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return <View style={styles.container}><View style={styles.bar}>
    {TECHNICIAN_PRIMARY_NAV.map(tab => <TabItem key={tab} tab={tab} selected={tab === activeScreen}
      reduceMotion={reduceMotion} unreadCount={unreadCount} onChange={onChange} />)}
  </View></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F5F7FB", paddingTop: 8, paddingBottom: Platform.OS === "android" ? 8 : 12, paddingHorizontal: 8, flexShrink: 0 },
  // Keep controls and animation bounds inside the bar, including on narrow screens.
  bar: { flexDirection: "row", paddingHorizontal: 2, paddingVertical: 10, backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0", overflow: "visible" },
  item: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  icon: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 6, overflow: "visible" },
  label: { ...appTypography.navigation, color: "#526176", textAlign: "center" },
  indicator: { height: 2, width: 12, borderRadius: 2, marginTop: 6 },
  badge: { ...appTypography.caption, fontWeight: "600", position: "absolute", top: -5, right: -5, minWidth: 18, paddingHorizontal: 3, borderRadius: 10, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "#F8E4EC", color: "#944565", textAlign: "center" },
  pressed: { opacity: 0.72 },
});
