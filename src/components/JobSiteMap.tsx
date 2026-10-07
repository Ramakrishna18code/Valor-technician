import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SiteMap from "../maps/SiteMap";
import { mapPoint, directionsUrl } from "../maps/location";
import type { RequestView, LocationView } from "../types/technician";
import type { Place } from "../maps/places";
import { technicianApi } from "../api/technicianApi";
import { typographyStyles as t } from "../theme/typography";

export default function JobSiteMap({ request }: { request: RequestView; location?: LocationView | null }) {
  const address = typeof request.buildingAddress === "string" ? request.buildingAddress.trim() : "";
  const known = mapPoint(request.buildingLatitude, request.buildingLongitude);
  const [selected, setSelected] = useState<Place | null>(null), [query, setQuery] = useState(address), [results, setResults] = useState<Place[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const destination = selected || known;
  const search = async () => { if (busy || query.trim().length < 3) return; setBusy(true); setError(""); try { const rows = await technicianApi.searchPlaces(query); setResults(rows); if (!rows.length) setError("No places found. Confirm the building address."); } catch (e) { setError(e instanceof Error ? e.message : "Could not search places."); } finally { setBusy(false); } };
  const navigate = async () => { const url = directionsUrl(destination, selected?.address || address, null); if (!url) { setError("The building location is unavailable."); return; } try { await Linking.openURL(url); } catch { setError("Could not open Google Maps."); } };
  return <View style={s.card}>
    <View style={s.heading}><View style={s.icon}><Ionicons name="navigate" size={22} color="#24756D" /></View><View style={s.flex}><Text style={s.title}>Building destination</Text><Text style={s.small}>Static site location for this job</Text></View></View>
    <Text style={s.address}>{selected?.address || address || "Building address unavailable"}</Text>
    {!known && <><View style={s.search}><Ionicons name="search" size={18} color="#6B7D8E" /><TextInput accessibilityLabel="Find service site" style={s.input} value={query} onChangeText={setQuery} placeholder="Building, street or city" placeholderTextColor="#6B7D8E" returnKeyType="search" onSubmitEditing={() => void search()} /><Pressable accessibilityRole="button" accessibilityLabel="Search service site" disabled={busy} onPress={() => void search()} style={s.searchButton}><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></Pressable></View>{results.map((place, index) => <Pressable key={index} onPress={() => { setSelected(place); setResults([]); }} style={s.result}><Ionicons name="location-outline" size={20} color="#24756D" /><View style={s.flex}><Text style={s.resultName}>{place.name}</Text><Text style={s.small}>{place.address}</Text></View></Pressable>)}</>}
    {destination ? <SiteMap destination={destination} title="Technician site map" /> : <View style={s.empty}><Ionicons name="map-outline" size={32} color="#72908E" /><Text style={s.small}>Search the address to place the site on the map.</Text></View>}
    <View style={s.legend}><Text style={s.siteLegend}>Building location</Text>{request.arrivalEstimateMinutes != null && <Text style={s.currentLegend}>Estimated arrival: {request.arrivalEstimateMinutes} min</Text>}</View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Open Google Maps navigation" onPress={() => void navigate()} style={s.primary}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="navigate-outline" size={19} color="#FFFFFF" /><Text style={s.primaryText}>Open Google Maps</Text></>}</Pressable>
  </View>;
}
const s = StyleSheet.create({ card: { padding: 18, borderRadius: 26, borderWidth: 1, borderColor: "#D7E8E6", backgroundColor: "#F2F9F7", gap: 12 }, heading: { flexDirection: "row", alignItems: "center", gap: 10 }, flex: { flex: 1, minWidth: 0 }, icon: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#E0F0EB", alignItems: "center", justifyContent: "center" }, title: { ...t.cardTitle, color: "#203C49" }, small: { ...t.secondary, color: "#637C89" }, address: { ...t.body, color: "#365366" }, search: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", paddingLeft: 12, borderRadius: 16, borderWidth: 1, borderColor: "#DCE7EE" }, input: { ...t.input, flex: 1, minWidth: 0, color: "#203C49" }, searchButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#24756D", alignItems: "center", justifyContent: "center", margin: 4 }, result: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 14, backgroundColor: "#FFFFFF" }, resultName: { ...t.cardTitle, color: "#203C49" }, empty: { height: 150, borderRadius: 20, backgroundColor: "#E6F0EF", alignItems: "center", justifyContent: "center", padding: 20, gap: 10 }, legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 }, siteLegend: { ...t.secondary, color: "#24756D" }, currentLegend: { ...t.secondary, color: "#286FE5" }, primary: { minHeight: 48, borderRadius: 24, backgroundColor: "#24756D", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, primaryText: { ...t.button, color: "#FFFFFF" }, error: { ...t.body, color: "#AF4040" } });
