import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { typographyStyles as typography } from "../theme/typography";
export type ProfilePhoto = { dataUri: string | null };
type File = { uri: string; name: string; type: string; file?: unknown };
type PhotoApi = { getProfilePhoto: () => Promise<ProfilePhoto>; uploadProfilePhoto: (file: File) => Promise<ProfilePhoto>; removeProfilePhoto: () => Promise<ProfilePhoto> };
export default function ProfilePhotoEditor({ api, refreshKey = 0 }: { api: PhotoApi; refreshKey?: number }) {
  const photoRevision = useRef(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; const revision = ++photoRevision.current; api.getProfilePhoto().then(value => { if (active && revision === photoRevision.current) { setPhoto(value.dataUri); setError(null); } }).catch(() => { if (active && revision === photoRevision.current) setError("Could not load your photo. Choose a photo to retry."); }); return () => { active = false; }; }, [api, refreshKey, open]);
  const choose = async () => {
    if (busy) return;
    photoRevision.current += 1; setBusy(true); setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB.");
      const saved = await api.uploadProfilePhoto({ uri: asset.uri, name: asset.name, type: asset.mimeType || "image/jpeg", file: asset.file });
      setPhoto(saved.dataUri); setOpen(false);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save your photo. Try again."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy) return;
    photoRevision.current += 1; setBusy(true); setError(null);
    try { await api.removeProfilePhoto(); setPhoto(null); setOpen(false); }
    catch { setError("Could not remove your photo. Try again."); }
    finally { setBusy(false); }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => setOpen(true)} style={s.avatar}>
      {photo ? <Image accessibilityLabel="Your profile photo" source={{ uri: photo }} style={s.image} /> : <MaterialCommunityIcons name="account-circle-outline" size={44} color="#246DE3" />}
      <View style={s.camera}><MaterialCommunityIcons name="camera-plus-outline" size={15} color="#FFFFFF" /></View>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={s.backdrop}><View accessibilityViewIsModal style={s.sheet}>
        <View style={s.preview}>{photo ? <Image source={{ uri: photo }} style={s.image} /> : <MaterialCommunityIcons name="account-circle-outline" size={68} color="#246DE3" />}</View>
        <Text style={s.title}>Your profile photo</Text><Text style={s.copy}>Choose a JPEG or PNG up to 5 MB. Your photo is saved to your account.</Text>
        {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Choose profile photo" disabled={busy} onPress={() => void choose()} style={s.primary}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="image-plus" size={20} color="#FFFFFF" /><Text style={s.primaryText}>Choose photo</Text></>}</Pressable>
        {photo && <Pressable accessibilityRole="button" accessibilityLabel="Remove profile photo" disabled={busy} onPress={() => void remove()} style={s.secondary}><Text style={s.remove}>Remove photo</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel profile photo" disabled={busy} onPress={() => setOpen(false)} style={s.secondary}><Text style={s.cancel}>Cancel</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#EAF2FF", borderWidth: 2, borderColor: "#D7E7FF", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%", borderRadius: 50 }, camera: { position: "absolute", bottom: -2, right: -2, width: 25, height: 25, borderRadius: 13, backgroundColor: "#246DE3", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(8,30,55,.35)", padding: 20, justifyContent: "center", alignItems: "center" }, sheet: { width: "100%", maxWidth: 380, backgroundColor: "#F8FBFF", borderRadius: 28, padding: 24, gap: 14 },
  preview: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center", alignSelf: "center" }, title: { ...typography.sectionHeading, color: "#082A55", textAlign: "center" }, copy: { ...typography.body, color: "#66758A", textAlign: "center" }, error: { ...typography.body, color: "#D64545" },
  primary: { minHeight: 50, borderRadius: 25, backgroundColor: "#246DE3", flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" }, primaryText: { ...typography.button, color: "#FFFFFF" }, secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" }, remove: { ...typography.button, color: "#D64545" }, cancel: { ...typography.button, color: "#082A55" }
});
