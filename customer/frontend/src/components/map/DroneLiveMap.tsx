import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LeafletMapProvider } from '../../services/mapProvider';
import { DroneLocation, HubLocation } from '../../types/tracking';
import { api } from '../../services/api';
import { Maximize2, ShieldAlert, Navigation } from 'lucide-react';

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
  const [isAutoFollow, setIsAutoFollow] = useState<boolean>(true);
  const [isUserInteracted, setIsUserInteracted] = useState<boolean>(false);

  const hasInitialFitRef = useRef<boolean>(false);
  const lastCameraUpdateRef = useRef<{ timestamp: number; band: number }>({ timestamp: 0, band: -1 });

  // Helper to calculate approximate distance in km
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Center/Fit to active delivery (corridor: destination + route/hub)
  const fitActiveDelivery = useCallback(() => {
    if (!mapProviderRef.current) return;
    const points: [number, number][] = [];
    if (destinationLocation?.latitude && destinationLocation?.longitude) {
      points.push([destinationLocation.latitude, destinationLocation.longitude]);
    }
    if (flightRoute && flightRoute.length > 0) {
      points.push(...flightRoute);
    } else if (hubLocation?.latitude && hubLocation?.longitude) {
      points.push([hubLocation.latitude, hubLocation.longitude]);
    }

    if (points.length > 0) {
      mapProviderRef.current.fitBounds(points, [60, 60], 16);
    }
  }, [destinationLocation?.latitude, destinationLocation?.longitude, flightRoute, hubLocation?.latitude, hubLocation?.longitude]);

  // Initialize Map Once on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    const provider = new LeafletMapProvider();
    mapProviderRef.current = provider;

    const initialLat = destinationLocation?.latitude || hubLocation?.latitude || 11.1132;
    const initialLng = destinationLocation?.longitude || hubLocation?.longitude || 77.0277;

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

        // Listen for user panning/zooming to avoid fighting user camera
        provider.onUserInteraction?.(() => {
          setIsAutoFollow(false);
          setIsUserInteracted(true);
        });

        // Fetch and draw active No-Fly Zones
        try {
          const { zones } = await api.airspace.getZones();
          if (zones && zones.length > 0) {
            provider.setNoFlyZones(zones);
          }
        } catch (e) {
          console.warn('Could not load NFZ zones for live map:', e);
        }

        // Authoritative Initial Framing: DRONE + DESTINATION + ROUTE
        const fitPoints: [number, number][] = [];
        if (destinationLocation?.latitude && destinationLocation?.longitude) {
          fitPoints.push([destinationLocation.latitude, destinationLocation.longitude]);
        }
        if (droneLocation?.latitude && droneLocation?.longitude) {
          fitPoints.push([droneLocation.latitude, droneLocation.longitude]);
        }
        if (flightRoute && flightRoute.length > 0) {
          fitPoints.push(...flightRoute);
        } else if (hubLocation?.latitude && hubLocation?.longitude) {
          fitPoints.push([hubLocation.latitude, hubLocation.longitude]);
        }

        if (fitPoints.length > 0) {
          provider.fitBounds(fitPoints, [60, 60], 16);
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
        fitActiveDelivery();
        hasInitialFitRef.current = true;
      }
    }
  }, [destinationLocation?.latitude, destinationLocation?.longitude, destinationLocation?.address, fitActiveDelivery]);

  // Update flight route polyline when available
  useEffect(() => {
    if (mapProviderRef.current && flightRoute && flightRoute.length > 0) {
      mapProviderRef.current.setFlightRoute(flightRoute);
    }
  }, [flightRoute]);

  // Smooth Drone Marker Position Updates (Without camera-fighting or auto-zooming)
  useEffect(() => {
    if (!mapProviderRef.current || !droneLocation?.latitude || !droneLocation?.longitude) return;

    // Update drone marker position smoothly on authoritative telemetry tick
    mapProviderRef.current.updateDronePosition(droneLocation);

    if (typeof window !== 'undefined') {
      (window as any).__skynavCustDrone = {
        lat: droneLocation.latitude,
        lng: droneLocation.longitude,
        alt: droneLocation.altitudeMeters,
        speed: droneLocation.speedKmh,
        bearing: droneLocation.bearing,
      };
      (window as any).__skynavCustMapCamera = {
        center: mapProviderRef.current?.getCenter?.() || null,
        zoom: mapProviderRef.current?.getZoom?.() || null,
      };
    }
  }, [droneLocation.latitude, droneLocation.longitude, droneLocation.bearing, droneLocation.altitudeMeters, droneLocation.speedKmh]);

  const handleToggleAirspace = () => {
    const nextState = !isAirspaceVisible;
    setIsAirspaceVisible(nextState);
    if (mapProviderRef.current) {
      mapProviderRef.current.toggleAirspaceLayer(nextState);
    }
  };

  const handleToggleFollow = () => {
    const nextFollow = !isAutoFollow;
    setIsAutoFollow(nextFollow);
    if (nextFollow) {
      setIsUserInteracted(false);
      fitActiveDelivery();
    }
  };

  return (
    <div className="map-wrapper" style={{ height }}>
      <div ref={containerRef} className="map-container" style={{ height: '100%' }} />

      {/* Floating Status Badge */}
      <div className="map-overlay-badge">
        <span className="pulse-dot cyan" />
        <span>Authoritative Live Tracking</span>
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
        {/* Recenter Entire Active Delivery Corridor */}
        <button
          type="button"
          className="map-btn"
          onClick={fitActiveDelivery}
          title="Recenter flight corridor"
          aria-label="Recenter flight corridor"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
};
