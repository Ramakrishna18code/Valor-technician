import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ArrivalOtpState } from "../types/technician";
import SwipeOtp from "./SwipeOtp";

export default function ArrivalVerification({ state, onRequest, onVerify }: {
  state: ArrivalOtpState | null;
  onRequest: () => Promise<void>;
  onVerify: (id: number, code: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const verified = state?.status === "VERIFIED";
  useEffect(() => { if (verified) setOpen(false); }, [verified]);
  const request = async () => {
    await onRequest();
    setCode("");
    setError("");
    setNotice("");
    setOpen(true);
  };
  const act = async (action: "verify" | "resend") => {
    if (lock.current || !state) return;
    lock.current = true;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      if (action === "resend") {
        await onRequest();
        setCode("");
        setNotice("A new code has been sent to the customer.");
      } else {
        await onVerify(state.id, code);
      }
    } catch {
      setError(action === "resend" ? "Could not resend the code. Please try again." : "Verification failed. Check the code with the customer and try again.");
    } finally { lock.current = false; setBusy(null); }
  };
  return <>
    <View style={s.card}>
      <View style={s.heading}><View style={s.smallIcon}><Ionicons name="shield-checkmark-outline" size={25} color="#246DE3" /></View><View style={s.flex}><Text style={s.eyebrow}>BEFORE YOU BEGIN</Text><Text style={s.cardTitle}>Confirm your arrival</Text></View></View>
      <Text style={s.body}>{verified ? "Arrival verified. You can continue the job." : "Swipe from right to left to send the customer a code. Enter it on the next screen."}</Text>
      {!verified && <SwipeOtp onRequest={request} resend={!!state} onContinue={() => { setError(""); setOpen(true); }} />}
      {verified && <Text style={s.success}>Arrival verified</Text>}
    </View>
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.nav}><Pressable accessibilityRole="button" accessibilityLabel="Back to job" disabled={!!busy} onPress={() => setOpen(false)} style={s.back}><Ionicons name="arrow-back" size={22} color="#082A55" /></Pressable><Text style={s.navTitle}>Arrival verification</Text><View style={s.back} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
            <View style={s.heroIcon}><Ionicons name="shield-checkmark-outline" size={42} color="#246DE3" /></View>
            <Text style={s.eyebrow}>CUSTOMER CONFIRMATION</Text>
            <Text style={s.title}>Enter the arrival code</Text>
            <Text style={s.description}>Ask the customer for the OTP shown in their Valor app to confirm you have reached the site.</Text>
            <View style={s.form}>
              <Text style={s.fieldLabel}>Customer OTP</Text>
              <TextInput accessibilityLabel="Customer arrival OTP" style={s.input} value={code} onChangeText={text => setCode(text.replace(/\D/g, ""))} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy} placeholder="Enter code" placeholderTextColor="#66758A" autoFocus />
              {!!error && <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
              {!!notice && <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
              <Pressable accessibilityRole="button" disabled={!!busy || code.length < 4 || !state} onPress={() => void act("verify")} style={[s.primary, (!!busy || code.length < 4 || !state) && s.disabled]}>{busy === "verify" ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={s.primaryText}>Verify and continue</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></>}</Pressable>
              <Pressable accessibilityRole="button" disabled={!!busy || !state} onPress={() => void act("resend")} style={s.resend}><Text style={[s.resendText, !!busy && s.disabled]}>{busy === "resend" ? "Sending…" : "Resend OTP"}</Text></Pressable>
            </View>
            <View style={s.hint}><Ionicons name="lock-closed-outline" size={15} color="#66758A" /><Text style={s.hintText}>The code is shared with the customer only.</Text></View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: "#F6F8FB" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#DDE5EF", padding: 22, gap: 16 },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  smallIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#66758A", fontSize: 10, lineHeight: 17, letterSpacing: 1.2, fontWeight: "700" },
  cardTitle: { color: "#082A55", fontSize: 17, lineHeight: 25, fontWeight: "600" },
  body: { color: "#66758A", fontSize: 13, lineHeight: 21 },
  nav: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E8EEF5" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, textAlign: "center", color: "#082A55", fontSize: 16, fontWeight: "600" },
  content: { width: "100%", maxWidth: 520, alignSelf: "center", padding: 24, paddingTop: 36, gap: 14, alignItems: "center" },
  heroIcon: { width: 88, height: 88, borderRadius: 30, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  title: { color: "#082A55", fontSize: 26, lineHeight: 34, fontWeight: "700", textAlign: "center" },
  description: { color: "#66758A", fontSize: 14, lineHeight: 23, textAlign: "center" },
  form: { width: "100%", backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#DDE5EF", padding: 22, gap: 14, marginTop: 12 },
  fieldLabel: { color: "#082A55", fontSize: 13, fontWeight: "600" },
  input: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: "#B9CFEF", color: "#082A55", backgroundColor: "#F6F9FF", fontSize: 22, textAlign: "center", padding: 16 },
  primary: { minHeight: 54, borderRadius: 999, backgroundColor: "#082A55", flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16, gap: 12 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  resend: { minHeight: 44, justifyContent: "center", alignItems: "center" }, resendText: { color: "#246DE3", fontSize: 12, fontWeight: "600" },
  disabled: { opacity: 0.45 }, error: { color: "#D64545", fontSize: 13, lineHeight: 20 }, success: { color: "#168A4A", fontSize: 13, lineHeight: 20 },
  hint: { flexDirection: "row", alignItems: "center", gap: 6 }, hintText: { flexShrink: 1, color: "#66758A", fontSize: 12, lineHeight: 19 },
});
