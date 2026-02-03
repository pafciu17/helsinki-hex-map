/**
 * Process OSM coastline data into a land polygon GeoJSON
 *
 * OSM coastlines follow the convention: water is on the right side when following the way direction.
 * This means for land areas, the coastline is traced counter-clockwise.
 */

import * as fs from 'fs';
import * as path from 'path';

interface OsmGeometryPoint {
  lat: number;
  lon: number;
}

interface OsmWay {
  type: 'way';
  id: number;
  geometry: OsmGeometryPoint[];
  nodes: number[];
}

interface OsmData {
  elements: OsmWay[];
}

// Helsinki area bounds (slightly expanded)
const BOUNDS = {
  minLat: 60.10,
  maxLat: 60.30,
  minLon: 24.78,
  maxLon: 25.25
};

function processCoastlineData(inputPath: string, outputPath: string) {
  console.log('Reading coastline data...');
  const rawData = fs.readFileSync(inputPath, 'utf-8');
  const osmData: OsmData = JSON.parse(rawData);

  console.log(`Found ${osmData.elements.length} coastline ways`);

  // Extract all coastline segments
  const segments: [number, number][][] = [];

  for (const element of osmData.elements) {
    if (element.type === 'way' && element.geometry) {
      const coords: [number, number][] = element.geometry.map(p => [p.lon, p.lat]);
      segments.push(coords);
    }
  }

  console.log(`Extracted ${segments.length} segments`);

  // Try to merge segments into closed rings
  const rings = mergeSegments(segments);
  console.log(`Merged into ${rings.length} rings`);

  // Filter to rings that are within our bounds and are significant (not tiny islands)
  const significantRings = rings.filter(ring => {
    const area = calculateRingArea(ring);
    return area > 0.0001; // Filter out very small features
  });

  console.log(`${significantRings.length} significant rings after filtering`);

  // Create GeoJSON
  const geojson = {
    type: 'FeatureCollection' as const,
    features: significantRings.map((ring, i) => ({
      type: 'Feature' as const,
      properties: { id: i },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring]
      }
    }))
  };

  // Also create a simplified combined polygon for the main land mass
  // Find the largest ring (mainland Helsinki)
  const sortedByArea = [...significantRings].sort((a, b) =>
    calculateRingArea(b) - calculateRingArea(a)
  );

  const mainLandFeatures = sortedByArea.slice(0, 50); // Top 50 land masses (mainland + major islands)

  const combinedGeojson = {
    type: 'FeatureCollection' as const,
    features: mainLandFeatures.map((ring, i) => ({
      type: 'Feature' as const,
      properties: { id: i, area: calculateRingArea(ring) },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring]
      }
    }))
  };

  fs.writeFileSync(outputPath, JSON.stringify(combinedGeojson, null, 2));
  console.log(`Wrote land polygons to ${outputPath}`);

  // Print some stats
  console.log('\nTop 10 land masses by area:');
  mainLandFeatures.slice(0, 10).forEach((ring, i) => {
    console.log(`  ${i + 1}. Area: ${calculateRingArea(ring).toFixed(6)}`);
  });
}

function mergeSegments(segments: [number, number][][]): [number, number][][] {
  const rings: [number, number][][] = [];
  const used = new Set<number>();

  // Build an index of segment endpoints
  const startIndex = new Map<string, number[]>();
  const endIndex = new Map<string, number[]>();

  segments.forEach((seg, i) => {
    if (seg.length < 2) return;

    const startKey = coordKey(seg[0]);
    const endKey = coordKey(seg[seg.length - 1]);

    if (!startIndex.has(startKey)) startIndex.set(startKey, []);
    if (!endIndex.has(endKey)) endIndex.set(endKey, []);

    startIndex.get(startKey)!.push(i);
    endIndex.get(endKey)!.push(i);
  });

  // Try to form rings by connecting segments
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;

    const seg = segments[i];
    if (seg.length < 2) continue;

    // Check if this segment is already a closed ring
    if (coordKey(seg[0]) === coordKey(seg[seg.length - 1])) {
      rings.push([...seg]);
      used.add(i);
      continue;
    }

    // Try to build a ring starting from this segment
    const ring: [number, number][] = [...seg];
    used.add(i);

    let iterations = 0;
    const maxIterations = 10000;

    while (iterations++ < maxIterations) {
      const currentEnd = ring[ring.length - 1];
      const endKey = coordKey(currentEnd);

      // Check if we've closed the ring
      if (coordKey(ring[0]) === endKey && ring.length > 3) {
        rings.push(ring);
        break;
      }

      // Find a segment that starts where we end
      const candidates = startIndex.get(endKey) || [];
      let found = false;

      for (const candIdx of candidates) {
        if (used.has(candIdx)) continue;

        const candSeg = segments[candIdx];
        ring.push(...candSeg.slice(1)); // Skip first point (it's the same as our end)
        used.add(candIdx);
        found = true;
        break;
      }

      if (!found) {
        // Try reversed segments (segments that end where we end)
        const reverseCandidates = endIndex.get(endKey) || [];
        for (const candIdx of reverseCandidates) {
          if (used.has(candIdx)) continue;

          const candSeg = [...segments[candIdx]].reverse();
          ring.push(...candSeg.slice(1));
          used.add(candIdx);
          found = true;
          break;
        }
      }

      if (!found) {
        // Can't continue this ring, save what we have if it's significant
        if (ring.length > 10) {
          // Close it artificially
          ring.push(ring[0]);
          rings.push(ring);
        }
        break;
      }
    }
  }

  return rings;
}

function coordKey(coord: [number, number]): string {
  return `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
}

function calculateRingArea(ring: [number, number][]): number {
  // Shoelace formula for polygon area
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1];
    area -= ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(area / 2);
}

// Run the script
const inputPath = '/tmp/helsinki_coastline.json';
const outputPath = path.join(process.cwd(), 'src/data/helsinki-land.geojson');

processCoastlineData(inputPath, outputPath);
