import { polygonToCells, cellToBoundary, cellToLatLng, cellToParent, latLngToCell } from 'h3-js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, multiPolygon } from '@turf/helpers';
import type { Feature, MultiPolygon } from 'geojson';
import landData from '../data/helsinki-land.json';

// Helsinki bounds as a polygon following the coastline (excluding sea)
// Coordinates are [lat, lng] pairs tracing the land area
const HELSINKI_POLYGON: [number, number][] = [
  // Western edge - Espoo border area
  [60.295, 24.82],
  [60.275, 24.80],
  [60.245, 24.80],
  [60.225, 24.82],
  // Southwest coast - Lauttasaari area
  [60.185, 24.83],
  [60.165, 24.85],
  [60.155, 24.87],
  // Southern peninsula - city center coastline
  [60.150, 24.91],
  [60.153, 24.95],
  [60.155, 24.98],
  // Southeast - Kulosaari, Herttoniemi
  [60.165, 25.02],
  [60.175, 25.05],
  // East - Vuosaari area
  [60.195, 25.08],
  [60.205, 25.11],
  [60.215, 25.14],
  // Northeast corner
  [60.245, 25.15],
  [60.275, 25.14],
  [60.295, 25.10],
  // Northern edge
  [60.295, 25.00],
  [60.295, 24.90],
  // Close polygon
  [60.295, 24.82],
];

// Create a MultiPolygon from the land data for efficient point-in-polygon checks
const landPolygons: Feature<MultiPolygon> = multiPolygon(
  (landData as any).features.map((f: any) => f.geometry.coordinates)
);

// Helsinki Railway Station - city center reference point
export const CITY_CENTER = {
  lat: 60.1699,
  lng: 24.9384,
};

// Base resolution for stored data
export const BASE_H3_RESOLUTION = 9;

// Map zoom levels to H3 resolutions
// Lower zoom = larger hexes (lower resolution)
// Higher zoom = smaller hexes (higher resolution)
// Capped at BASE_H3_RESOLUTION since that's what we have data for
export function getH3ResolutionForZoom(zoom: number): number {
  if (zoom <= 10) return 6;  // ~3.2km edge, ~60 hexes
  if (zoom <= 12) return 7;  // ~1.2km edge, ~200 hexes
  if (zoom <= 13) return 8;  // ~460m edge, ~600 hexes
  return BASE_H3_RESOLUTION; // ~170m edge (only at zoom 14+)
}

/**
 * Generate all H3 hex cell IDs covering Helsinki area at given resolution
 */
export function generateHelsinkiHexes(resolution: number): string[] {
  return polygonToCells(HELSINKI_POLYGON, resolution);
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Generate H3 hex cell IDs within the given viewport bounds (intersected with Helsinki area)
 */
export function generateHexesInBounds(resolution: number, bounds: MapBounds): string[] {
  // Create polygon from viewport bounds
  const viewportPolygon: [number, number][] = [
    [bounds.south, bounds.west],
    [bounds.south, bounds.east],
    [bounds.north, bounds.east],
    [bounds.north, bounds.west],
    [bounds.south, bounds.west],
  ];

  // Generate hexes for the viewport
  const viewportHexes = polygonToCells(viewportPolygon, resolution);

  // Intersect with Helsinki bounds to avoid rendering hexes outside our data area
  const helsinkiHexSet = new Set(polygonToCells(HELSINKI_POLYGON, resolution));

  return viewportHexes.filter((hexId) => helsinkiHexSet.has(hexId));
}

/**
 * Get parent hex ID at a lower resolution
 */
export function getParentHex(hexId: string, targetResolution: number): string {
  return cellToParent(hexId, targetResolution);
}

/**
 * Get the boundary polygon coordinates for an H3 cell
 * Returns array of [lat, lng] pairs for use with Leaflet
 */
export function getHexBoundary(hexId: string): [number, number][] {
  const boundary = cellToBoundary(hexId);
  // h3-js returns [lat, lng] which is what Leaflet expects
  return boundary as [number, number][];
}

/**
 * Get the center point of an H3 cell
 */
export function getHexCenter(hexId: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(hexId);
  return { lat, lng };
}

/**
 * Check if a hex cell's center is on land (not over sea)
 */
export function isHexOnLand(hexId: string): boolean {
  const center = getHexCenter(hexId);
  const pt = point([center.lng, center.lat]); // GeoJSON uses [lng, lat]
  return booleanPointInPolygon(pt, landPolygons);
}

/**
 * Filter hex IDs to only include those on land
 */
export function filterHexesToLand(hexIds: string[]): string[] {
  return hexIds.filter(isHexOnLand);
}

/**
 * Get the H3 hex ID for a given coordinate at the specified resolution
 */
export function getHexForCoordinate(lat: number, lng: number, resolution: number): string {
  return latLngToCell(lat, lng, resolution);
}

/**
 * Get set of hex IDs that contain buildings at any resolution
 * Returns a map from resolution to Set of hex IDs
 */
export function getBuildingHexIds(
  buildings: Array<{ addresses?: Array<{ coordinates: { lat: number; lng: number } }> }>,
  resolutions: number[] = [6, 7, 8, 9]
): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();

  for (const res of resolutions) {
    result.set(res, new Set());
  }

  for (const building of buildings) {
    const coord = building.addresses?.[0]?.coordinates;
    if (!coord) continue;

    for (const res of resolutions) {
      const hexId = latLngToCell(coord.lat, coord.lng, res);
      result.get(res)!.add(hexId);
    }
  }

  return result;
}
