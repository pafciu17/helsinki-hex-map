import { cellToParent } from 'h3-js';
import { getTravelTimeColor } from './colors';
import { BASE_H3_RESOLUTION } from './h3';

export interface HexScore {
  hexId: string;
  travelTimeMinutes: number;
}

export interface HexScoreMap {
  [hexId: string]: number; // travel time in minutes
}

/**
 * Get the score display info for a hex
 */
export function getScoreInfo(travelTimeMinutes: number) {
  return {
    minutes: travelTimeMinutes,
    color: getTravelTimeColor(travelTimeMinutes),
    label: formatTravelTime(travelTimeMinutes),
  };
}

/**
 * Format travel time for display
 */
export function formatTravelTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Aggregate base resolution scores to a lower resolution
 * Uses average of child hex scores
 */
export function aggregateScoresToResolution(
  baseScores: HexScoreMap,
  targetResolution: number
): HexScoreMap {
  if (targetResolution >= BASE_H3_RESOLUTION) {
    return baseScores;
  }

  const aggregated: Map<string, number[]> = new Map();

  // Group base hexes by their parent at target resolution
  for (const [hexId, score] of Object.entries(baseScores)) {
    const parentHex = cellToParent(hexId, targetResolution);
    if (!aggregated.has(parentHex)) {
      aggregated.set(parentHex, []);
    }
    aggregated.get(parentHex)!.push(score);
  }

  // Calculate average for each parent hex
  const result: HexScoreMap = {};
  for (const [hexId, scores] of aggregated) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    result[hexId] = Math.round(avg);
  }

  return result;
}
