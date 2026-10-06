export type MapPoint = {
  latitude: number;
  longitude: number;
};
export type SiteMapProps = {
  destination?: MapPoint | null;
  current?: MapPoint | null;
  route?: MapPoint[];
  title?: string;
  height?: number;
  onSelect?: (point: MapPoint) => void;
};
