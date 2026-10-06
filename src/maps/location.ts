import type { MapPoint } from "./SiteMap.types";
export function mapPoint(latitude: unknown, longitude: unknown): MapPoint | null {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") return null;
  const lat = Number(latitude),
    lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? {
    latitude: lat,
    longitude: lon
  } : null;
}
export function directionsUrl(point: MapPoint | null, address: string, origin?: MapPoint | null) {
  const destination = point ? `${point.latitude},${point.longitude}` : address.trim();
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving${origin ? `&origin=${origin.latitude},${origin.longitude}` : ""}&dir_action=navigate`;
}
export function showJobMap(status: string) {
  return status === "ON_THE_WAY" || status === "REACHED_SITE";
}
