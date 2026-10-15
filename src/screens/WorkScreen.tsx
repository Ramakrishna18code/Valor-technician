import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InspectionsScreen from "./InspectionsScreen";
import InstallationAssignmentsScreen from "./InstallationAssignmentsScreen";

type WorkSection = "inspections" | "installations";

export default function WorkScreen() {
  const [section, setSection] = useState<WorkSection>("inspections");
  return <View style={s.screen}>
    <View style={s.switcher} accessibilityRole="tablist">
      <Pressable accessibilityRole="tab" accessibilityLabel="Inspections" accessibilityState={{ selected: section === "inspections" }} onPress={() => setSection("inspections")} style={s.option}>
        <View style={[s.icon, { backgroundColor: "#F1F0FB" }]}><Ionicons name="clipboard-outline" size={25} color="#6B66A8" /></View>
        <Text style={[s.label, section === "inspections" && s.activeLabel]}>Inspections</Text>
        <View style={[s.indicator, section === "inspections" && { backgroundColor: "#6B66A8" }]} />
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Installations" accessibilityState={{ selected: section === "installations" }} onPress={() => setSection("installations")} style={s.option}>
        <View style={[s.icon, { backgroundColor: "#F8F0FB" }]}><Ionicons name="business-outline" size={25} color="#7A5D8C" /></View>
        <Text style={[s.label, section === "installations" && s.activeLabel]}>Installations</Text>
        <View style={[s.indicator, section === "installations" && { backgroundColor: "#7A5D8C" }]} />
      </Pressable>
    </View>
    <View style={s.content}>{section === "inspections" ? <InspectionsScreen /> : <InstallationAssignmentsScreen />}</View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F8FB" },
  switcher: { flexDirection: "row", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingHorizontal: 16, paddingTop: 12 },
  option: { flex: 1, minHeight: 112, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  icon: { width: 64, height: 64, borderRadius: 24, borderWidth: 1, borderColor: "#DDD9F2", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  label: { fontSize: 17, color: "#526176" },
  activeLabel: { color: "#17345F", fontWeight: "700" },
  indicator: { width: 20, height: 3, borderRadius: 3, marginTop: 8 },
  content: { flex: 1 },
});
