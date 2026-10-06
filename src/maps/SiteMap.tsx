import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { SiteMapProps } from "./SiteMap.types";
const lightStyle = [{
  elementType: "geometry",
  stylers: [{
    color: "#f1f5f8"
  }]
}, {
  elementType: "labels.text.fill",
  stylers: [{
    color: "#52697d"
  }]
}, {
  featureType: "water",
  elementType: "geometry",
  stylers: [{
    color: "#cce4f4"
  }]
}, {
  featureType: "road",
  elementType: "geometry",
  stylers: [{
    color: "#ffffff"
  }]
}, {
  featureType: "poi.park",
  elementType: "geometry",
  stylers: [{
    color: "#e2f1e6"
  }]
}];
export default function SiteMap({
  destination,
  current,
  route = [],
  title = "Site map",
  height = 230,
  onSelect
}: SiteMapProps) {
  const ref = useRef<MapView>(null),
    first = destination || current;
  const fit = () => {
    const points = [destination, current, ...route].filter(Boolean) as NonNullable<typeof destination>[];
    if (points.length === 1) ref.current?.animateToRegion({
      ...points[0],
      latitudeDelta: .012,
      longitudeDelta: .012
    }, 200);else if (points.length > 1) ref.current?.fitToCoordinates(points, {
      edgePadding: {
        top: 35,
        right: 35,
        bottom: 35,
        left: 35
      },
      animated: false
    });
  };
  useEffect(() => {
    fit();
  }, [JSON.stringify([destination, current, route])]);
  if (!first) return null;
  return <View style={{
    height,
    borderRadius: 20,
    overflow: "hidden"
  }}><MapView ref={ref} accessibilityLabel={title} style={{
      flex: 1
    }} customMapStyle={lightStyle} initialRegion={{
      ...first,
      latitudeDelta: .012,
      longitudeDelta: .012
    }} onMapReady={fit} onPress={event => onSelect?.(event.nativeEvent.coordinate)} showsCompass showsScale>
    {destination && <Marker coordinate={destination} title="Service site" pinColor="#187F6B" draggable={!!onSelect} onDragEnd={event => onSelect?.(event.nativeEvent.coordinate)} />}
    {current && <Marker coordinate={current} title="Your latest location" pinColor="#286FE5" />}
    {route.length > 1 && <Polyline coordinates={route} strokeColor="#286FE5" strokeWidth={5} />}
  </MapView></View>;
}
