import { useMemo, useState, useEffect } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { latLngToCell } from 'h3-js';
import type { TravelTimeRange } from './TravelTimeFilter';

interface Address {
  city: string;
  coordinates: { lat: number; lng: number };
  country: string;
  houseNumber: string;
  postcode: string;
  region: string;
  street: string;
}

interface BuildingProperties {
  commentsCount: number;
  could_buy_count: number;
  could_sell_count: number;
  lastCommented: string;
  like_count: number;
  report_is_empty: boolean;
  subscribersCount: number;
}

interface Building {
  id: string;
  addresses: Address[];
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: BuildingProperties;
}

interface BuildingsLayerProps {
  buildings: Building[];
  minZoom?: number;
  hexScores?: Record<string, number>;
  h3Resolution?: number;
  travelTimeFilter?: TravelTimeRange | null;
  onVisibleBuildingCountChange?: (count: number) => void;
}

// Home icon using SVG - green with black outline
const buildingIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#48bb78" stroke="#000" stroke-width="1" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/>
</svg>
`;

const buildingIcon = L.divIcon({
  html: buildingIconSvg,
  className: 'building-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

// Get center point of a polygon
function getPolygonCenter(coordinates: number[][][]): { lat: number; lng: number } {
  const ring = coordinates[0]; // Outer ring
  let sumLat = 0;
  let sumLng = 0;

  for (const [lng, lat] of ring) {
    sumLat += lat;
    sumLng += lng;
  }

  return {
    lat: sumLat / ring.length,
    lng: sumLng / ring.length,
  };
}

function travelTimeInRange(minutes: number, range: TravelTimeRange): boolean {
  if (minutes < range.min) return false;
  if (range.max === null) return true;
  return minutes <= range.max;
}

export function BuildingsLayer({ buildings, minZoom = 14, hexScores, h3Resolution = 9, travelTimeFilter = null, onVisibleBuildingCountChange }: BuildingsLayerProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());

  // Filter buildings to those in view and (if filter active) within travel time range
  const visibleBuildings = useMemo(() => {
    if (zoom < minZoom) {
      return [];
    }
    return buildings.filter((building) => {
      const center = building.addresses[0]?.coordinates || getPolygonCenter(building.geometry.coordinates);
      if (!bounds.contains([center.lat, center.lng])) return false;
      if (travelTimeFilter === null) return true;
      const hexId = latLngToCell(center.lat, center.lng, h3Resolution);
      const travelTime = hexScores?.[hexId];
      if (travelTime === undefined) return false;
      return travelTimeInRange(travelTime, travelTimeFilter);
    });
  }, [buildings, bounds, zoom, minZoom, travelTimeFilter, hexScores, h3Resolution]);

  useEffect(() => {
    onVisibleBuildingCountChange?.(visibleBuildings.length);
  }, [visibleBuildings.length, onVisibleBuildingCountChange]);

  // Track map changes
  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    moveend: () => {
      setBounds(map.getBounds());
    },
  });

  // Initialize bounds on mount
  useEffect(() => {
    setBounds(map.getBounds());
  }, [map]);

  // Only show buildings at higher zoom levels
  if (zoom < minZoom) {
    return null;
  }

  return (
    <>
      {visibleBuildings.map((building) => {
        const center = building.addresses[0]?.coordinates || getPolygonCenter(building.geometry.coordinates);
        const address = building.addresses[0];

        // Get travel time for this building's location
        const hexId = latLngToCell(center.lat, center.lng, h3Resolution);
        const travelTime = hexScores?.[hexId];

        return (
          <Marker
            key={building.id}
            position={[center.lat, center.lng]}
            icon={buildingIcon}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                {address ? (
                  <>
                    <strong>{address.street} {address.houseNumber}</strong>
                    <br />
                    {address.postcode} {address.city}
                  </>
                ) : (
                  <strong>Building {building.id}</strong>
                )}
                {travelTime !== undefined && (
                  <div style={{ marginTop: 8, padding: '4px 0', borderTop: '1px solid #eee' }}>
                    <span style={{ color: '#666' }}>Travel to center:</span>{' '}
                    <strong>{travelTime} min</strong>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
