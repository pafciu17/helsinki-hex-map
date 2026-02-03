/**
 * Generate sample travel time data based on distance from city center
 * This simulates realistic travel times without hitting the API
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { polygonToCells, cellToLatLng } from 'h3-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helsinki bounds
const HELSINKI_POLYGON: [number, number][] = [
  [60.15, 24.80],
  [60.15, 25.15],
  [60.30, 25.15],
  [60.30, 24.80],
  [60.15, 24.80],
];

// Base resolution - this is the resolution stored in the data file
// Lower resolutions are aggregated from this
const H3_RESOLUTION = 9;
const CITY_CENTER = { lat: 60.1699, lng: 24.9384 };

// Haversine distance in km
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate travel time based on distance with some randomness
function estimateTravelTime(distanceKm: number): number {
  // Base: ~4 min/km for public transit (including waiting/walking)
  // Add variability based on distance from major transit lines
  const baseTime = distanceKm * 4;
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  const waitingTime = 5 + Math.random() * 5; // 5-10 min waiting
  return Math.round(baseTime * randomFactor + waitingTime);
}

function main() {
  console.log('Generating Helsinki hexes...');
  const hexes = polygonToCells(HELSINKI_POLYGON, H3_RESOLUTION);
  console.log(`Found ${hexes.length} hexes`);

  const scores: Record<string, number> = {};

  for (const hexId of hexes) {
    const [lat, lng] = cellToLatLng(hexId);
    const distance = haversineDistance(lat, lng, CITY_CENTER.lat, CITY_CENTER.lng);
    const travelTime = estimateTravelTime(distance);
    scores[hexId] = Math.max(5, Math.min(90, travelTime)); // Clamp between 5-90 min
  }

  const outputPath = join(__dirname, '../data/hex-scores.json');
  writeFileSync(outputPath, JSON.stringify(scores, null, 2));
  console.log(`Saved ${Object.keys(scores).length} hex scores to ${outputPath}`);
}

main();
