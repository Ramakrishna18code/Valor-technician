import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typographyStyles as type } from "../theme/typography";
import { AvailabilityStatus } from "../types/technician";
const options: { value: AvailabilityStatus; label: string; detail: string; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; tint: string }[] = [
  { value: "AVAILABLE", label: "Available", detail: "Ready for assigned work", icon: "checkmark-circle", color: "#168A4A", tint: "#E8F7EE" },
  { value: "BUSY", label: "Busy", detail: "Currently occupied with work", icon: "construct", color: "#B47922", tint: "#FFF4E2" },
  { value: "OFF_DUTY", label: "Not available", detail: "Off duty for now", icon: "pause-circle", color: "#54728B", tint: "#EDF3F8" },
  { value: "ON_LEAVE", label: "On leave", detail: "Away from work", icon: "calendar", color: "#7856C7", tint: "#F1ECFB" },
];
export default function AvailabilityPicker({ value, onSave }: { value?: AvailabilityStatus; onSave: (value: AvailabilityStatus) => Promise<void> }) {
  const [open, setOpen] = useState(false), [choice, setChoice] = useState<AvailabilityStatus>(value || "AVAILABLE"), [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const current = options.find(option => option.value === value);
  const save = async () => { if (saving) return; setSaving(true); setError(null); try { await onSave(choice); setOpen(false); } catch { setError("Could not update availability. Please try again."); } finally { setSaving(false); } };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Change availability" onPress={() => { setChoice(value || "AVAILABLE"); setError(null); setOpen(true); }} style={[s.pill, { backgroundColor: current?.tint || "#EDF3F8" }]}><Ionicons name={current?.icon || "help-circle"} size={17} color={current?.color || "#54728B"} /><Text style={[s.pillText, { color: current?.color || "#54728B" }]}>{current?.label || "Set availability"}</Text><Ionicons name="chevron-down" size={15} color={current?.color || "#54728B"} /></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!saving) setOpen(false); }}><View style={s.backdrop}><View accessibilityViewIsModal style={s.sheet}>
      <Text style={s.title}>Your availability</Text><Text style={s.body}>Let your team know when you can take on work.</Text>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: choice === option.value, disabled: saving }} disabled={saving} onPress={() => setChoice(option.value)} style={[s.option, choice === option.value && s.selected]}><View style={[s.icon, { backgroundColor: option.tint }]}><Ionicons name={option.icon} size={22} color={option.color} /></View><View style={s.flex}><Text style={s.optionTitle}>{option.label}</Text><Text style={s.meta}>{option.detail}</Text></View><Ionicons name={choice === option.value ? "radio-button-on" : "radio-button-off"} size={21} color={choice === option.value ? "#246DE3" : "#B5C3D3"} /></Pressable>)}
      {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Save availability" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => void save()} style={s.save}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.saveText}>Save availability</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => setOpen(false)} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable>
    </View></View></Modal>
  </>;
}
const s = StyleSheet.create({ pill: { borderRadius: 22, paddingHorizontal: 12, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7 }, pillText: { ...type.button }, backdrop: { flex: 1, backgroundColor: "rgba(8,30,55,.35)", justifyContent: "center", alignItems: "center", padding: 16 }, sheet: { width: "100%", maxWidth: 400, backgroundColor: "#F5F8FC", borderRadius: 26, padding: 20, gap: 12 }, title: { ...type.sectionHeading, color: "#082A55" }, body: { ...type.body, color: "#66758A" }, option: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2EAF3", borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }, selected: { borderColor: "#8FAFE4", backgroundColor: "#EDF4FF" }, icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, flex: { flex: 1 }, optionTitle: { ...type.cardTitle, color: "#153753" }, meta: { ...type.secondary, color: "#66758A" }, save: { minHeight: 50, borderRadius: 25, backgroundColor: "#246DE3", alignItems: "center", justifyContent: "center" }, saveText: { ...type.button, color: "#FFFFFF" }, cancel: { minHeight: 44, justifyContent: "center", alignItems: "center" }, cancelText: { ...type.button, color: "#54728B" }, error: { ...type.body, color: "#D64545" } });
