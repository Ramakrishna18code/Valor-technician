import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RequestView, TechnicianDashboard, VisitView } from "../types/technician";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Props = {
  dashboard: TechnicianDashboard | null;
  jobs: RequestView[];
  visits: VisitView[];
  loading: boolean;
  unreadCount: number;
  onRefresh: () => void;
  onJobs: () => void;
  onJob: (job: RequestView) => void;
  onVisits: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  onEmergency: () => void;
  onSupport: () => void;
  onHistory: () => void;
  onSafety: () => void;
  onReports: () => void;
};
const c = { navy: "#082A55", ink: "#102033", muted: "#66758A", background: "#F6F8FB", border: "#DDE5EF", green: "#168A4A", blue: "#246DE3", teal: "#0F766E", amber: "#A66B0B", red: "#D64545" };
const readable = (value?: string | null) => (value || "Not provided").replace(/[_\.\-]+/g, " ").toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
const terminal = (status: string) => ["COMPLETED", "CANCELLED"].includes(status);

export default function DashboardScreen(props: Props) {
  const { dashboard, jobs, visits, loading } = props;
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 720 && fontScale < 1.4;
  const columns = wide ? 3 : 2;
  const cardWidth = columns === 3 ? "31%" : "47%";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const profile = dashboard?.profile;
  const name = readable(profile?.email?.split("@")[0].replace(/^tech[._-]/i, "") || profile?.employeeId || "Technician");
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const activeJobs = jobs.filter(job => !terminal(job.status));
  const scheduledToday = activeJobs.filter(job => job.preferredVisitDate?.slice(0, 10) === dateKey);
  const visibleJobs = (scheduledToday.length ? scheduledToday : activeJobs).slice(0, 3);
  const nextVisit = [...visits].filter(visit => !terminal(visit.status) && visit.scheduledDate >= dateKey)
    .sort((a, b) => `${a.scheduledDate} ${a.startTime}`.localeCompare(`${b.scheduledDate} ${b.startTime}`))[0];
  const metrics: { label: string; value?: number; icon: Icon; color: string; action: () => void }[] = [
    { label: "Assigned jobs", value: dashboard?.assignedJobs, icon: "briefcase-outline", color: c.blue, action: props.onJobs },
    { label: "In progress", value: dashboard?.inProgressJobs, icon: "construct-outline", color: c.teal, action: props.onJobs },
    { label: "Pending jobs", value: dashboard?.pendingJobs, icon: "time-outline", color: c.amber, action: props.onJobs },
    { label: "Completed this quarter", value: dashboard?.completedThisQuarter, icon: "checkmark-circle-outline", color: c.green, action: props.onHistory },
    { label: "Today's visits", value: dashboard?.todaysScheduledVisits, icon: "calendar-outline", color: c.blue, action: props.onVisits },
    { label: "Emergency jobs", value: dashboard?.emergencyJobs, icon: "alert-circle-outline", color: c.red, action: props.onEmergency },
  ];
  const actions: { title: string; detail: string; icon: Icon; onPress: () => void }[] = [
    { title: "Assigned jobs", detail: "View jobs and update progress", icon: "briefcase-outline", onPress: props.onJobs },
    { title: "Visit schedule", detail: "Plan upcoming site visits", icon: "calendar-outline", onPress: props.onVisits },
    { title: "Service history", detail: "Review previous work", icon: "time-outline", onPress: props.onHistory },
    { title: "Reports", detail: "See your work summary", icon: "bar-chart-outline", onPress: props.onReports },
  ];
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading && !!dashboard} onRefresh={props.onRefresh} tintColor={c.blue} />}>
      <View style={s.top}>
        <View style={s.brand}><Text style={s.brandMark}>V</Text><View><Text style={s.brandName}>VALOR</Text><Text style={s.brandMeta}>TECHNICIAN</Text></View></View>
        <View style={s.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh dashboard" disabled={loading} onPress={props.onRefresh} style={s.iconButton}><Ionicons name="refresh-outline" size={22} color={c.navy} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${props.unreadCount} unread`} onPress={props.onNotifications} style={s.iconButton}>
            <Ionicons name="notifications-outline" size={23} color={c.navy} />
            {props.unreadCount > 0 && <Text style={s.notificationBadge}>{props.unreadCount > 9 ? "9+" : props.unreadCount}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={props.onProfile} style={[s.iconButton, s.profileIcon]}><Ionicons name="person-outline" size={22} color={c.navy} /></Pressable>
        </View>
      </View>
      <View style={s.hero}>
        <Text style={s.greeting}>{greeting}, {name}</Text>
        <Text style={s.heroTitle}>Your workday,{"\n"}at a glance.</Text>
        <Text style={s.heroDescription}>Manage your jobs, plan your visits and keep customers informed.</Text>
        <View style={s.heroFooter}>
          <View style={s.availability}><Ionicons name={profile?.availabilityStatus === "AVAILABLE" ? "checkmark-circle" : "time-outline"} size={16} color={c.navy} /><Text style={s.availabilityText}>{readable(profile?.availabilityStatus)}</Text></View>
          <Text style={s.employee}>{profile?.employeeId || "Valor service team"}</Text>
        </View>
      </View>
      {profile?.assignedArea && <View style={s.area}><Ionicons name="location-outline" size={18} color={c.muted} /><Text style={s.meta}>Service area: {profile.assignedArea}</Text></View>}
      <View style={s.section}><Text style={s.heading}>Work overview</Text><Text style={s.caption}>Your assigned workload</Text></View>
      {loading && !dashboard ? <ActivityIndicator color={c.blue} accessibilityLabel="Loading dashboard" /> : <View style={s.grid}>
        {metrics.map(metric => <Pressable key={metric.label} accessibilityRole="button" accessibilityLabel={`${metric.label}: ${metric.value ?? "unavailable"}`} onPress={metric.action} style={[s.metric, { width: cardWidth }]}>
          <Ionicons name={metric.icon} size={23} color={metric.color} /><Text style={s.metricValue}>{metric.value ?? "—"}</Text><Text style={s.metricLabel}>{metric.label}</Text>
        </Pressable>)}
      </View>}
      <View style={s.section}><Text style={s.heading}>{scheduledToday.length ? "Today's jobs" : "Assigned work"}</Text><ActionLink label="View all" onPress={props.onJobs} /></View>
      {!loading && visibleJobs.length === 0 ? <View style={s.empty}>
        <Ionicons name="checkmark-done-circle-outline" size={36} color={c.teal} /><Text style={s.cardTitle}>You're up to date</Text><Text style={s.emptyText}>No active jobs in the current list. Refresh to check for new assignments or view your job history.</Text><ActionLink label="View job history" onPress={props.onHistory} />
      </View> : visibleJobs.map(job => <Pressable key={job.id} accessibilityRole="button" onPress={() => props.onJob(job)} style={s.job}>
        <View style={s.jobTop}><Text style={s.jobId}>{job.serviceId || `SR-${job.id}`}</Text><Text style={[s.status, job.priority === "EMERGENCY" && s.emergency]}>{readable(job.status)}</Text></View>
        <Text style={s.cardTitle}>{String(job.buildingName || job.title || readable(job.serviceType))}</Text>
        <Text style={s.meta}>{String(job.buildingAddress || job.location || "Open job details for site information")}</Text>
        <View style={s.jobBottom}><Text style={s.caption}>{job.preferredVisitDate || "Date pending"}{job.preferredTimeSlot ? ` · ${job.preferredTimeSlot}` : ""}</Text><Ionicons name="arrow-forward" size={20} color={c.blue} /></View>
      </Pressable>)}
      <View style={s.section}><Text style={s.heading}>Next visit</Text><ActionLink label="Schedule" onPress={props.onVisits} /></View>
      <Pressable accessibilityRole="button" onPress={props.onVisits} style={s.visit}>
        <View style={s.visitIcon}><Ionicons name="calendar-outline" size={26} color={c.blue} /></View>
        <View style={s.flex}><Text style={s.cardTitle}>{nextVisit ? nextVisit.title || nextVisit.serviceId || `Visit ${nextVisit.id}` : "No upcoming visit"}</Text><Text style={s.meta}>{nextVisit ? `${nextVisit.scheduledDate} · ${nextVisit.startTime?.slice(0, 5) || "Time pending"}` : "Newly scheduled visits will appear here."}</Text></View><Ionicons name="chevron-forward" size={20} color={c.muted} />
      </Pressable>
      <Text style={s.heading}>Quick actions</Text>
      <View style={s.grid}>{actions.map(action => <Pressable accessibilityRole="button" key={action.title} onPress={action.onPress} style={[s.action, { width: wide ? "23%" : "47%" }]}><Ionicons name={action.icon} size={24} color={c.blue} /><Text style={s.cardTitle}>{action.title}</Text><Text style={s.caption}>{action.detail}</Text></Pressable>)}</View>
      <View style={s.grid}>
        <Pressable accessibilityRole="button" style={[s.assistance, s.emergencySurface]} onPress={props.onEmergency}><Ionicons name="alert-circle-outline" size={24} color={c.red} /><View style={s.flex}><Text style={s.cardTitle}>Emergency jobs</Text><Text style={s.caption}>{dashboard?.emergencyJobs ?? "—"} assigned · view priority work</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>
        <Pressable accessibilityRole="button" style={s.assistance} onPress={props.onSupport}><Ionicons name="headset-outline" size={24} color={c.blue} /><View style={s.flex}><Text style={s.cardTitle}>Need assistance?</Text><Text style={s.caption}>Find guidance for contacting your supervisor</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={props.onSafety} style={s.safety}><Ionicons name="shield-checkmark-outline" size={26} color={c.green} /><View style={s.flex}><Text style={s.cardTitle}>Safety before every job</Text><Text style={s.caption}>Review site precautions and protective equipment.</Text></View><Ionicons name="chevron-forward" size={18} color={c.green} /></Pressable>
    </ScrollView>
  );
}

function ActionLink({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.linkButton}><Text style={s.link}>{label}</Text><Ionicons name="chevron-forward" size={16} color={c.blue} /></Pressable>;
}
const s = StyleSheet.create({
  scroll: { flex: 1 }, content: { padding: 16, paddingBottom: 32, gap: 16 }, flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 }, brandMark: { color: "#F6A800", fontSize: 32, fontWeight: "700" }, brandName: { color: c.navy, fontSize: 21, fontWeight: "700", letterSpacing: 2 }, brandMeta: { color: c.muted, fontSize: 10, letterSpacing: 1.5 },
  topActions: { flexDirection: "row", gap: 4 }, iconButton: { minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }, profileIcon: { backgroundColor: "#EAF2FF", borderRadius: 24 },
  notificationBadge: { position: "absolute", top: 2, right: 0, borderRadius: 10, minWidth: 18, padding: 2, backgroundColor: c.red, color: "white", fontSize: 11, textAlign: "center" },
  hero: { backgroundColor: c.navy, borderRadius: 20, padding: 24, gap: 12 }, greeting: { color: "#DCE8F7", fontSize: 16, lineHeight: 24 }, heroTitle: { color: "white", fontSize: 28, lineHeight: 36, fontWeight: "600" }, heroDescription: { color: "#DCE8F7", fontSize: 14, lineHeight: 22, maxWidth: 520 }, heroFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 8 },
  availability: { backgroundColor: "#EAF7EF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }, availabilityText: { color: c.navy, fontSize: 13, fontWeight: "700" }, employee: { color: "#DCE8F7", fontSize: 13 }, area: { flexDirection: "row", gap: 6, alignItems: "center" },
  section: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, heading: { color: c.navy, fontSize: 19, fontWeight: "600" }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { flexGrow: 1, borderRadius: 14, padding: 16, backgroundColor: "white", borderWidth: 1, borderColor: c.border, minHeight: 126, gap: 8 }, metricValue: { color: c.navy, fontSize: 26, fontWeight: "600" }, metricLabel: { color: c.muted, fontSize: 13, lineHeight: 19 },
  linkButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 }, link: { color: c.blue, fontWeight: "700", fontSize: 13 },
  empty: { backgroundColor: "white", borderWidth: 1, borderColor: c.border, borderRadius: 16, alignItems: "center", padding: 24, gap: 10 }, emptyText: { color: c.muted, fontSize: 14, lineHeight: 22, textAlign: "center", maxWidth: 440 },
  cardTitle: { color: c.navy, fontSize: 15, lineHeight: 22, fontWeight: "700", flexShrink: 1 }, meta: { color: c.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 }, caption: { color: c.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  job: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, gap: 8 }, jobTop: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }, jobId: { color: c.blue, fontSize: 12, fontWeight: "700" }, status: { color: c.teal, backgroundColor: "#E7F5F3", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12 }, emergency: { color: c.red, backgroundColor: "#FFF0F0" }, jobBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  visit: { backgroundColor: "white", borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, visitIcon: { backgroundColor: "#EAF2FF", borderRadius: 12, padding: 12 },
  action: { flexGrow: 1, backgroundColor: "white", borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 16, gap: 10 }, assistance: { flexGrow: 1, flexBasis: 280, backgroundColor: "#EAF2FF", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, emergencySurface: { backgroundColor: "#FFF0F0" }, safety: { borderRadius: 14, padding: 16, backgroundColor: "#EAF7EF", flexDirection: "row", alignItems: "center", gap: 12 },
});
