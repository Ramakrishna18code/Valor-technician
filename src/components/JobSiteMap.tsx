import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import SiteMap from "../maps/SiteMap";
import { mapPoint, directionsUrl } from "../maps/location";
import type { MapPoint } from "../maps/SiteMap.types";
import type { Place } from "../maps/places";
import type { RequestView, LocationView } from "../types/technician";
import { technicianApi } from "../api/technicianApi";
import { typographyStyles as t } from "../theme/typography";
export default function JobSiteMap({
  request,
  location
}: {
  request: RequestView;
  location: LocationView | null;
}) {
  const address = typeof request.buildingAddress === "string" ? request.buildingAddress.trim() : "";
  const known = mapPoint(request.buildingLatitude, request.buildingLongitude);
  const [selected, setSelected] = useState<Place | null>(null),
    [query, setQuery] = useState(address),
    [results, setResults] = useState<Place[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [gps, setGps] = useState<MapPoint | null>(null);
  const destination = selected || known,
    current = gps || mapPoint(location?.latitude, location?.longitude);
  const search = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const rows = await technicianApi.searchPlaces(query);
      setResults(rows);
      if (!rows.length) setError("No places found. Try the building name and city.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search places.");
    } finally {
      setBusy(false);
    }
  };
  const recenter = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw Error("Allow location access to show your position. Directions still work without it.");
      const p = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const point = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude
      };
      setGps(point);
      await technicianApi.updateLocation(request.id, {
        ...point,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your location is unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const navigate = async () => {
    const url = directionsUrl(destination, selected?.address || address, location?.stale && !gps ? null : current);
    if (!url) {
      setError("The site address has not been added. Ask the customer to confirm it, then search above.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open directions. Please try again.");
    }
  };
  return <View style={s.card}>
  <View style={s.heading}><View style={s.icon}><Ionicons name="navigate" size={22} color="#24756D" /></View><View style={s.flex}><Text style={s.title}>Site navigation</Text><Text style={s.small}>{request.status === "ON_THE_WAY" ? "Find your route before arrival" : "Confirm the customer's site"}</Text></View></View>
  <Text style={s.address}>{selected?.address || address || "Ask the customer for the site address"}</Text>
  {!known && <><View style={s.search}><Ionicons name="search" size={18} color="#6B7D8E" /><TextInput accessibilityLabel="Find service site" style={s.input} value={query} onChangeText={setQuery} placeholder="Building, street or city" placeholderTextColor="#6B7D8E" returnKeyType="search" onSubmitEditing={() => void search()} /><Pressable accessibilityRole="button" accessibilityLabel="Search service site" disabled={busy || query.trim().length < 3} onPress={() => void search()} style={s.searchButton}><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></Pressable></View>{results.map((place, index) => <Pressable key={index} accessibilityRole="button" onPress={() => {
        setSelected(place);
        setResults([]);
        setError("");
      }} style={s.result}><Ionicons name="location-outline" size={20} color="#24756D" /><View style={s.flex}><Text style={s.resultName}>{place.name}</Text><Text style={s.small}>{place.address}</Text></View></Pressable>)}</>}
  {destination || current ? <SiteMap destination={destination} current={current} route={location?.route?.available ? location.route.polyline : []} title="Technician site map" /> : <View style={s.empty}><Ionicons name="map-outline" size={32} color="#72908E" /><Text style={s.small}>Search the address to place the site on the map.</Text></View>}
  <View style={s.legend}><Text style={s.siteLegend}>Site</Text><Text style={s.currentLegend}>Your location{location?.stale && !gps ? " (last known)" : ""}</Text></View>
  {location?.route?.available && <Text style={s.small}>{location.route.distanceMeters == null ? "" : (location.route.distanceMeters / 1000).toFixed(1) + " km"}{location.route.durationSeconds == null ? "" : " / " + Math.ceil(location.route.durationSeconds / 60) + " min"}</Text>}
  {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  <View style={s.actions}><Pressable accessibilityRole="button" accessibilityLabel="Show my location" disabled={busy} onPress={() => void recenter()} style={s.secondary}>{busy ? <ActivityIndicator color="#24756D" /> : <><Ionicons name="locate-outline" size={19} color="#24756D" /><Text style={s.secondaryText}>Locate me</Text></>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Navigate to service site" onPress={() => void navigate()} style={s.primary}><Ionicons name="navigate-outline" size={19} color="#FFFFFF" /><Text style={s.primaryText}>Directions</Text></Pressable></View>
 </View>;
}
const s = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#D7E8E6",
    backgroundColor: "#F2F9F7",
    gap: 12
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  flex: {
    flex: 1,
    minWidth: 0
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#E0F0EB",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    ...t.cardTitle,
    color: "#203C49"
  },
  small: {
    ...t.secondary,
    color: "#637C89"
  },
  address: {
    ...t.body,
    color: "#365366"
  },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingLeft: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE7EE"
  },
  input: {
    ...t.input,
    flex: 1,
    minWidth: 0,
    color: "#203C49"
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#24756D",
    alignItems: "center",
    justifyContent: "center",
    margin: 4
  },
  result: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF"
  },
  resultName: {
    ...t.cardTitle,
    color: "#203C49"
  },
  empty: {
    height: 150,
    borderRadius: 20,
    backgroundColor: "#E6F0EF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  siteLegend: {
    ...t.secondary,
    color: "#24756D"
  },
  currentLegend: {
    ...t.secondary,
    color: "#286FE5"
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#C9DFDB",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#24756D",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryText: {
    ...t.button,
    color: "#FFFFFF"
  },
  secondaryText: {
    ...t.button,
    color: "#24756D"
  },
  error: {
    ...t.body,
    color: "#AF4040"
  }
});
