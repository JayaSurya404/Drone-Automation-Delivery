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

  // Center/Fit to active delivery (drone + destination + route)
  const fitActiveDelivery = useCallback(() => {
    if (!mapProviderRef.current) return;
    const points: [number, number][] = [];
    if (destinationLocation?.latitude && destinationLocation?.longitude) {
      points.push([destinationLocation.latitude, destinationLocation.longitude]);
    }
    if (droneLocation?.latitude && droneLocation?.longitude) {
      points.push([droneLocation.latitude, droneLocation.longitude]);
    }
    if (flightRoute && flightRoute.length > 0) {
      points.push(...flightRoute);
    } else if (hubLocation?.latitude && hubLocation?.longitude) {
      points.push([hubLocation.latitude, hubLocation.longitude]);
    }

    if (points.length > 0) {
      mapProviderRef.current.fitBounds(points, [60, 60], 16);
    }
  }, [destinationLocation, droneLocation, flightRoute, hubLocation]);

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

  // Dynamic Camera Auto-Follow & Smooth Drone Marker Updates
  useEffect(() => {
    if (!mapProviderRef.current || !droneLocation?.latitude || !droneLocation?.longitude) return;

    // 1. Always update drone marker smoothly
    mapProviderRef.current.updateDronePosition(droneLocation);

    // 2. Intelligent dynamic auto-framing (only if user hasn't paused auto-follow)
    if (isAutoFollow && !isUserInteracted && destinationLocation?.latitude && destinationLocation?.longitude) {
      const distKm = getDistanceKm(
        droneLocation.latitude,
        droneLocation.longitude,
        destinationLocation.latitude,
        destinationLocation.longitude
      );

      // Distance bands:
      // Band 0: > 2.0 km - wide corridor view
      // Band 1: 0.5 km to 2.0 km - medium approach view
      // Band 2: <= 0.5 km - tight touchdown landing focus
      const currentBand = distKm <= 0.5 ? 2 : distKm <= 2.0 ? 1 : 0;
      const now = Date.now();
      const lastUpdate = lastCameraUpdateRef.current;

      // Adjust camera when distance band changes or at least 6s elapsed
      if (lastUpdate.band !== currentBand || now - lastUpdate.timestamp >= 6000) {
        lastCameraUpdateRef.current = { timestamp: now, band: currentBand };

        const boundsPoints: [number, number][] = [
          [droneLocation.latitude, droneLocation.longitude],
          [destinationLocation.latitude, destinationLocation.longitude],
        ];

        const padding: [number, number] = currentBand === 2 ? [80, 80] : currentBand === 1 ? [70, 70] : [60, 60];
        const maxZoom = currentBand === 2 ? 17 : currentBand === 1 ? 16 : 15;

        mapProviderRef.current.fitBounds(boundsPoints, padding, maxZoom);
      }
    }
  }, [droneLocation.latitude, droneLocation.longitude, droneLocation.bearing, isAutoFollow, isUserInteracted, destinationLocation]);

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
        <span>{isAutoFollow ? 'Auto-Tracking Flight' : 'Free Camera View'}</span>
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
        {/* Toggle Auto-Follow Drone Camera */}
        <button
          type="button"
          className={`map-btn ${isAutoFollow ? 'active' : ''}`}
          onClick={handleToggleFollow}
          title={isAutoFollow ? 'Auto-following drone (Click to unlock camera)' : 'Follow Drone & Center Delivery'}
          aria-label="Toggle Drone Follow"
        >
          <Navigation size={18} />
        </button>

        {/* Fit Entire Active Delivery Corridor */}
        <button
          type="button"
          className="map-btn"
          onClick={fitActiveDelivery}
          title="Fit full flight route"
          aria-label="Fit full flight route"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
};
