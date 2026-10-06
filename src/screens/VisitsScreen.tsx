import { typographyStyles as appTypography } from "../theme/typography";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { technicianApi } from "../api/technicianApi";
import type { VisitView } from "../types/technician";
import { ServiceReveal } from "../components/ServiceExperience";
import { calendarDays, dateKey, monthRange, sortVisits } from "../utils/visitCalendar";

const c = { ink: "#203C49", muted: "#697D8B", blue: "#346ED6", teal: "#247B70", border: "#E1E9EF" };
const readable = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
const time = (value: string) => value ? value.slice(0, 5) : "Time pending";
const formatDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

export default function VisitsScreen({ onVisit }: { onVisit: (visit: VisitView) => void }) {
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [mode, setMode] = useState<"day" | "upcoming">("day");
  const [visits, setVisits] = useState<VisitView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const range = monthRange(month);
  // Read every page in the selected range; do not silently omit later assignments.
  useEffect(() => {
    const id = ++generation.current;
    let active = true;
    setLoading(true); setError(""); setVisits([]);
    async function load() {
      try {
        const query = mode === "upcoming" ? { fromDate: today } : { fromDate: range.fromDate, toDate: range.toDate };
        const first = await technicianApi.visits({ ...query, page: 0, size: 100 });
        const all = [...first.items];
        for (let page = 1; page < first.totalPages; page++) {
          if (!active || id !== generation.current) return;
          const result = await technicianApi.visits({ ...query, page, size: 100 });
          all.push(...result.items);
        }
        if (active && id === generation.current) setVisits(sortVisits([...new Map(all.map(visit => [visit.id, visit])).values()]));
      } catch {
        if (active && id === generation.current) setError("We couldn't load your schedule. Please try again.");
      } finally { if (active && id === generation.current) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [month, mode, refresh, today]);

  const days = calendarDays(month);
  const activeVisits = visits.filter(visit => !["CANCELLED", "COMPLETED"].includes(visit.status));
  const counts = useMemo(() => visits.reduce<Record<string, number>>((result, visit) => {
    if (visit.status !== "CANCELLED") result[visit.scheduledDate] = (result[visit.scheduledDate] || 0) + 1;
    return result;
  }, {}), [visits]);
  const shown = mode === "upcoming" ? activeVisits : visits.filter(visit => visit.scheduledDate === selected);
  const monthTitle = new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const moveMonth = (offset: number) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    const next = dateKey(date).slice(0, 7);
    setMonth(next); setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };
  const goToday = () => { setMonth(today.slice(0, 7)); setSelected(today); setMode("day"); };

  return <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefresh(value => value + 1)} tintColor={c.teal} />}>
    <View style={s.header}><View style={s.flex}><Text style={s.eyebrow}>YOUR WORK, PLANNED</Text><Text style={s.title}>Visit calendar</Text><Text style={s.subtitle}>A clear view of what’s ahead.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh schedule" disabled={loading} onPress={() => setRefresh(value => value + 1)} style={s.iconButton}><Ionicons name="refresh-outline" size={21} color={c.teal} /></Pressable>
    </View>
    <ServiceReveal><View style={s.overview}><View style={s.overviewIcon}><Ionicons name="calendar-outline" size={26} color={c.teal} /></View><View style={s.flex}><Text style={s.overviewTitle}>{loading ? "Loading your schedule…" : error ? "Schedule unavailable" : `${activeVisits.length} ${activeVisits.length === 1 ? "visit" : "visits"} ${mode === "day" ? "planned this month" : "ahead"}`}</Text><Text style={s.subtitle}>{mode === "day" ? "Select a date to see your assigned work." : "Scheduled and in-progress work from today."}</Text></View></View></ServiceReveal>
    <View style={s.tabs}>{(["day", "upcoming"] as const).map(tab => <Pressable key={tab} accessibilityRole="button" accessibilityState={{ selected: mode === tab }} onPress={() => setMode(tab)} style={[s.tab, mode === tab && s.activeTab]}><Ionicons name={tab === "day" ? "calendar-outline" : "list-outline"} size={17} color={mode === tab ? c.teal : c.muted} /><Text style={[s.tabText, mode === tab && s.activeTabText]}>{tab === "day" ? "Calendar" : "Upcoming"}</Text></Pressable>)}</View>
    {mode === "day" && <ServiceReveal><View style={s.calendar}>
      <View style={s.monthHeader}><Text style={s.monthTitle}>{monthTitle}</Text><View style={s.navigation}><Pressable accessibilityRole="button" onPress={goToday} style={s.todayButton}><Text style={s.todayText}>Today</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={s.arrow}><Ionicons name="chevron-back" size={20} color={c.ink} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={s.arrow}><Ionicons name="chevron-forward" size={20} color={c.ink} /></Pressable></View></View>
      <View style={s.week}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <Text key={day} style={s.weekday}>{day}</Text>)}</View>
      <View style={s.grid}>{days.map(day => {
        const inMonth = day.slice(0, 7) === month;
        const picked = day === selected;
        return <View key={day} style={s.cell}><Pressable accessibilityRole="button" accessibilityLabel={`${formatDay(day)}${day === today ? ", today" : ""}, ${loading ? "schedule loading" : `${counts[day] || 0} visits`}`} accessibilityState={{ selected: picked, disabled: !inMonth }} disabled={!inMonth} onPress={() => setSelected(day)} style={({ pressed }) => [s.day, day === today && s.today, picked && s.selected, pressed && s.pressed]}><Text style={[s.dayText, !inMonth && s.outside, picked && s.selectedText]}>{Number(day.slice(8))}</Text><View style={[s.dot, !!counts[day] && inMonth && s.assignedDot, picked && !!counts[day] && s.whiteDot]} /></Pressable></View>;
      })}</View>
      <View style={s.legend}><View style={[s.dot, s.assignedDot]} /><Text style={s.legendText}>Assigned visits</Text><View style={s.todayLegend} /><Text style={s.legendText}>Today</Text></View>
    </View></ServiceReveal>}
    <View style={s.agendaHeading}><View style={s.flex}><Text style={s.agendaTitle}>{mode === "day" ? selected === today ? "Today’s schedule" : formatDay(selected) : "Upcoming work"}</Text><Text style={s.subtitle}>{mode === "day" ? "Your visits for the selected date" : "In date and time order"}</Text></View>{!loading && !error && <Text style={s.count}>{shown.length}</Text>}</View>
    {loading ? <View style={s.empty}><ActivityIndicator color={c.teal} /><Text style={s.subtitle}>Getting your assigned visits…</Text></View> : error ? <View style={s.empty}><Ionicons name="cloud-offline-outline" size={28} color={c.muted} /><Text accessibilityRole="alert" style={s.emptyTitle}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRefresh(value => value + 1)} style={s.todayButton}><Text style={s.todayText}>Try again</Text></Pressable></View> : shown.length === 0 ? <ServiceReveal><View style={s.empty}><View style={s.emptyIcon}><Ionicons name="calendar-outline" size={28} color={c.blue} /></View><Text style={s.emptyTitle}>{mode === "day" ? "No visits on this date" : "No upcoming visits yet"}</Text><Text style={s.emptyCopy}>{mode === "day" ? "Choose another day or check Upcoming to plan your next site visit." : "Your future assignments will appear here once they’re scheduled."}</Text>{mode === "day" && <Pressable accessibilityRole="button" onPress={() => setMode("upcoming")} style={s.todayButton}><Text style={s.todayText}>View upcoming work</Text></Pressable>}</View></ServiceReveal> : shown.map((visit, index) => <ServiceReveal key={`${mode}-${selected}-${visit.id}`} delay={Math.min(index * 45, 180)}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${visit.title || "service visit"}, ${formatDay(visit.scheduledDate)}, ${time(visit.startTime)}, ${readable(visit.status)}`} onPress={() => onVisit(visit)} style={({ pressed }) => [s.visit, pressed && s.pressed]}>
      <View style={s.visitTop}><Text style={s.visitDate}>{mode === "upcoming" ? formatDay(visit.scheduledDate) : "SITE VISIT"}</Text><View style={[s.badge, visit.status === "CANCELLED" && s.cancelled, visit.status === "COMPLETED" && s.completed]}><Text style={s.badgeText}>{readable(visit.status)}</Text></View></View>
      <Text style={s.visitTitle}>{visit.title || (visit.serviceType ? readable(visit.serviceType) : "Service visit")}</Text>
      <Text style={s.reference}>{visit.serviceId || `Service request #${visit.serviceRequestId}`}</Text>
      <View style={s.visitBottom}><View style={s.timeRow}><Ionicons name="time-outline" size={17} color={c.teal} /><Text style={s.timeText}>{time(visit.startTime)} – {time(visit.endTime)}</Text></View><Ionicons name="arrow-forward" size={20} color={c.teal} /></View>
      {visit.priority === "EMERGENCY" && <Text style={s.emergency}>Emergency visit</Text>}
      {!!visit.notes && <Text numberOfLines={2} style={s.notes}>{visit.notes}</Text>}
    </Pressable></ServiceReveal>)}
    <Text style={s.footer}>Schedules reflect your assigned visits. Pull down to refresh.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F8FB" }, content: { padding: 20, paddingBottom: 32, gap: 18, width: "100%", maxWidth: 860, alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 }, header: { flexDirection: "row", alignItems: "center", gap: 12 }, eyebrow: { ...appTypography.caption, letterSpacing: 1.5, color: c.teal, marginBottom: 6 }, title: { ...appTypography.screenTitle, color: c.ink }, subtitle: { ...appTypography.body, color: c.muted, marginTop: 3 },
  iconButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#E9F3EF", alignItems: "center", justifyContent: "center" }, overview: { flexDirection: "row", alignItems: "center", padding: 18, gap: 14, backgroundColor: "#EAF5F0", borderRadius: 20, borderWidth: 1, borderColor: "#D8EAE1" }, overviewIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, overviewTitle: { ...appTypography.cardTitle, color: c.ink },
  tabs: { flexDirection: "row", backgroundColor: "#EAF0F4", borderRadius: 15, padding: 4, gap: 4 }, tab: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12 }, activeTab: { backgroundColor: "#FFFFFF" }, tabText: { ...appTypography.button, color: c.muted }, activeTabText: {  color: c.teal },
  calendar: { padding: 14, borderWidth: 1, borderColor: c.border, borderRadius: 22, backgroundColor: "#FFFFFF", gap: 14 }, monthHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, monthTitle: { ...appTypography.cardTitle, color: c.ink }, navigation: { flexDirection: "row", alignItems: "center", gap: 2 }, todayButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#EEF5FA", justifyContent: "center", alignItems: "center" }, todayText: { ...appTypography.button, color: c.blue }, arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row" }, weekday: { ...appTypography.caption, width: "14.285714%", textAlign: "center", color: c.muted }, grid: { flexDirection: "row", flexWrap: "wrap" }, cell: { width: "14.285714%", padding: 2 }, day: { minHeight: 44, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center", gap: 4 }, dayText: { ...appTypography.body, color: c.ink }, outside: {  color: "#BDC7D0" }, today: { borderColor: "#8FB3E8", backgroundColor: "#F0F6FF" }, selected: { backgroundColor: c.blue, borderColor: c.blue }, selectedText: {  color: "#FFFFFF" }, dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent" }, assignedDot: { backgroundColor: c.teal }, whiteDot: { backgroundColor: "#FFFFFF" }, legend: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEF2F6" }, legendText: { ...appTypography.caption, color: c.muted }, todayLegend: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: "#8FB3E8", marginLeft: 12 },
  agendaHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }, agendaTitle: { ...appTypography.sectionHeading, color: c.ink }, count: { ...appTypography.body, color: c.teal, backgroundColor: "#E7F2EC", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 }, empty: { padding: 28, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.border, alignItems: "center", gap: 12 }, emptyIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center" }, emptyTitle: { ...appTypography.cardTitle, textAlign: "center", color: c.ink }, emptyCopy: { ...appTypography.body, color: c.muted, textAlign: "center", maxWidth: 320 },
  visit: { borderWidth: 1, borderColor: c.border, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, gap: 7 }, visitTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }, visitDate: { ...appTypography.secondary, color: c.muted }, badge: { backgroundColor: "#EDF4FF", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 }, badgeText: { ...appTypography.secondary, color: c.ink }, cancelled: { backgroundColor: "#FFF0EF" }, completed: { backgroundColor: "#EAF6EE" }, visitTitle: { ...appTypography.cardTitle, color: c.ink }, reference: { ...appTypography.secondary, color: c.muted }, visitBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: "#EEF2F6", paddingTop: 13, marginTop: 7 }, timeRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }, timeText: { ...appTypography.secondary, flexShrink: 1, color: c.teal }, emergency: { ...appTypography.body, color: "#B34343" }, notes: { ...appTypography.body, color: c.muted, marginTop: 5 }, pressed: { opacity: 0.8 }, footer: { ...appTypography.body, textAlign: "center", color: c.muted },
});
