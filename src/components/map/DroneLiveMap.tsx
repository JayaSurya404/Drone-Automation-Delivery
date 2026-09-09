import React, { useEffect, useRef, useState } from 'react';
import { LeafletMapProvider } from '../../services/mapProvider';
import { DroneLocation, HubLocation } from '../../types/tracking';
import { api } from '../../services/api';
import { Maximize2, ShieldAlert } from 'lucide-react';

interface DroneLiveMapProps {
  droneLocation: DroneLocation;
  hubLocation: HubLocation;
  destinationLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  flightRoute: [number, number][];
  className?: string;
  height?: string;
}

export const DroneLiveMap: React.FC<DroneLiveMapProps> = ({
  droneLocation,
  hubLocation,
  destinationLocation,
  flightRoute,
  height = '500px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapProviderRef = useRef<LeafletMapProvider | null>(null);
  const [isAirspaceVisible, setIsAirspaceVisible] = useState<boolean>(true);

  // Initialize Map Once on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    const provider = new LeafletMapProvider();
    mapProviderRef.current = provider;

    const midLat = (hubLocation.latitude + destinationLocation.latitude) / 2;
    const midLng = (hubLocation.longitude + destinationLocation.longitude) / 2;

    provider
      .initialize({
        containerElement: containerRef.current,
        initialViewport: {
          center: [midLat, midLng],
          zoom: 13,
        },
        isInteractive: true,
      })
      .then(async () => {
        provider.updateHub(hubLocation);
        provider.updateDestination(
          destinationLocation.latitude,
          destinationLocation.longitude,
          destinationLocation.address
        );
        provider.setClearanceRadius(3.5, true);
        provider.setFlightRoute(flightRoute);
        provider.updateDronePosition(droneLocation);

        // Fetch and draw active No-Fly Zones
        try {
          const { zones } = await api.airspace.getZones();
          if (zones && zones.length > 0) {
            provider.setNoFlyZones(zones);
          }
        } catch (e) {
          console.warn('Could not load NFZ zones for live map:', e);
        }

        provider.fitBounds([
          [hubLocation.latitude, hubLocation.longitude],
          [destinationLocation.latitude, destinationLocation.longitude],
          [droneLocation.latitude, droneLocation.longitude],
        ]);
      });

    return () => {
      provider.destroy();
      mapProviderRef.current = null;
    };
  }, []); // Mount only

  // Smoothly update drone position marker when coordinates change
  useEffect(() => {
    if (mapProviderRef.current) {
      mapProviderRef.current.updateDronePosition(droneLocation);
    }
  }, [droneLocation.latitude, droneLocation.longitude, droneLocation.bearing]);

  const handleToggleAirspace = () => {
    const nextState = !isAirspaceVisible;
    setIsAirspaceVisible(nextState);
    if (mapProviderRef.current) {
      mapProviderRef.current.toggleAirspaceLayer(nextState);
    }
  };

  const handleRecenter = () => {
    if (mapProviderRef.current) {
      mapProviderRef.current.fitBounds([
        [hubLocation.latitude, hubLocation.longitude],
        [destinationLocation.latitude, destinationLocation.longitude],
        [droneLocation.latitude, droneLocation.longitude],
      ]);
    }
  };

  return (
    <div className="map-wrapper" style={{ height }}>
      <div ref={containerRef} className="map-container" style={{ height: '100%' }} />

      {/* Floating Status Badge */}
      <div className="map-overlay-badge">
        <span className="pulse-dot cyan" />
        <span>Live Autonomous Flight Path</span>
      </div>

      {/* Floating Airspace Radar Controls */}
      <div className="airspace-map-toolbar">
        <button
          type="button"
          onClick={handleToggleAirspace}
          className={`airspace-toggle-btn ${isAirspaceVisible ? 'active' : ''}`}
          title="Toggle No-Fly Zone Radar Layer"
        >
          <ShieldAlert size={14} color={isAirspaceVisible ? '#ef4444' : 'var(--text-tertiary)'} />
          <span>Airspace NFZ: {isAirspaceVisible ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Floating Controls */}
      <div className="map-controls-floating">
        <button
          type="button"
          className="map-btn"
          onClick={handleRecenter}
          title="Fit flight bounds"
          aria-label="Fit flight bounds"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
};
