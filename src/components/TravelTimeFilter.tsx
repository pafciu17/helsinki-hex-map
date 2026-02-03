import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TravelTimeRange {
  min: number;
  max: number | null; // null = no upper bound (45+)
}

const SLIDER_MIN = 0;
const SLIDER_MAX = 90;
const TRACK_WIDTH = 240;
const TRACK_HEIGHT = 8;
const THUMB_SIZE = 16;

interface TravelTimeFilterProps {
  value: TravelTimeRange | null;
  onChange: (range: TravelTimeRange | null) => void;
  buildingCount?: number;
  zoom?: number;
  buildingMinZoom?: number;
}

function rangeToSlider(value: TravelTimeRange | null): { min: number; max: number } {
  if (value === null) return { min: SLIDER_MIN, max: SLIDER_MAX };
  return {
    min: value.min,
    max: value.max ?? SLIDER_MAX,
  };
}

function sliderToRange(min: number, max: number): TravelTimeRange | null {
  if (min <= SLIDER_MIN && max >= SLIDER_MAX) return null;
  return {
    min,
    max: max >= SLIDER_MAX ? null : max,
  };
}

function formatRange(value: TravelTimeRange | null): string {
  if (value === null) return 'All';
  if (value.max === null) return `${value.min}+ min`;
  return `${value.min} – ${value.max} min`;
}

// Convert value (0–90) to left % (0 = left, 90 = right)
function valueToPercent(value: number): number {
  return (value / SLIDER_MAX) * 100;
}

// Convert clientX relative to track to value (0–90); track left = 0, right = 90
function clientXToValue(clientX: number, trackRect: DOMRect): number {
  const x = clientX - trackRect.left;
  const fraction = x / trackRect.width;
  return Math.round(Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, fraction * SLIDER_MAX)));
}

export function TravelTimeFilter({ value, onChange, buildingCount = 0, zoom, buildingMinZoom = 14 }: TravelTimeFilterProps) {
  const slider = useMemo(() => rangeToSlider(value), [value]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const updateFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const val = clientXToValue(e.clientX, rect);

      if (dragging === 'min') {
        const newMin = Math.min(val, slider.max);
        onChange(sliderToRange(newMin, slider.max));
      } else if (dragging === 'max') {
        const newMax = Math.max(val, slider.min);
        onChange(sliderToRange(slider.min, newMax));
      }
    },
    [dragging, slider.min, slider.max, onChange]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging) updateFromEvent(e);
    },
    [dragging, updateFromEvent]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging === null) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const displayText = formatRange(value);
  const isZoomedOut = zoom !== undefined && zoom < buildingMinZoom;

  const minPercent = valueToPercent(slider.min);
  const maxPercent = valueToPercent(slider.max);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        zIndex: 1000,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        opacity: isZoomedOut ? 0.75 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      {isZoomedOut && (
        <div
          style={{
            marginBottom: '8px',
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: '#fef3c7',
            fontSize: '11px',
            color: '#92400e',
          }}
        >
          Zoom in to see buildings
        </div>
      )}
      <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '12px', color: '#374151' }}>
        Travel time to center
      </div>
      <div
        style={{
          marginBottom: '10px',
          padding: '6px 10px',
          borderRadius: '4px',
          backgroundColor: '#f1f5f9',
          fontSize: '13px',
          fontWeight: 600,
          color: '#475569',
        }}
      >
        {displayText}
      </div>
      {value !== null && (
        <div style={{ marginBottom: '8px', fontSize: '11px', color: '#64748b' }}>
          {buildingCount} building{buildingCount !== 1 ? 's' : ''} in range
        </div>
      )}
      <div>
        <div
          ref={trackRef}
          style={{
            position: 'relative',
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: 4,
            backgroundColor: '#e5e7eb',
            marginBottom: 8,
          }}
        >
          {/* Filled range between the two thumbs */}
          <div
            style={{
              position: 'absolute',
              left: `${minPercent}%`,
              top: 0,
              width: `${maxPercent - minPercent}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: '#64748b',
              pointerEvents: 'none',
            }}
          />
          {/* Min handle (left = lower value) */}
          <div
            role="slider"
            aria-valuemin={SLIDER_MIN}
            aria-valuemax={SLIDER_MAX}
            aria-valuenow={slider.min}
            aria-label="Minimum travel time"
            tabIndex={0}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging('min');
            }}
            style={{
              position: 'absolute',
              left: `${minPercent}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '2px solid #64748b',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              cursor: 'ew-resize',
              zIndex: 2,
            }}
          />
          {/* Max handle */}
          <div
            role="slider"
            aria-valuemin={SLIDER_MIN}
            aria-valuemax={SLIDER_MAX}
            aria-valuenow={slider.max}
            aria-label="Maximum travel time"
            tabIndex={0}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging('max');
            }}
            style={{
              position: 'absolute',
              left: `${maxPercent}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '2px solid #64748b',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              cursor: 'ew-resize',
              zIndex: 2,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#9ca3af',
          }}
        >
          <span>0</span>
          <span>{SLIDER_MAX} min</span>
        </div>
      </div>
    </div>
  );
}
