import { ServiceReveal } from "./ServiceExperience";
import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { typographyStyles as t } from "../theme/typography";
export default function JobHandover({
  reportDone,
  checklistDone,
  checklist,
  onReport,
  onComplete,
  onReview
}: {
  reportDone: boolean;
  checklistDone: boolean;
  checklist: React.ReactNode;
  onReport: () => void;
  onComplete: () => void;
  onReview: () => void;
}) {
  const scroll = useRef<ScrollView>(null),
    checklistY = useRef(0);
  const ready = reportDone && checklistDone;
  return <ScrollView ref={scroll} contentContainerStyle={s.content}>
  <ServiceReveal><LinearGradient colors={["#E8F6EF", "#EFF6FF"]} style={s.hero}><View style={s.check}><Ionicons name="shield-checkmark" size={36} color="#178166" /></View><Text style={s.eyebrow}>CUSTOMER CONFIRMATION RECEIVED</Text><Text style={s.heading}>{ready ? "Ready to complete" : "Finish the handover"}</Text><Text style={s.body}>The completion code is verified. {ready ? "Your checklist and report are saved. Complete the job when you are ready." : "Save the remaining details to complete this job."}</Text></LinearGradient></ServiceReveal>
  <Text style={s.section}>Completion summary</Text>
  <View style={s.card}><Row title="Customer completion code" detail="Verified successfully" done /><Row title="Service checklist" detail={checklistDone ? "All required checks saved" : "Complete and save the required checks"} done={checklistDone} /><Pressable accessibilityRole="button" accessibilityLabel={reportDone ? "Edit handover report" : "Add handover report"} onPress={onReport}><Row title="Service report" detail={reportDone ? "Saved for this assignment" : "Add diagnosis, work performed and testing results"} done={reportDone} action /></Pressable></View>
  {!checklistDone && <View onLayout={e => {
      checklistY.current = e.nativeEvent.layout.y;
    }}>{checklist}</View>}
  {!ready && <View style={s.notice}><Ionicons name="information-circle-outline" size={20} color="#496882" /><Text style={s.noticeText}>{!checklistDone ? "The checklist is the next step. Customer verification is already saved." : "Your service report is the final step. Customer verification is already saved."}</Text></View>}
  <Pressable accessibilityRole="button" accessibilityLabel={ready ? "Complete job" : !checklistDone ? "Finish handover checklist" : "Add service report to complete job"} style={s.primary} onPress={ready ? onComplete : !checklistDone ? () => scroll.current?.scrollTo({
      y: checklistY.current,
      animated: true
    }) : onReport}><Text style={s.primaryText}>{ready ? "Complete job" : !checklistDone ? "Finish checklist" : "Add service report"}</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Review job before completion" style={s.secondary} onPress={onReview}><Text style={s.secondaryText}>Review job details</Text></Pressable>
 </ScrollView>;
}
function Row({
  title,
  detail,
  done,
  action = false
}: {
  title: string;
  detail: string;
  done: boolean;
  action?: boolean;
}) {
  return <View style={s.row}><View style={[s.symbol, !done && s.pending]}><Ionicons name={done ? "checkmark-circle" : "document-text-outline"} size={23} color={done ? "#178166" : "#B57D25"} /></View><View style={s.flex}><Text style={s.rowTitle}>{title}</Text><Text style={s.small}>{detail}</Text></View>{action && <Ionicons name="chevron-forward" size={20} color="#496882" />}</View>;
}
const s = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 40,
    gap: 16
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    gap: 12,
    alignItems: "flex-start"
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    ...t.caption,
    letterSpacing: 1,
    color: "#477D70"
  },
  heading: {
    ...t.screenTitle,
    color: "#203C49"
  },
  body: {
    ...t.body,
    color: "#567287"
  },
  section: {
    ...t.sectionHeading,
    color: "#203C49"
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE7F0"
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12
  },
  symbol: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E8F6EF",
    alignItems: "center",
    justifyContent: "center"
  },
  pending: {
    backgroundColor: "#FFF5E5"
  },
  flex: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    ...t.cardTitle,
    color: "#203C49"
  },
  small: {
    ...t.secondary,
    color: "#667C8C",
    marginTop: 3
  },
  notice: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#EDF4FB",
    flexDirection: "row",
    gap: 10
  },
  noticeText: {
    ...t.body,
    flex: 1,
    color: "#496882"
  },
  primary: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#247B70",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  primaryText: {
    ...t.button,
    color: "#FFFFFF"
  },
  secondary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D3E2ED"
  },
  secondaryText: {
    ...t.button,
    color: "#496882"
  }
});
