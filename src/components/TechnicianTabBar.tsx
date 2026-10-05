import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TECHNICIAN_PRIMARY_NAV, type Screen } from "../screens/screenRegistry";

const tabs = {
  dashboard: { label: "Home", icon: "home-outline" },
  jobs: { label: "Jobs", icon: "briefcase-outline" },
  visits: { label: "Visits", icon: "calendar-month-outline" },
  notifications: { label: "Alerts", icon: "bell-outline" },
  history: { label: "History", icon: "clock-outline" },
  profile: { label: "Profile", icon: "account-outline" },
} as const;

export default function TechnicianTabBar({ screen, unreadCount, onChange }: {
  screen: Screen;
  unreadCount: number;
  onChange: (screen: Screen) => void;
}) {
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const position = useRef(new Animated.Value(0)).current;
  const previousWidth = useRef(0);
  const activeScreen = screen === "reports" ? "dashboard" : screen;
  const activeIndex = TECHNICIAN_PRIMARY_NAV.findIndex(tab => tab === activeScreen);
  const activeTab = activeIndex >= 0 ? tabs[TECHNICIAN_PRIMARY_NAV[activeIndex]] : null;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!width || activeIndex < 0) return;
    const target = 3 + ((width - 6) / TECHNICIAN_PRIMARY_NAV.length) * (activeIndex + 0.5) - 30;
    position.stopAnimation();
    if (reduceMotion || previousWidth.current !== width) {
      position.setValue(target);
      previousWidth.current = width;
      return;
    }
    const animation = Animated.timing(position, {
      toValue: target,
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      isInteraction: false,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [width, activeIndex, reduceMotion, position]);

  return <View style={styles.container}>
    <View style={styles.bar} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View pointerEvents="none" style={styles.surface} />
      {width > 0 && activeTab ? <Animated.View pointerEvents="none" accessible={false} style={[styles.notch, { transform: [{ translateX: position }] }]}>
        <View style={styles.activeButton}>
          <LinearGradient colors={["#3985DD", "#164D91"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeFill}>
            <MaterialCommunityIcons name={activeTab.icon} size={20} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </Animated.View> : null}
      <View style={styles.items}>
        {TECHNICIAN_PRIMARY_NAV.map(tab => {
          const selected = tab === activeScreen;
          const item = tabs[tab];
          return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} accessibilityLabel={item.label}
            onPress={() => onChange(tab)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={[styles.icon, selected && width > 0 && styles.hiddenIcon]}>
              <MaterialCommunityIcons name={item.icon} size={24} color={selected ? "#164D91" : "#283041"} />
            </View>
            {tab === "notifications" && unreadCount > 0 ? <Text accessibilityLabel={`${unreadCount} unread alerts`} style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</Text> : null}
            <Text numberOfLines={1} style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
            <View style={[styles.dot, selected && styles.selectedDot]} />
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F5F7FB", paddingTop: 6, paddingBottom: 12, paddingHorizontal: 10, flexShrink: 0 },
  bar: { height: 80 },
  surface: { position: "absolute", top: 14, bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", borderRadius: 24, shadowColor: "#173451", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 5 },
  notch: { position: "absolute", left: 0, top: -10, width: 60, height: 60, borderRadius: 30, backgroundColor: "#F5F7FB" },
  activeButton: { position: "absolute", top: 12, left: 10, width: 40, height: 40, borderRadius: 20, shadowColor: "#164D91", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 4 },
  activeFill: { flex: 1, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  items: { flex: 1, flexDirection: "row", paddingHorizontal: 3 },
  item: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  icon: { height: 32, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  hiddenIcon: { opacity: 0 },
  label: { fontSize: 10, lineHeight: 15, fontWeight: "600", color: "#596174" },
  selectedLabel: { color: "#164D91", fontWeight: "800" },
  dot: { height: 3, width: 12, borderRadius: 2, marginTop: 4, backgroundColor: "transparent" },
  selectedDot: { backgroundColor: "#2672C8" },
  badge: { position: "absolute", top: 11, right: 2, minWidth: 18, paddingHorizontal: 3, borderRadius: 9, backgroundColor: "#D63D4E", color: "#FFFFFF", fontSize: 10, lineHeight: 17, textAlign: "center", fontWeight: "700" },
  pressed: { opacity: 0.65 },
});
