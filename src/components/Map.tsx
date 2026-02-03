import { useState, useMemo, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { HexLayer } from './HexLayer';
import { BuildingsLayer } from './BuildingsLayer';
import { Legend } from './Legend';
import { InfoPanel } from './InfoPanel';
import { TravelTimeFilter, type TravelTimeRange } from './TravelTimeFilter';
import { generateHexesInBounds, CITY_CENTER, getH3ResolutionForZoom, MapBounds, getBuildingHexIds } from '../utils/h3';
import { HexScoreMap, aggregateScoresToResolution } from '../utils/scoring';
import hexScoresData from '../data/hex-scores.json';
import buildingsData from '../data/buildings.json';

import 'leaflet/dist/leaflet.css';

const baseHexScores: HexScoreMap = hexScoresData;

interface MapEventsHandlerProps {
  onZoomChange: (zoom: number) => void;
  onBoundsChange: (bounds: MapBounds) => void;
}

function getBoundsFromMap(map: L.Map): MapBounds {
  const b = map.getBounds();
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}

function MapEventsHandler({ onZoomChange, onBoundsChange }: MapEventsHandlerProps) {
  const map = useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
      onBoundsChange(getBoundsFromMap(e.target));
    },
    moveend: (e) => {
      onBoundsChange(getBoundsFromMap(e.target));
    },
    load: (e) => {
      onBoundsChange(getBoundsFromMap(e.target));
    },
  });

  // Set initial bounds on mount
  useEffect(() => {
    onBoundsChange(getBoundsFromMap(map));
  }, [map, onBoundsChange]);

  return null;
}

const INITIAL_ZOOM = 12;

// Initial bounds roughly covering Helsinki (will be updated on map load)
const INITIAL_BOUNDS: MapBounds = {
  north: 60.25,
  south: 60.10,
  east: 25.05,
  west: 24.85,
};

export function Map() {
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [hoveredTravelTime, setHoveredTravelTime] = useState<number | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [selectedTravelTime, setSelectedTravelTime] = useState<number | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [bounds, setBounds] = useState<MapBounds>(INITIAL_BOUNDS);
  const [travelTimeFilter, setTravelTimeFilter] = useState<TravelTimeRange | null>(null);
  const [buildingCount, setBuildingCount] = useState(0);

  const h3Resolution = getH3ResolutionForZoom(zoom);

  // Compute hex IDs that contain buildings (at all resolutions)
  const buildingHexes = useMemo(() => {
    return getBuildingHexIds((buildingsData as any).features, [6, 7, 8, 9]);
  }, []);

  // Aggregate scores first (this determines which hexes have data)
  const hexScores = useMemo(() => {
    return aggregateScoresToResolution(baseHexScores, h3Resolution);
  }, [h3Resolution]);

  // Only show hexes that have buildings in them
  const hexIds = useMemo(() => {
    const boundsHexes = generateHexesInBounds(h3Resolution, bounds);
    const withScores = boundsHexes.filter((hexId) => hexId in hexScores);
    // Filter to only hexes that contain buildings
    const buildingHexSet = buildingHexes.get(h3Resolution);
    if (!buildingHexSet) return withScores;
    return withScores.filter((hexId) => buildingHexSet.has(hexId));
  }, [h3Resolution, bounds, hexScores, buildingHexes]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    // Clear selection when zoom changes as hex IDs change
    setSelectedHex(null);
    setSelectedTravelTime(null);
  }, []);

  const handleBoundsChange = useCallback((newBounds: MapBounds) => {
    setBounds(newBounds);
  }, []);

  const handleHexHover = useCallback((hexId: string | null, travelTime: number | null) => {
    setHoveredHex(hexId);
    setHoveredTravelTime(travelTime);
  }, []);

  const handleHexClick = useCallback((hexId: string, travelTime: number) => {
    setSelectedHex(hexId);
    setSelectedTravelTime(travelTime);
  }, []);

  // Show selected hex info, or hovered hex info, or default prompt
  const displayHexId = selectedHex ?? hoveredHex;
  const displayTravelTime = selectedHex ? selectedTravelTime : hoveredTravelTime;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <MapContainer
        center={[CITY_CENTER.lat, CITY_CENTER.lng]}
        zoom={INITIAL_ZOOM}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventsHandler onZoomChange={handleZoomChange} onBoundsChange={handleBoundsChange} />
        <HexLayer
          hexIds={hexIds}
          scores={hexScores}
          onHexHover={handleHexHover}
          onHexClick={handleHexClick}
        />
        <BuildingsLayer
          buildings={(buildingsData as any).features}
          minZoom={14}
          hexScores={hexScores}
          h3Resolution={h3Resolution}
          travelTimeFilter={travelTimeFilter}
          onVisibleBuildingCountChange={setBuildingCount}
        />
      </MapContainer>
      <TravelTimeFilter
        value={travelTimeFilter}
        onChange={setTravelTimeFilter}
        buildingCount={buildingCount}
        zoom={zoom}
        buildingMinZoom={14}
      />
      <InfoPanel
        hexId={displayHexId}
        travelTime={displayTravelTime}
        resolution={h3Resolution}
        hexCount={hexIds.length}
      />
      <Legend />
    </div>
  );
}
