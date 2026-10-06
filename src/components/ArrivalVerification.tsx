import { typographyStyles as appTypography } from "../theme/typography";
import { otpExpiryTime } from "../utils/otpTime";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ArrivalOtpState } from "../types/technician";
import { ServiceReveal } from "./ServiceExperience";

export default function ArrivalVerification({ state, onRequest, onVerify }: {
  state: ArrivalOtpState | null;
  onRequest: () => Promise<void>;
  onVerify: (id: number, code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const pending = state?.status === "PENDING" && (!state.expiresAt || otpExpiryTime(state.expiresAt) > now);
  const verified = state?.status === "VERIFIED";
  useEffect(() => { setCode(""); setError(""); }, [state?.id, verified]);
  const act = async (action: "verify" | "resend") => {
    if (lock.current || (action === "verify" && (!state || !pending || code.length !== 6))) return;
    lock.current = true;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      if (action === "resend") {
        await onRequest();
        setCode("");
        setNotice("A new code is available in the customer's service details.");
      } else {
        await onVerify(state!.id, code);
      }
    } catch {
      setError(action === "resend" ? "Could not resend the code. Please try again." : "Verification failed. Check the code with the customer and try again.");
    } finally { lock.current = false; setBusy(null); }
  };
  return <ServiceReveal>
    <View style={s.card}>
      <View style={s.heading}><View style={s.smallIcon}><Ionicons name="shield-checkmark-outline" size={25} color="#246DE3" /></View><View style={s.flex}><Text style={s.eyebrow}>BEFORE YOU BEGIN</Text><Text style={s.cardTitle}>Confirm your arrival</Text></View></View>
      <Text style={s.body}>{verified ? "Arrival verified. You can continue the job." : "Ask the customer to open this service in their Valor app. Enter their six-digit arrival OTP below before starting work."}</Text>

      {verified && <Text style={s.success}>Arrival verified</Text>}
      {!verified && <>
            <View style={s.form}>
              <Text accessibilityLiveRegion="polite" style={s.body}>{pending ? "Arrival code ready in the customer app." : state ? "This code is no longer available. Request a new OTP." : "Send an arrival OTP to the customer to continue."}</Text>
              <Text style={s.fieldLabel}>Customer OTP</Text>
              <TextInput accessibilityLabel="Customer arrival OTP" style={s.input} value={code} onChangeText={text => setCode(text.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} editable={!busy && pending} placeholder="6-digit code" placeholderTextColor="#66758A" />
              {!!error && <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
              {!!notice && <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
              <Pressable accessibilityRole="button" disabled={!!busy || code.length !== 6 || !pending} onPress={() => void act("verify")} style={[s.primary, (!!busy || code.length !== 6 || !pending) && s.disabled]}>{busy === "verify" ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={s.primaryText}>Verify arrival OTP</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></>}</Pressable>
              <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void act("resend")} style={s.resend}><Text style={[s.resendText, !!busy && s.disabled]}>{busy === "resend" ? "Sending…" : (state ? "Resend arrival OTP" : "Send arrival OTP")}</Text></Pressable>
            </View>
            <View style={s.hint}><Ionicons name="lock-closed-outline" size={15} color="#66758A" /><Text style={s.hintText}>The code is shared with the customer only.</Text></View>
      </>}
    </View>
  </ServiceReveal>;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: "#F4FBF7", borderRadius: 18, borderWidth: 1, borderColor: "#D5EADD", padding: 16, gap: 12 },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  smallIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#E8F5F0", alignItems: "center", justifyContent: "center" },
  eyebrow: { ...appTypography.caption, color: "#66758A", letterSpacing: 1.2 },
  cardTitle: { ...appTypography.cardTitle, color: "#082A55" },
  body: { ...appTypography.body, color: "#66758A" },
  form: { width: "100%", gap: 10 },
  fieldLabel: { ...appTypography.body, color: "#082A55" },
  input: { ...appTypography.input, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "#B9CFEF", color: "#082A55", backgroundColor: "#F5FAF8", textAlign: "center", padding: 12 },
  primary: { minHeight: 54, borderRadius: 14, backgroundColor: "#247B70", flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16, gap: 12 },
  primaryText: { ...appTypography.button, color: "#FFFFFF" },
  resend: { minHeight: 44, justifyContent: "center", alignItems: "center" }, resendText: { ...appTypography.button, color: "#246DE3" },
  disabled: { opacity: 0.45 }, error: { ...appTypography.body, color: "#D64545" }, success: { ...appTypography.body, color: "#168A4A" },
  hint: { flexDirection: "row", alignItems: "center", gap: 6 }, hintText: { ...appTypography.secondary, flexShrink: 1, color: "#66758A" },
});
