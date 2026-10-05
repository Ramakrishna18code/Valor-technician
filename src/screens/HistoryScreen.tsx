import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceReveal } from "../components/ServiceExperience";
import type { RequestView } from "../types/technician";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Props = {
  items: RequestView[];
  filter: number;
  onLoad: () => Promise<void>;
  onFilter: (index: number) => Promise<void>;
  onJob: (job: RequestView) => void;
  infoForJob: (job: RequestView) => { building: string; location: string };
};
const filters: { label: string; icon: IconName }[] = [
  { label: "All", icon: "layers-outline" },
  { label: "Completed", icon: "checkmark-circle-outline" },
  { label: "Cancelled", icon: "close-circle-outline" },
  { label: "Emergency", icon: "flash-outline" },
];
const c = { ink: "#203C49", muted: "#6B7E8E", blue: "#346ED6", teal: "#247B70", border: "#E0E8F0" };
const readable = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
function dateLabel(value?: string | null) {
  if (!value) return "Date pending";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date pending" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function HistoryScreen({ items, filter, onLoad, onFilter, onJob, infoForJob }: Props) {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  const { width, fontScale } = useWindowDimensions();
  const fourColumns = width >= 640 && fontScale < 1.3;
  const run = async (index?: number) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError("");
    try {
      if (index === undefined) await onLoad();
      else await onFilter(index);
    } catch {
      if (mounted.current) setError("We couldn't load your job history. Please try again.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void run();
    return () => { mounted.current = false; };
  }, []);

  return <FlatList
    style={s.screen}
    contentContainerStyle={s.content}
    data={busy || error ? [] : items}
    keyExtractor={item => `${filter}-${item.id}`}
    showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void run()} tintColor={c.teal} />}
    ListHeaderComponent={<View style={s.headerContent}>
      <ServiceReveal><View style={s.heading}>
        <View style={s.flex}><Text style={s.eyebrow}>YOUR SERVICE RECORD</Text><Text style={s.title}>Job history</Text><Text style={s.subtitle}>Review your work and revisit every detail.</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh job history" disabled={busy} onPress={() => void run()} style={({ pressed }) => [s.refresh, busy && s.disabled, pressed && s.pressed]}><Ionicons name="refresh-outline" size={21} color={c.teal} /></Pressable>
      </View></ServiceReveal>
      <ServiceReveal delay={60}><View style={s.filters}>
        {filters.map((item, index) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} jobs`} accessibilityState={{ selected: filter === index, disabled: busy }} disabled={busy} onPress={() => { if (filter !== index) void run(index); }} style={({ pressed }) => [s.filter, fourColumns ? s.fourColumns : s.twoColumns, filter === index && s.activeFilter, pressed && s.pressed]}>
          <Ionicons name={item.icon} size={17} color={filter === index ? c.blue : c.muted} />
          <Text style={[s.filterText, filter === index && s.activeFilterText]}>{item.label}</Text>
          {filter === index && <View style={s.activeDot} />}
        </Pressable>)}
      </View></ServiceReveal>
      <View style={s.results}><Text style={s.resultsTitle}>{filter === 0 ? "All assigned jobs" : `${filters[filter].label} jobs`}</Text><Text accessibilityLiveRegion="polite" style={s.resultCount}>{busy ? "Loading…" : error ? "Unavailable" : `${items.length} shown`}</Text></View>
    </View>}
    renderItem={({ item, index }) => {
      const info = infoForJob(item);
      const complete = item.status === "COMPLETED";
      const cancelled = item.status === "CANCELLED";
      const statusColor = complete ? c.teal : cancelled ? "#B84F50" : c.blue;
      const reference = item.serviceId || `JOB-${item.id}`;
      return <ServiceReveal delay={Math.min(index * 45, 180)}><Pressable accessibilityRole="button" accessibilityLabel={`${info.building}, ${reference}, ${readable(item.status)}. View job details`} onPress={() => onJob(item)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
        <View style={s.cardHeading}>
          <View style={[s.icon, complete && s.completedIcon, cancelled && s.cancelledIcon]}><Ionicons name={complete ? "checkmark-done-outline" : cancelled ? "close-outline" : "business-outline"} size={23} color={statusColor} /></View>
          <View style={s.flex}><Text numberOfLines={2} style={s.building}>{info.building}</Text><Text numberOfLines={1} ellipsizeMode="middle" accessibilityLabel={`Job reference ${reference}`} style={s.reference}>{reference}</Text></View>
        </View>
        <View style={s.badges}><View style={[s.badge, complete && s.completedBadge, cancelled && s.cancelledBadge]}><View style={[s.statusDot, { backgroundColor: statusColor }]} /><Text style={[s.badgeText, { color: statusColor }]}>{readable(item.status)}</Text></View>{item.priority === "EMERGENCY" && <View style={s.emergencyBadge}><Ionicons name="flash-outline" size={12} color="#B84F50" /><Text style={s.emergencyText}>Emergency</Text></View>}</View>
        <View style={s.detailRow}><Ionicons name="location-outline" size={16} color={c.muted} /><Text numberOfLines={2} style={s.detailText}>{info.location}</Text></View>
        <View style={s.detailRow}><Ionicons name="construct-outline" size={16} color={c.muted} /><Text style={s.detailText}>{readable(item.serviceType)}</Text></View>
        <View style={s.cardFooter}><View style={s.date}><Ionicons name="calendar-outline" size={15} color={c.muted} /><Text style={s.dateText}>{dateLabel(item.preferredVisitDate)}</Text></View><View style={s.action}><Text style={s.actionText}>View details</Text><Ionicons name="arrow-forward" size={17} color={c.teal} /></View></View>
      </Pressable></ServiceReveal>;
    }}
    ItemSeparatorComponent={() => <View style={s.separator} />}
    ListEmptyComponent={<ServiceReveal><View style={s.empty}>
      {busy ? <><ActivityIndicator color={c.teal} /><Text style={s.emptyTitle}>Loading your history</Text><Text style={s.emptyText}>Getting your latest job records.</Text></> : error ? <><View style={s.emptyIcon}><Ionicons name="cloud-offline-outline" size={27} color={c.muted} /></View><Text accessibilityRole="alert" style={s.emptyTitle}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void run()} style={s.emptyAction}><Text style={s.actionText}>Try again</Text></Pressable></> : <><View style={s.emptyIcon}><Ionicons name={filters[filter].icon} size={27} color={c.blue} /></View><Text style={s.emptyTitle}>{filter === 0 ? "No job history yet" : `No ${filters[filter].label.toLowerCase()} jobs yet`}</Text><Text style={s.emptyText}>Your assigned work appears here as your service record grows.</Text>{filter !== 0 && <Pressable accessibilityRole="button" onPress={() => void run(0)} style={s.emptyAction}><Text style={s.actionText}>View all jobs</Text></Pressable>}</>}
    </View></ServiceReveal>}
  />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F8FB" }, content: { padding: 20, paddingBottom: 32, width: "100%", maxWidth: 860, alignSelf: "center" }, headerContent: { gap: 20, paddingBottom: 16 },
  flex: { flex: 1, minWidth: 0 }, heading: { flexDirection: "row", alignItems: "center", gap: 14 }, eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: c.teal, marginBottom: 6 }, title: { fontSize: 27, lineHeight: 35, color: c.ink, fontWeight: "700" }, subtitle: { fontSize: 13, lineHeight: 21, color: c.muted, marginTop: 5 }, refresh: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#E9F3EF", alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, filter: { flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 48, gap: 7, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 1, borderColor: c.border, backgroundColor: "#FFFFFF", borderRadius: 14 }, twoColumns: { flexBasis: "46%" }, fourColumns: { flexBasis: "22%" }, filterText: { fontSize: 12, fontWeight: "600", color: c.muted }, activeFilter: { backgroundColor: "#EDF4FF", borderColor: "#B8CFF4" }, activeFilterText: { color: c.blue }, activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.blue },
  results: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, resultsTitle: { color: c.ink, fontSize: 16, lineHeight: 23, fontWeight: "600" }, resultCount: { color: c.muted, fontSize: 12, lineHeight: 19 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 18, gap: 12 }, cardHeading: { flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#EDF4FF", alignItems: "center", justifyContent: "center" }, completedIcon: { backgroundColor: "#EAF5EE" }, cancelledIcon: { backgroundColor: "#FFF0EF" }, building: { color: c.ink, fontSize: 17, lineHeight: 24, fontWeight: "600" }, reference: { color: c.muted, fontSize: 11, lineHeight: 18, marginTop: 3 }, badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#EDF4FF" }, completedBadge: { backgroundColor: "#EAF5EE" }, cancelledBadge: { backgroundColor: "#FFF0EF" }, badgeText: { fontSize: 11, fontWeight: "600", lineHeight: 16 }, statusDot: { width: 5, height: 5, borderRadius: 3 }, emergencyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#FFF0EF" }, emergencyText: { color: "#B84F50", fontSize: 11, lineHeight: 16, fontWeight: "600" }, detailRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" }, detailText: { flex: 1, color: c.muted, fontSize: 12, lineHeight: 19 },
  cardFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14, marginTop: 2, borderTopWidth: 1, borderTopColor: "#EEF2F6" }, date: { flexDirection: "row", alignItems: "center", gap: 6 }, dateText: { color: c.muted, fontSize: 11, lineHeight: 18 }, action: { flexDirection: "row", alignItems: "center", gap: 7 }, actionText: { color: c.teal, fontSize: 12, lineHeight: 19, fontWeight: "600" }, separator: { height: 14 }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.5 },
  empty: { padding: 28, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: "#FFFFFF", alignItems: "center", gap: 12 }, emptyIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center" }, emptyTitle: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: c.ink, textAlign: "center" }, emptyText: { fontSize: 13, lineHeight: 21, color: c.muted, textAlign: "center", maxWidth: 320 }, emptyAction: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 12, backgroundColor: "#EDF6F1" },
});
