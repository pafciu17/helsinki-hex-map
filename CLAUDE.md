# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Helsinki Hex Map is a React + TypeScript application that visualizes travel times from different areas of Helsinki to the city center (Helsinki Railway Station) using H3 hexagonal grids. It uses Leaflet for mapping and canvas rendering for performant hexagon display.

## Commands

```bash
# Development server (Vite, runs on localhost:5173)
npm run dev

# Production build (TypeScript check + Vite bundle)
npm run build

# Preview production build
npm run preview

# Fetch live travel times from Digitransit API (takes several minutes)
npm run fetch-data

# Generate mock travel data (quick alternative for testing)
npm run generate-sample-data
```

## Architecture

### Key Components
- **Map.tsx**: Main map container with zoom/bounds handling
- **HexLayer.tsx**: H3 hexagon rendering using Leaflet canvas
- **InfoPanel.tsx**: Top-left info display for selected hex
- **Legend.tsx**: Color legend for travel times

### Utilities
- **utils/h3.ts**: H3 hexagon utilities, coordinate handling, Helsinki boundary polygon
- **utils/colors.ts**: Travel time → color mapping (green/yellow/orange/red gradient)
- **utils/scoring.ts**: Travel time data aggregation and formatting

### Data Flow
1. `fetch-travel-times.ts` calls Digitransit GraphQL API to get travel times
2. Results saved to `src/data/hex-scores.json`
3. Data imported statically at build time (no runtime API calls)
4. Parent hexagons computed as averages of child hex travel times when zooming out

### Dynamic H3 Resolution
Hexagon size adapts to zoom level:
- Zoom ≤10: Resolution 6 (~3.2km)
- Zoom ≤12: Resolution 7 (~1.2km)
- Zoom ≤13: Resolution 8 (~460m)
- Zoom >13: Resolution 9 (~170m)

### External APIs
- **Digitransit API** (api.digitransit.fi): GraphQL endpoint for Helsinki region travel times
- **OpenStreetMap**: Tile layer provider

## Tech Stack
- React 18 + TypeScript 5
- Vite for build/dev
- Leaflet + react-leaflet for mapping
- h3-js for hexagonal grid system
