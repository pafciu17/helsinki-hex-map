import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getHexBoundary } from '../utils/h3';
import { getTravelTimeColor } from '../utils/colors';
import { formatTravelTime, HexScoreMap } from '../utils/scoring';

interface HexLayerProps {
  hexIds: string[];
  scores: HexScoreMap;
  onHexHover: (hexId: string | null, travelTime: number | null) => void;
  onHexClick: (hexId: string, travelTime: number) => void;
}

export function HexLayer({ hexIds, scores, onHexHover, onHexClick }: HexLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);

  useEffect(() => {
    // Remove previous layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Create Canvas renderer for performance (reuse if exists)
    if (!rendererRef.current) {
      rendererRef.current = L.canvas({ padding: 0.5 });
    }
    const canvasRenderer = rendererRef.current;

    // Build GeoJSON FeatureCollection
    const features = hexIds.map((hexId) => {
      const boundary = getHexBoundary(hexId);
      const travelTime = scores[hexId] ?? 60;

      return {
        type: 'Feature' as const,
        properties: {
          hexId,
          travelTime,
        },
        geometry: {
          type: 'Polygon' as const,
          // GeoJSON uses [lng, lat] order
          coordinates: [boundary.map(([lat, lng]) => [lng, lat])],
        },
      };
    });

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Create layer
    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const travelTime = feature?.properties?.travelTime ?? 60;
        const color = getTravelTimeColor(travelTime);
        return {
          fillColor: color,
          fillOpacity: 0.6,
          color: color,
          weight: 1,
          opacity: 0.8,
          renderer: canvasRenderer,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const { hexId, travelTime } = feature.properties;

        featureLayer.bindTooltip(
          `<strong>${formatTravelTime(travelTime)}</strong> to city center`,
          { sticky: true }
        );

        featureLayer.on({
          mouseover: () => onHexHover(hexId, travelTime),
          mouseout: () => onHexHover(null, null),
          click: () => onHexClick(hexId, travelTime),
        });
      },
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [hexIds, scores, map, onHexHover, onHexClick]);

  return null;
}
