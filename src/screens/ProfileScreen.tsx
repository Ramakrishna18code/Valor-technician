import ProfilePhotoEditor from "../components/ProfilePhotoEditor";
import { technicianApi } from "../api/technicianApi";
import { typographyStyles as appTypography } from "../theme/typography";
import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { Screen } from "./screenRegistry";
import type { TechnicianDashboard, TechnicianProfileView } from "../types/technician";
import { ServiceReveal } from "../components/ServiceExperience";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Row = { title: string; subtitle: string; icon: Icon; color: string; background: string; target: Screen };
const c = { navy: "#082A55", text: "#102033", muted: "#66758A", border: "#DDE5EF", blue: "#246DE3", green: "#168A4A", amber: "#D9901A", purple: "#7856C7", teal: "#0F766E", red: "#D64545" };

export default function ProfileScreen({ profile, dashboard, onNavigate, onLogout }: {
  profile: TechnicianProfileView | null;
  dashboard: TechnicianDashboard | null;
  onNavigate: (screen: Screen) => void;
  onLogout: () => Promise<void>;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const confirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try { await onLogout(); } catch { setLogoutError("Could not clear your session. Please try again."); setLoggingOut(false); }
  };
  const name = (profile?.email?.split("@")[0].replace(/^tech[._-]/i, "").replace(/[._-]+/g, " ") || profile?.employeeId || "Technician").replace(/\b\w/g, letter => letter.toUpperCase());
  const shortcuts: Row[] = [
    { title: "My Details", subtitle: "View & edit", icon: "person-outline", color: c.blue, background: "#EAF2FF", target: "profileDetails" },
    { title: "My Jobs", subtitle: dashboard ? `${dashboard.assignedJobs} assigned jobs` : "View assigned work", icon: "briefcase-outline", color: c.green, background: "#EAF7EF", target: "jobs" },
    { title: "My Visits", subtitle: dashboard ? `${dashboard.todaysScheduledVisits} visits today` : "Plan your schedule", icon: "calendar-outline", color: c.purple, background: "#F1EDFB", target: "visits" },
    { title: "My Reports", subtitle: "Service records", icon: "document-text-outline", color: c.amber, background: "#FFF5E6", target: "reports" },
  ];
  const groups: { title: string; rows: Row[] }[] = [
    { title: "Account", rows: [
      { title: "Service History", subtitle: "View your assigned and completed work", icon: "clipboard-outline", color: c.blue, background: "#EAF2FF", target: "history" },
      { title: "Alerts & Notifications", subtitle: "Manage your job updates and alerts", icon: "notifications-outline", color: c.amber, background: "#FFF5E6", target: "profileNotifications" },
      { title: "Password Support", subtitle: "Request a password reset", icon: "lock-closed-outline", color: c.purple, background: "#F1EDFB", target: "profilePassword" },
      { title: "Language", subtitle: "Choose your preferred language", icon: "language-outline", color: c.teal, background: "#E7F5F3", target: "profileLanguage" },
    ] },
    { title: "App preferences", rows: [
      { title: "Location Services", subtitle: "Location access for job tracking", icon: "location-outline", color: c.green, background: "#EAF7EF", target: "profileLocation" },
      { title: "Theme", subtitle: "Appearance preferences", icon: "color-palette-outline", color: c.purple, background: "#F1EDFB", target: "profileTheme" },
    ] },
    { title: "Support & About", rows: [
      { title: "Help & Support", subtitle: "Get help and contact support", icon: "headset-outline", color: c.teal, background: "#E7F5F3", target: "profileHelp" },
      { title: "Terms & Privacy", subtitle: "Read our terms and privacy policy", icon: "shield-checkmark-outline", color: c.green, background: "#EAF7EF", target: "profileAbout" },
      { title: "About", subtitle: "App and company information", icon: "information-circle-outline", color: c.blue, background: "#EAF2FF", target: "profileAbout" },
    ] },
  ];
  return <><ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <View style={s.header}><Text style={s.pageTitle}>Profile</Text><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => onNavigate("profileNotifications")} style={s.headerAction}><Ionicons name="notifications-outline" size={23} color={c.amber} /></Pressable></View>
    <ServiceReveal><LinearGradient colors={["#061E3D", "#246DE3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View style={s.heroTop}><ProfilePhotoEditor api={technicianApi} /><View style={s.flex}><Text numberOfLines={2} style={s.name}>{name}</Text><Text numberOfLines={1} style={s.heroMeta}>{profile?.email || "Technician account"}</Text><Text style={s.heroMeta}>{profile?.phone || profile?.employeeId || "Valor Elevators Pvt Ltd"}</Text>{profile && <View style={s.accountBadge}><Ionicons name={profile.active ? "checkmark-circle-outline" : "person-outline"} size={13} color="#A9EDCF" /><Text style={s.accountBadgeText}>{profile.active ? "Active technician" : "Technician account"}</Text></View>}</View></View>
      <View style={s.stats}>{[
        { label: "Assigned", value: dashboard?.assignedJobs, icon: "briefcase-outline" as Icon, color: "#BDD9FF" },
        { label: "In progress", value: dashboard?.inProgressJobs, icon: "construct-outline" as Icon, color: "#FFDB95" },
        { label: "Completed", value: dashboard?.completedJobs, icon: "checkmark-circle-outline" as Icon, color: "#A9EDCF" },
      ].map(stat => <View key={stat.label} style={s.stat}><Ionicons name={stat.icon} size={20} color={stat.color} /><Text style={s.statValue}>{stat.value ?? "—"}</Text><Text style={s.statLabel}>{stat.label}</Text></View>)}</View>
    </LinearGradient></ServiceReveal>
    <Text style={s.sectionTitle}>Overview</Text>
    <ServiceReveal delay={60}><View style={s.grid}>{shortcuts.map(item => <Pressable key={item.title} accessibilityRole="button" onPress={() => onNavigate(item.target)} style={({ pressed }) => [s.shortcut, pressed && s.pressed]}><View style={[s.icon, { backgroundColor: item.background }]}><Ionicons name={item.icon} size={26} color={item.color} /></View><Text style={s.shortcutTitle}>{item.title}</Text><Text style={s.subtitle}>{item.subtitle}</Text></Pressable>)}</View></ServiceReveal>
    {groups.map((group, index) => <ServiceReveal key={group.title} delay={Math.min(100 + index * 50, 200)}><View style={s.group}><Text style={s.sectionTitle}>{group.title}</Text><View style={s.rows}>{group.rows.map((row, rowIndex) => <Pressable key={row.title} accessibilityRole="button" onPress={() => onNavigate(row.target)} style={({ pressed }) => [s.row, rowIndex !== group.rows.length - 1 && s.rowDivider, pressed && s.pressed]}><View style={[s.rowIcon, { backgroundColor: row.background }]}><Ionicons name={row.icon} size={23} color={row.color} /></View><View style={s.flex}><Text style={s.rowTitle}>{row.title}</Text><Text style={s.subtitle}>{row.subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>)}</View></View></ServiceReveal>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Logout" onPress={() => setLogoutOpen(true)} style={({ pressed }) => [s.logout, pressed && s.pressed]}><Ionicons name="log-out-outline" size={21} color={c.red} /><Text style={s.logoutText}>Logout</Text></Pressable>
  </ScrollView>
    <Modal visible={logoutOpen} transparent animationType="fade" onRequestClose={() => { if (!loggingOut) setLogoutOpen(false); }}>
      <View style={s.logoutBackdrop}><View accessibilityViewIsModal style={s.logoutSheet}>
        <View style={s.logoutSymbol}><Ionicons name="log-out-outline" size={26} color={c.red} /></View>
        <Text style={s.logoutHeading}>Log out?</Text>
        <Text style={s.logoutDescription}>You will need to sign in again to access your jobs.</Text>
        {logoutError && <Text accessibilityRole="alert" style={s.logoutError}>{logoutError}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Confirm logout" accessibilityState={{ disabled: loggingOut, busy: loggingOut }} disabled={loggingOut} onPress={() => void confirmLogout()} style={s.logoutConfirm}>{loggingOut ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.logoutConfirmText}>Log out</Text>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel logout" disabled={loggingOut} onPress={() => setLogoutOpen(false)} style={s.logoutCancel}><Text style={s.logoutCancelText}>Stay signed in</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  logoutBackdrop: { flex: 1, backgroundColor: "rgba(8, 30, 55, 0.35)", padding: 20, justifyContent: "center", alignItems: "center" },
  logoutSheet: { width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF", borderRadius: 26, padding: 24, gap: 14 },
  logoutSymbol: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFF0F0", alignItems: "center", justifyContent: "center" },
  logoutHeading: { ...appTypography.sectionHeading, color: c.navy }, logoutDescription: { ...appTypography.body, color: c.muted },
  logoutError: { ...appTypography.body, color: c.red },
  logoutConfirm: { minHeight: 50, borderRadius: 25, backgroundColor: c.red, alignItems: "center", justifyContent: "center" }, logoutConfirmText: { ...appTypography.button, color: "#FFFFFF" },
  logoutCancel: { minHeight: 44, alignItems: "center", justifyContent: "center" }, logoutCancelText: { ...appTypography.button, color: c.navy },
  screen: { flex: 1, backgroundColor: "#F6F8FB" }, content: { padding: 20, paddingBottom: 32, width: "100%", maxWidth: 760, alignSelf: "center", gap: 16 }, flex: { flex: 1, minWidth: 0 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pageTitle: { ...appTypography.screenTitle, color: c.navy }, headerAction: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF5E6", alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 24, padding: 20, shadowColor: c.navy, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, heroTop: { flexDirection: "row", alignItems: "center", gap: 14 }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#D7E7FF" }, name: { ...appTypography.customerName, color: "#FFFFFF" }, heroMeta: { ...appTypography.secondary, color: "#D0DDF0" }, accountBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#FFFFFF18", marginTop: 8 }, accountBadgeText: { ...appTypography.secondary, color: "#A9EDCF" }, stats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#FFFFFF30", paddingTop: 16, marginTop: 20 }, stat: { flex: 1, alignItems: "center", gap: 5 }, statValue: { ...appTypography.screenTitle, color: "#FFFFFF" }, statLabel: { ...appTypography.secondary, color: "#D0DDF0", textAlign: "center" },
  sectionTitle: { ...appTypography.sectionHeading, color: c.navy }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, shortcut: { flexBasis: "46%", flexGrow: 1, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: "#FFFFFF", shadowColor: c.navy, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, icon: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 10 }, shortcutTitle: { ...appTypography.cardTitle, color: c.text }, subtitle: { ...appTypography.body, color: c.muted, marginTop: 3 },
  group: { gap: 12 }, rows: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 }, row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, paddingVertical: 14 }, rowDivider: { borderBottomWidth: 1, borderBottomColor: "#EEF2F6" }, rowIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" }, rowTitle: { ...appTypography.cardTitle, color: c.text }, logout: { minHeight: 52, borderRadius: 16, backgroundColor: "#FFF0F0", borderWidth: 1, borderColor: "#F1D4D4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 }, logoutText: { color: c.red, fontSize: 14, fontWeight: "600" }, pressed: { opacity: 0.78 },
});
