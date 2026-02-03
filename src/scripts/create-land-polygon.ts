/**
 * Create a combined land polygon for Helsinki:
 * - Mainland polygon (northern Helsinki, all land)
 * - Island polygons from coastline data
 */

import * as fs from 'fs';
import * as path from 'path';

// The mainland of Helsinki - a polygon that covers the land areas
// This is traced to follow the actual coastline more closely
const MAINLAND_POLYGON: [number, number][] = [
  // Start from northwest corner and trace the coastline
  // Northwest - Espoo border (land boundary)
  [24.7828, 60.10],
  [24.7828, 60.30],  // Northern border (all land)
  [25.26, 60.30],    // Northeast corner
  [25.26, 60.20],    // East side going south

  // Eastern coastline (Vuosaari area) - tracing land
  [25.22, 60.20],
  [25.20, 60.195],
  [25.17, 60.19],

  // Southeastern coastline
  [25.14, 60.185],
  [25.10, 60.18],
  [25.07, 60.175],
  [25.05, 60.175],
  [25.03, 60.172],

  // Kulosaari/Herttoniemi area
  [25.02, 60.17],
  [25.00, 60.168],
  [24.98, 60.165],

  // Southern peninsula - city center
  [24.96, 60.162],
  [24.94, 60.158],
  [24.92, 60.155],
  [24.90, 60.153],
  [24.88, 60.152],
  [24.87, 60.155],

  // Southwest - Lauttasaari area (following coastline)
  [24.86, 60.158],
  [24.85, 60.162],
  [24.84, 60.168],
  [24.83, 60.175],
  [24.82, 60.182],
  [24.81, 60.19],
  [24.80, 60.20],

  // West side going north back to start
  [24.7828, 60.20],
  [24.7828, 60.10],  // Close the polygon
];

// Read the island polygons we extracted
const islandsPath = path.join(process.cwd(), 'src/data/helsinki-land.geojson');
const islandsData = JSON.parse(fs.readFileSync(islandsPath, 'utf-8'));

// Create the combined GeoJSON with mainland + islands
const combinedFeatures = [
  // Mainland as the first (and largest) feature
  {
    type: 'Feature' as const,
    properties: { id: 'mainland', name: 'Helsinki Mainland' },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [MAINLAND_POLYGON]  // [lng, lat] format for GeoJSON
    }
  },
  // Add all island features
  ...islandsData.features.map((f: any, i: number) => ({
    ...f,
    properties: { ...f.properties, id: `island-${i}`, name: `Island ${i}` }
  }))
];

const combinedGeojson = {
  type: 'FeatureCollection' as const,
  features: combinedFeatures
};

// Save the combined land polygon
const outputPath = path.join(process.cwd(), 'src/data/helsinki-land-combined.geojson');
fs.writeFileSync(outputPath, JSON.stringify(combinedGeojson, null, 2));

console.log(`Created combined land polygon with ${combinedFeatures.length} features`);
console.log(`  - 1 mainland polygon`);
console.log(`  - ${islandsData.features.length} island polygons`);
console.log(`Saved to: ${outputPath}`);
