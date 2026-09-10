import React, { useEffect, useRef, useState } from 'react';
import { LeafletMapProvider } from '../../services/mapProvider';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { NoFlyZone } from '../../types/airspace';
import { Crosshair, MapPin, ShieldAlert, Layers, AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button';

interface LocationPickerMapProps {
  initialLat?: number;
  initialLng?: number;
  clearanceRadius?: number;
  isEligible?: boolean;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  initialLat = 11.0550,
  initialLng = 77.0650,
  clearanceRadius = 3.5,
  isEligible = true,
  onLocationChange,
  height = '340px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapProviderRef = useRef<LeafletMapProvider | null>(null);
  const { theme } = useTheme();
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });
  const [noFlyZones, setNoFlyZones] = useState<NoFlyZone[]>([]);
  const [isAirspaceVisible, setIsAirspaceVisible] = useState<boolean>(true);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    const provider = new LeafletMapProvider();
    mapProviderRef.current = provider;

    provider
      .initialize({
        containerElement: containerRef.current,
        initialViewport: {
          center: [initialLat, initialLng],
          zoom: 13,
        },
        isInteractive: true,
        theme,
        onLocationSelect: (lat, lng) => {
          const formattedLat = parseFloat(lat.toFixed(6));
          const formattedLng = parseFloat(lng.toFixed(6));
          setCoords({ lat: formattedLat, lng: formattedLng });
          onLocationChange(formattedLat, formattedLng);
        },
      })
      .then(async () => {
        provider.updateDestination(initialLat, initialLng, 'Target Landing Zone');
        provider.setClearanceRadius(clearanceRadius, isEligible);
        // Draw 12km SkyHub Chinniyampalayam Geofence boundary
        provider.setGeofenceRadius(11.0550, 77.0650, 12000);

        // Fetch active No-Fly Zones from airspace service
        try {
          const { zones } = await api.airspace.getZones();
          if (zones && zones.length > 0) {
            setNoFlyZones(zones);
            provider.setNoFlyZones(zones);
          }
        } catch (e) {
          console.warn('Could not fetch airspace zones:', e);
        }
      });

    return () => {
      provider.destroy();
      mapProviderRef.current = null;
    };
  }, [theme]);

  // Handle container resize automatically
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapProviderRef.current?.invalidateSize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update clearance radius whenever prop changes
  useEffect(() => {
    if (mapProviderRef.current) {
      mapProviderRef.current.setClearanceRadius(clearanceRadius, isEligible);
    }
  }, [clearanceRadius, isEligible]);

  // Toggle Airspace radar layers
  const handleToggleAirspace = () => {
    const nextState = !isAirspaceVisible;
    setIsAirspaceVisible(nextState);
    if (mapProviderRef.current) {
      mapProviderRef.current.toggleAirspaceLayer(nextState);
    }
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          setCoords({ lat, lng });
          onLocationChange(lat, lng);
          if (mapProviderRef.current) {
            mapProviderRef.current.updateDestination(lat, lng, 'Current Device Location');
            mapProviderRef.current.setClearanceRadius(clearanceRadius, isEligible);
            mapProviderRef.current.fitBounds([[lat, lng]]);
          }
        },
        (err) => {
          console.warn('Geolocation failed or permission denied:', err);
          alert('Could not retrieve current location. Please click on the map to place your landing marker.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="map-wrapper" style={{ height }}>
        <div ref={containerRef} className="map-container" style={{ height: '100%' }} />

        {/* Floating Airspace Controls */}
        <div className="airspace-map-toolbar">
          <button
            type="button"
            onClick={handleToggleAirspace}
            className={`airspace-toggle-btn ${isAirspaceVisible ? 'active' : ''}`}
            title="Toggle Restricted No-Fly Zones radar overlay"
          >
            <ShieldAlert size={14} color={isAirspaceVisible ? '#ef4444' : 'var(--text-tertiary)'} />
            <span>Airspace NFZ: {isAirspaceVisible ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Hint Badge */}
        <div className="map-overlay-badge">
          <MapPin size={16} color="var(--accent-blue, #0284c7)" />
          <span>Click map or drag marker to set drop-off spot</span>
        </div>

        {/* Floating Controls */}
        <div className="map-controls-floating">
          <button
            type="button"
            className="map-btn"
            onClick={handleUseCurrentLocation}
            title="Use current GPS location"
            aria-label="Use current GPS location"
          >
            <Crosshair size={18} />
          </button>
        </div>
      </div>

      {/* Airspace Map Legend & Coordinate Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-tertiary, #f8fafc)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          border: '1px solid var(--border-subtle, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>GPS Coordinates: </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {coords.lat.toFixed(4)}° N, {Math.abs(coords.lng).toFixed(4)}° W
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>{clearanceRadius}m Target Ring</span>
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span>Prohibited NFZ</span>
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span>Caution Corridor</span>
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Crosshair size={14} />}
          onClick={handleUseCurrentLocation}
        >
          My GPS Location
        </Button>
      </div>
    </div>
  );
};
