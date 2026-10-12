import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { typographyStyles as t } from "../theme/typography";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
const themes: Record<string, { icon: Icon; color: string; tint: string }> = {
  All: { icon: "grid-outline", color: "#526DA7", tint: "#EAF0FD" },
  "Job Updates": { icon: "construct-outline", color: "#377D79", tint: "#E5F3EF" },
  Jobs: { icon: "construct-outline", color: "#377D79", tint: "#E5F3EF" },
  Emergency: { icon: "shield-checkmark-outline", color: "#B26355", tint: "#FBEDE7" },
  Messages: { icon: "chatbubbles-outline", color: "#8465AA", tint: "#F1EBFA" },
  System: { icon: "settings-outline", color: "#377D79", tint: "#E5F3EF" },
  Announcements: { icon: "megaphone-outline", color: "#8465AA", tint: "#F1EBFA" },
};

function AlertIllustration({ filter }: { filter: string }) {
  const motion = useRef(new Animated.Value(0)).current;
  const theme = themes[filter] || themes.All;
  useEffect(() => {
    let live = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      animation?.stop(); motion.setValue(0);
      if (reduced || !live) return;
      const step = (toValue: number) => Animated.timing(motion, { toValue, duration: 1900,
        easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web", isInteraction: false });
      animation = Animated.loop(Animated.sequence([step(1), step(0)]), { iterations: 2 });
      animation.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => { live = false; animation?.stop(); listener.remove(); };
  }, [filter, motion]);
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={s.art}>
    <View style={[s.orbit, { backgroundColor: theme.tint }]} /><View style={s.orbitLine} />
    <Animated.View style={[s.messageCard, { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [2, -5] }) }, { rotate: "-7deg" }] }]}>
      <View style={[s.artIcon, { backgroundColor: theme.tint }]}><Ionicons name={filter === "All" ? "notifications-outline" : theme.icon} size={32} color={theme.color} /></View>
      <View style={s.line} /><View style={[s.line, { width: 42, backgroundColor: "#E4EAF2" }]} />
    </Animated.View>
    <View style={s.chat}><Ionicons name="chatbubble-ellipses-outline" size={23} color="#8065A9" /></View>
    <View style={s.check}><Ionicons name="checkmark" size={20} color="#398477" /></View>
    <View style={s.dot} /><View style={[s.dot, { left: 37, top: 127, backgroundColor: "#A7C9C0", width: 6, height: 6 }]} />
  </View>;
}

export function AlertsHeader({ title, unread, action, onAction, disabled, filters, filter, onFilter }: {
  title: string; unread: number; action: string; onAction: () => void; disabled?: boolean;
  filters: string[]; filter: string; onFilter: (value: string) => void;
}) {
  return <View style={s.header}>
    <LinearGradient colors={["#536D9D", "#6E77A5", "#648F9B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View style={s.heroTop}><View style={s.heroEmblem}><Ionicons name="notifications-outline" size={19} color="#FFFFFF" /></View><Text style={s.title}>{title}</Text></View>
      <Text style={s.subtitle}>Your job updates and team messages.</Text>
      <View style={s.heroFooter}><Text style={s.unread}>{unread ? `${unread} unread updates` : "No unread updates"}</Text>
        <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onAction} style={({ pressed }) => [s.action, (pressed || disabled) && { opacity: 0.65 }]}>
          <Ionicons name={action === "Refresh" ? "refresh-outline" : "checkmark-done-outline"} size={17} color="#425D88" /><Text style={s.actionText}>{action}</Text>
        </Pressable>
      </View>
    </LinearGradient>
    <Text style={s.section}>Browse updates</Text>
    <View style={s.filters}>{filters.map(label => {
      const theme = themes[label] || themes.All;
      const selected = label === filter;
      return <Pressable key={label} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} aria-selected={selected} onPress={() => onFilter(label)}
        style={[s.filter, { backgroundColor: selected ? theme.tint : "#FFFFFF", borderColor: selected ? theme.color : "#E3E9F1" }]}>
        <Ionicons name={theme.icon} size={19} color={theme.color} /><Text style={[s.filterText, selected && { color: theme.color, fontWeight: "600" }]}>{label}</Text>
        {selected && <View style={[s.selected, { backgroundColor: theme.color }]} />}
      </Pressable>;
    })}</View>
  </View>;
}

export function AlertsEmpty({ filter }: { filter: string }) {
  const title = filter === "Emergency" ? "No emergency alerts" : filter === "Messages" ? "No messages yet" : filter === "All" ? "You're all caught up" : `No ${filter.toLowerCase()} yet`;
  const description = filter === "Emergency" ? "Urgent service notifications will appear here when they arrive." : filter === "Messages" ? "Messages from your team will appear here." : "New updates will appear here. Check back as your workday progresses.";
  return <LinearGradient colors={["#FFFFFF", "#F0F3FA", "#EAF3F3"]} style={s.empty}>
    <AlertIllustration filter={filter} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyText}>{description}</Text>
    <View style={s.hint}><Ionicons name="notifications-outline" size={14} color="#698096" /><Text style={s.hintText}>Your updates, organized in one place</Text></View>
  </LinearGradient>;
}

const s = StyleSheet.create({
  header: { gap: 14, paddingBottom: 18 },
  hero: { borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: "#8399B8" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  heroEmblem: { width: 30, height: 30, borderRadius: 10, flexShrink: 0, backgroundColor: "#FFFFFF1F", alignItems: "center", justifyContent: "center" },
  title: { ...t.cardTitle, fontSize: 18, color: "#FFFFFF", fontWeight: "600", flexShrink: 1 }, subtitle: { ...t.secondary, color: "#F5F7FD" },
  heroFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  unread: { ...t.secondary, color: "#FFFFFF" }, action: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F2F5FC", paddingHorizontal: 12, minHeight: 44, borderRadius: 14 }, actionText: { ...t.secondary, color: "#425D88", fontWeight: "600" },
  section: { ...t.cardTitle, color: "#334962", marginTop: 5 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, filter: { flexGrow: 1, flexBasis: "45%", minHeight: 50, borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }, filterText: { ...t.secondary, color: "#52647C", flexShrink: 1 }, selected: { width: 5, height: 5, borderRadius: 3, marginLeft: "auto" },
  empty: { borderRadius: 24, padding: 22, paddingTop: 10, alignItems: "center", borderWidth: 1, borderColor: "#DEE7EF", gap: 10 },
  emptyTitle: { ...t.sectionHeading, color: "#344B68", textAlign: "center" }, emptyText: { ...t.body, color: "#617389", textAlign: "center", maxWidth: 310 },
  hint: { marginTop: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#DBE5EC", flexDirection: "row", gap: 6, alignItems: "center" }, hintText: { ...t.caption, color: "#60768B", flexShrink: 1 },
  art: { width: 210, height: 165, alignItems: "center", justifyContent: "center" }, orbit: { position: "absolute", width: 136, height: 136, borderRadius: 68 }, orbitLine: { position: "absolute", width: 166, height: 150, borderRadius: 80, borderWidth: 1, borderColor: "#D6DFEF", transform: [{ rotate: "-25deg" }] },
  messageCard: { width: 89, height: 110, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E1F0", alignItems: "center", justifyContent: "center", gap: 9 }, artIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center" }, line: { width: 56, height: 4, borderRadius: 2, backgroundColor: "#CCD8E8" },
  chat: { position: "absolute", top: 22, right: 18, width: 45, height: 40, borderRadius: 14, backgroundColor: "#E8DFF5", alignItems: "center", justifyContent: "center", transform: [{ rotate: "9deg" }] }, check: { position: "absolute", bottom: 24, left: 24, width: 35, height: 35, borderRadius: 13, backgroundColor: "#D6EDE5", justifyContent: "center", alignItems: "center" }, dot: { position: "absolute", top: 32, left: 25, width: 8, height: 8, borderRadius: 4, backgroundColor: "#DCB993" },
});
