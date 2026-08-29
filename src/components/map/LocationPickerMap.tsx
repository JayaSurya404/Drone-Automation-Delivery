import React, { useEffect, useRef, useState } from 'react';
import { LeafletMapProvider } from '../../services/mapProvider';
import { useTheme } from '../../context/ThemeContext';
import { Crosshair, MapPin } from 'lucide-react';
import { Button } from '../common/Button';

interface LocationPickerMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  initialLat = 37.7749,
  initialLng = -122.4194,
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

  useEffect(() => {
    if (!containerRef.current) return;

    const provider = new LeafletMapProvider();
    mapProviderRef.current = provider;

    provider.initialize({
      containerElement: containerRef.current,
      initialViewport: {
        center: [initialLat, initialLng],
        zoom: 14,
      },
      isInteractive: true,
      theme,
      onLocationSelect: (lat, lng) => {
        setCoords({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
        onLocationChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
      },
    }).then(() => {
      provider.updateDestination(initialLat, initialLng, 'Drag to adjust exact landing spot');
      // Draw 15km SkyHub geofence circle
      provider.setGeofenceRadius(37.7625, -122.4480, 15000);
    });

    return () => {
      provider.destroy();
      mapProviderRef.current = null;
    };
  }, [theme]);

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

        <div className="map-overlay-badge">
          <MapPin size={16} color="#00e5ff" />
          <span>Click map or drag marker to set exact drop-off spot</span>
        </div>

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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-tertiary)' }}>GPS Coordinates: </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {coords.lat.toFixed(4)}° N, {Math.abs(coords.lng).toFixed(4)}° W
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Crosshair size={14} />}
          onClick={handleUseCurrentLocation}
        >
          Use My GPS Location
        </Button>
      </div>
    </div>
  );
};
