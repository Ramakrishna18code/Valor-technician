import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function StageActionBar({ primaryLabel, secondaryLabel, primaryIcon, secondaryIcon, onPrimary, onSecondary, primaryDisabled = false }: {
  primaryLabel: string; secondaryLabel?: string; primaryIcon: React.ComponentProps<typeof Ionicons>["name"]; secondaryIcon?: React.ComponentProps<typeof Ionicons>["name"];
  onPrimary: () => void | Promise<void>; onSecondary?: () => void | Promise<void>; primaryDisabled?: boolean;
}) {
  const [busy, setBusy] = useState<"primary" | "secondary" | null>(null);
  const lock = useRef(false);
  const run = async (which: "primary" | "secondary", action?: () => void | Promise<void>) => {
    if (!action || lock.current || (which === "primary" && primaryDisabled)) return;
    lock.current = true; setBusy(which);
    try { await action(); } finally { lock.current = false; setBusy(null); }
  };
  return <View style={s.wrap}><View style={s.row}>
    {secondaryLabel ? <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void run("secondary", onSecondary)} style={({ pressed }) => [s.secondary, pressed && s.pressed, !!busy && s.disabled]}><Ionicons name={secondaryIcon || "ellipsis-horizontal"} size={19} color="#246DE3" />{busy === "secondary" ? <ActivityIndicator color="#246DE3" /> : <Text style={s.secondaryText}>{secondaryLabel}</Text>}</Pressable> : null}
    <Pressable accessibilityRole="button" disabled={!!busy || primaryDisabled} onPress={() => void run("primary", onPrimary)} style={({ pressed }) => [s.primary, pressed && s.pressed, (primaryDisabled || !!busy) && s.disabled]}><Text style={s.primaryText}>{busy === "primary" ? "Saving..." : primaryLabel}</Text>{busy === "primary" ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={primaryIcon} size={20} color="#FFFFFF" />}</Pressable>
  </View></View>;
}
const s = StyleSheet.create({ wrap: { width: "100%", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E2EAF2", elevation: 10, shadowColor: "#173451", shadowOffset: { width: 0, height: -3 }, shadowOpacity: .12, shadowRadius: 8 }, row: { flexDirection: "row", gap: 10 }, secondary: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "#B9CFEF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, primary: { flex: 1.35, minHeight: 52, borderRadius: 16, backgroundColor: "#247B70", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, secondaryText: { color: "#246DE3", fontWeight: "700" }, primaryText: { color: "#FFFFFF", fontWeight: "700" }, pressed: { opacity: .78 }, disabled: { opacity: .5 } });
