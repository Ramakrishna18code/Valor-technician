import React, { useEffect, useRef, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import type { SiteMapProps } from "./SiteMap.types";
import "leaflet/dist/leaflet.css";
import "./map.css";
export default function SiteMap({
  destination,
  current,
  route = [],
  title = "Site map",
  height = 230,
  onSelect
}: SiteMapProps) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    layers = useRef<any>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  const [error, setError] = useState(false);
  const identity = JSON.stringify([destination, current, route]);
  useEffect(() => {
    if (!host.current) return;
    const L = require("leaflet");
    const instance = L.map(host.current, {
      zoomControl: false,
      scrollWheelZoom: false
    });
    map.current = instance;
    L.control.zoom({
      position: "topright"
    }).addTo(instance);
    const tiles = L.tileLayer(process.env.EXPO_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(instance);
    tiles.on("tileerror", () => setError(true));
    tiles.on("tileload", () => setError(false));
    layers.current = L.layerGroup().addTo(instance);
    instance.on("click", (event: any) => select.current?.({
      latitude: event.latlng.lat,
      longitude: event.latlng.lng
    }));
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const L = require("leaflet"),
      group = layers.current;
    group.clearLayers();
    const points = [destination, current].filter(Boolean) as NonNullable<typeof destination>[];
    if (!points.length) return;
    if (destination) L.marker([destination.latitude, destination.longitude], {
      icon: L.divIcon({
        className: "valor-site-marker",
        html: '<span aria-hidden="true">●</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 27]
      })
    }).bindTooltip("Service site").addTo(group);
    if (current) L.circleMarker([current.latitude, current.longitude], {
      radius: 8,
      fillColor: "#286FE5",
      color: "#FFFFFF",
      weight: 3,
      fillOpacity: 1
    }).bindTooltip("Your latest location").addTo(group);
    if (route.length > 1) L.polyline(route.map(p => [p.latitude, p.longitude]), {
      color: "#286FE5",
      weight: 5,
      opacity: .85
    }).addTo(group);
    if (points.length > 1 || route.length > 1) map.current.fitBounds([...points, ...route].map(p => [p.latitude, p.longitude]), {
      padding: [30, 30],
      maxZoom: 16
    });else map.current.setView([points[0].latitude, points[0].longitude], 16);
  }, [identity]);
  return <View style={s.frame}><div ref={host} className="valor-map" role="region" aria-label={title} style={{
      height,
      width: "100%",
      zIndex: 0
    }} />{error && <Text style={s.notice}>Map tiles unavailable. You can still open directions.</Text>}</View>;
}
const s = StyleSheet.create({
  frame: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EAF1F5"
  },
  notice: {
    fontSize: 12,
    color: "#53697C",
    backgroundColor: "#FFF6E9",
    padding: 8
  }
});
