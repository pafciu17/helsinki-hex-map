import { COLOR_STOPS } from '../utils/colors';

export function Legend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>
        Travel Time to City Center
      </div>
      {COLOR_STOPS.map((stop) => (
        <div
          key={stop.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '14px',
              backgroundColor: stop.color,
              marginRight: '8px',
              borderRadius: '2px',
              opacity: 0.7,
            }}
          />
          <span>{stop.label}</span>
        </div>
      ))}
    </div>
  );
}
