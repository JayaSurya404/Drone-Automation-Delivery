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

  const hasInitialFitRef = useRef<boolean>(false);

  // Initialize Map Once on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    const provider = new LeafletMapProvider();
    mapProviderRef.current = provider;

    const initialLat = destinationLocation?.latitude || hubLocation?.latitude || 11.0550;
    const initialLng = destinationLocation?.longitude || hubLocation?.longitude || 77.0650;

    provider
      .initialize({
        containerElement: containerRef.current,
        initialViewport: {
          center: [initialLat, initialLng],
          zoom: 13,
        },
        isInteractive: true,
      })
      .then(async () => {
        if (hubLocation?.latitude) {
          provider.updateHub(hubLocation);
        }
        if (destinationLocation?.latitude) {
          provider.updateDestination(
            destinationLocation.latitude,
            destinationLocation.longitude,
            destinationLocation.address
          );
        }
        provider.setClearanceRadius(3.5, true);
        if (flightRoute && flightRoute.length > 0) {
          provider.setFlightRoute(flightRoute);
        }
        if (droneLocation?.latitude) {
          provider.updateDronePosition(droneLocation);
        }

        // Fetch and draw active No-Fly Zones
        try {
          const { zones } = await api.airspace.getZones();
          if (zones && zones.length > 0) {
            provider.setNoFlyZones(zones);
          }
        } catch (e) {
          console.warn('Could not load NFZ zones for live map:', e);
        }

        const fitPoints: [number, number][] = [];
        if (destinationLocation?.latitude && destinationLocation?.longitude) {
          fitPoints.push([destinationLocation.latitude, destinationLocation.longitude]);
        }
        if (droneLocation?.latitude && droneLocation?.longitude) {
          fitPoints.push([droneLocation.latitude, droneLocation.longitude]);
        }
        if (hubLocation?.latitude && hubLocation?.longitude) {
          fitPoints.push([hubLocation.latitude, hubLocation.longitude]);
        }

        if (fitPoints.length > 0) {
          provider.fitBounds(fitPoints);
          hasInitialFitRef.current = true;
        }
      });

    return () => {
      provider.destroy();
      mapProviderRef.current = null;
    };
  }, []); // Mount only

  // Handle container resize automatically
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapProviderRef.current?.invalidateSize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update destination marker and clearance zone when coordinates update
  useEffect(() => {
    if (mapProviderRef.current && destinationLocation?.latitude && destinationLocation?.longitude) {
      mapProviderRef.current.updateDestination(
        destinationLocation.latitude,
        destinationLocation.longitude,
        destinationLocation.address
      );
      if (!hasInitialFitRef.current) {
        handleRecenter();
        hasInitialFitRef.current = true;
      }
    }
  }, [destinationLocation?.latitude, destinationLocation?.longitude, destinationLocation?.address]);

  // Update flight route polyline when available
  useEffect(() => {
    if (mapProviderRef.current && flightRoute && flightRoute.length > 0) {
      mapProviderRef.current.setFlightRoute(flightRoute);
    }
  }, [flightRoute]);

  // Smoothly update drone position marker without snapping the user's camera view
  useEffect(() => {
    if (mapProviderRef.current && droneLocation?.latitude && droneLocation?.longitude) {
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
      const points: [number, number][] = [];
      if (destinationLocation?.latitude && destinationLocation?.longitude) {
        points.push([destinationLocation.latitude, destinationLocation.longitude]);
      }
      if (droneLocation?.latitude && droneLocation?.longitude) {
        points.push([droneLocation.latitude, droneLocation.longitude]);
      }
      if (hubLocation?.latitude && hubLocation?.longitude) {
        points.push([hubLocation.latitude, hubLocation.longitude]);
      }
      if (flightRoute && flightRoute.length > 0) {
        points.push(...flightRoute);
      }
      if (points.length > 0) {
        mapProviderRef.current.fitBounds(points);
      }
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
