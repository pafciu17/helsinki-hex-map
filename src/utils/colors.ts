/**
 * Color scale for travel times
 * 0-15 min: Green
 * 15-30 min: Yellow
 * 30-45 min: Orange
 * 45+ min: Red
 */

export interface ColorStop {
  min: number;
  max: number;
  color: string;
  label: string;
}

export const COLOR_STOPS: ColorStop[] = [
  { min: 0, max: 15, color: '#22c55e', label: '0-15 min' },
  { min: 15, max: 30, color: '#eab308', label: '15-30 min' },
  { min: 30, max: 45, color: '#f97316', label: '30-45 min' },
  { min: 45, max: Infinity, color: '#ef4444', label: '45+ min' },
];

/**
 * Get the color for a given travel time in minutes
 */
export function getTravelTimeColor(minutes: number): string {
  for (const stop of COLOR_STOPS) {
    if (minutes >= stop.min && minutes < stop.max) {
      return stop.color;
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].color;
}

/**
 * Get a color with specified opacity for polygon fill
 */
export function getColorWithOpacity(color: string, opacity: number): string {
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
