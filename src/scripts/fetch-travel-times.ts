import { polygonToCells, cellToLatLng } from 'h3-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Digitransit API configuration
const API_URL = 'https://api.digitransit.fi/routing/v2/hsl/gtfs/v1';
const API_KEY = process.env.DIGITRANSIT_API_KEY;
if (!API_KEY) {
  console.error('Missing DIGITRANSIT_API_KEY. Set it in .env or when running: DIGITRANSIT_API_KEY=xxx npm run fetch-data');
  process.exit(1);
}

// Helsinki Railway Station - city center destination
const CITY_CENTER = {
  lat: 60.1699,
  lng: 24.9384,
};

// Helsinki bounds following the coastline (excluding sea)
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

const H3_RESOLUTION = 9;
const DELAY_MS = 600; // Delay between requests to avoid rate limiting
const OUTPUT_PATH = join(__dirname, '../data/hex-scores.json');
const PROGRESS_PATH = join(__dirname, '../data/hex-scores-progress.json');

// Parse --part argument (e.g., --part 1/3)
function parsePartArg(): { part: number; total: number } | null {
  const partIndex = process.argv.indexOf('--part');
  if (partIndex === -1 || !process.argv[partIndex + 1]) {
    return null;
  }
  const [part, total] = process.argv[partIndex + 1].split('/').map(Number);
  if (!part || !total || part < 1 || part > total) {
    console.error('Invalid --part argument. Use format: --part 1/3');
    process.exit(1);
  }
  return { part, total };
}

interface TravelTimeResult {
  [hexId: string]: number; // travel time in minutes
}

async function fetchTravelTime(
  originLat: number,
  originLng: number
): Promise<number | null> {
  const query = `
    {
      planConnection(
        origin: {location: {coordinate: {latitude: ${originLat}, longitude: ${originLng}}}}
        destination: {location: {coordinate: {latitude: ${CITY_CENTER.lat}, longitude: ${CITY_CENTER.lng}}}}
        first: 1
      ) {
        edges {
          node {
            duration
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'digitransit-subscription-key': API_KEY,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`HTTP error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    const edges = data.data?.planConnection?.edges;
    if (!edges || edges.length === 0) {
      // No route found - location might be unreachable by transit
      return null;
    }

    const durationSeconds = edges[0].node.duration;
    return Math.round(durationSeconds / 60); // Convert to minutes
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Generating H3 hexagons for Helsinki...');
  const allHexIds = polygonToCells(HELSINKI_POLYGON, H3_RESOLUTION);
  console.log(`Total hexagons: ${allHexIds.length}`);

  // Determine which hexes to process based on --part argument
  const partConfig = parsePartArg();
  let hexIds: string[];
  let partLabel = '';

  if (partConfig) {
    const { part, total } = partConfig;
    const chunkSize = Math.ceil(allHexIds.length / total);
    const startIdx = (part - 1) * chunkSize;
    const endIdx = Math.min(part * chunkSize, allHexIds.length);
    hexIds = allHexIds.slice(startIdx, endIdx);
    partLabel = ` (part ${part}/${total})`;
    console.log(`Processing part ${part}/${total}: hexes ${startIdx + 1}-${endIdx} (${hexIds.length} hexes)`);
  } else {
    hexIds = allHexIds;
  }

  // Load existing results to merge with
  let results: TravelTimeResult = {};
  if (existsSync(OUTPUT_PATH)) {
    console.log('Loading existing results to merge...');
    results = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`Loaded ${Object.keys(results).length} existing results`);
  }

  // Load progress for this specific part if available
  const progressPath = partConfig
    ? PROGRESS_PATH.replace('.json', `-part${partConfig.part}.json`)
    : PROGRESS_PATH;

  let startIndex = 0;
  if (existsSync(progressPath)) {
    console.log('Found existing progress, resuming...');
    const progressData = JSON.parse(readFileSync(progressPath, 'utf-8'));
    // Merge progress results into main results
    results = { ...results, ...progressData.results };
    startIndex = progressData.lastIndex + 1;
    console.log(`Resuming from index ${startIndex}`);
  }

  console.log(`\nFetching travel times to city center${partLabel}...`);
  console.log(`Delay between requests: ${DELAY_MS}ms\n`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = startIndex; i < hexIds.length; i++) {
    const hexId = hexIds[i];

    // Skip if we already have this hex
    if (results[hexId] !== undefined) {
      skippedCount++;
      continue;
    }

    const [lat, lng] = cellToLatLng(hexId);
    const travelTime = await fetchTravelTime(lat, lng);

    if (travelTime !== null) {
      results[hexId] = travelTime;
      successCount++;
    } else {
      errorCount++;
    }

    // Progress update
    const progress = ((i + 1) / hexIds.length * 100).toFixed(1);
    const remaining = hexIds.length - i - 1 - skippedCount;
    const eta = Math.round((remaining * DELAY_MS) / 60000);
    process.stdout.write(
      `\r[${progress}%] ${i + 1}/${hexIds.length} | New: ${successCount} | Skipped: ${skippedCount} | Errors: ${errorCount} | ETA: ${eta}min`
    );

    // Save progress every 50 requests
    if ((i + 1) % 50 === 0) {
      writeFileSync(progressPath, JSON.stringify({ results, lastIndex: i }, null, 2));
      writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    }

    // Rate limiting delay
    if (i < hexIds.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n\nSaving results...');
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  // Clean up progress file
  if (existsSync(progressPath)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(progressPath);
  }

  console.log(`Done! Total results: ${Object.keys(results).length} hex travel times`);
  console.log(`This run: New: ${successCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
}

main().catch(console.error);
