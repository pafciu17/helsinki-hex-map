import { formatTravelTime } from '../utils/scoring';
import { getTravelTimeColor } from '../utils/colors';

interface InfoPanelProps {
  hexId: string | null;
  travelTime: number | null;
  resolution: number;
  hexCount: number;
}

export function InfoPanel({ hexId, travelTime, resolution, hexCount }: InfoPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        backgroundColor: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        minWidth: '200px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#666',
          marginBottom: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid #eee',
        }}
      >
        H3 Resolution: {resolution} • {hexCount.toLocaleString()} hexes
      </div>

      {hexId && travelTime !== null ? (
        <>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Hex Details</div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#666' }}>Travel time: </span>
            <span
              style={{
                fontWeight: 600,
                color: getTravelTimeColor(travelTime),
              }}
            >
              {formatTravelTime(travelTime)}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#999', wordBreak: 'break-all' }}>
            ID: {hexId}
          </div>
        </>
      ) : (
        <div style={{ color: '#666' }}>Hover over a hex to see details</div>
      )}
    </div>
  );
}
