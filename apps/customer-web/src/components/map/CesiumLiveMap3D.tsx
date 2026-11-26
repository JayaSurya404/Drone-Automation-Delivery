import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { DroneLocation, HubLocation } from '../../types/tracking';
import { Compass, Eye, MapPin, Navigation, RotateCcw } from 'lucide-react';

interface CesiumLiveMap3DProps {
  droneLocation: DroneLocation;
  hubLocation: HubLocation;
  destinationLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  flightRoute: [number, number][];
  height?: string;
}

export const CesiumLiveMap3D: React.FC<CesiumLiveMap3DProps> = ({
  droneLocation,
  hubLocation,
  destinationLocation,
  flightRoute,
  height = '500px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const droneEntityRef = useRef<Cesium.Entity | null>(null);
  const positionPropertyRef = useRef<Cesium.SampledPositionProperty | null>(null);
  const [followMode, setFollowMode] = useState<boolean>(true);
  const [showBuildings, setShowBuildings] = useState<boolean>(true);
  const buildingsTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);

  // Initialize Cesium 3D Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    // Set base path for Cesium static assets
    (window as any).CESIUM_BASE_URL = '/cesium/';

    const viewerOptions: any = {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      vrButton: false,
    };

    if (ionToken) {
      try {
        viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
      } catch {
        // Fallback to default ellipsoid terrain if offline
      }
    }

    const viewer = new Cesium.Viewer(containerRef.current, viewerOptions);

    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Load 3D OSM Buildings
    if (ionToken) {
      Cesium.createOsmBuildingsAsync()
        .then((tileset) => {
          if (viewer && !viewer.isDestroyed()) {
            buildingsTilesetRef.current = tileset;
            viewer.scene.primitives.add(tileset);
          }
        })
        .catch(() => {});
    }

    // Add Hub and Destination Pins
    const hubLat = hubLocation?.latitude ?? 11.1132;
    const hubLng = hubLocation?.longitude ?? 77.0277;
    const destLat = destinationLocation?.latitude ?? 11.0168;
    const destLng = destinationLocation?.longitude ?? 76.9558;

    viewer.entities.add({
      name: hubLocation?.name || 'Launch Hub',
      position: Cesium.Cartesian3.fromDegrees(hubLng, hubLat, 15),
      point: {
        pixelSize: 14,
        color: Cesium.Color.DODGERBLUE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: 'SkyHub Launchpad',
        font: '11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
      },
    });

    viewer.entities.add({
      name: 'Drop Zone Destination',
      position: Cesium.Cartesian3.fromDegrees(destLng, destLat, 10),
      point: {
        pixelSize: 14,
        color: Cesium.Color.LIMEGREEN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: 'Your Drop Zone',
        font: '11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
      },
    });

    // Create Initial Drone Entity with SampledPositionProperty for smooth flight interpolation
    const now = Cesium.JulianDate.now();
    const posProp = new Cesium.SampledPositionProperty();
    posProp.setInterpolationOptions({
      interpolationDegree: 1,
      interpolationAlgorithm: Cesium.LinearApproximation,
    });

    const initDroneLat = droneLocation?.latitude ?? hubLat;
    const initDroneLng = droneLocation?.longitude ?? hubLng;
    const initDroneAlt = droneLocation?.altitudeMeters ?? 45;
    const initPos = Cesium.Cartesian3.fromDegrees(initDroneLng, initDroneLat, initDroneAlt);
    posProp.addSample(now, initPos);
    positionPropertyRef.current = posProp;

    const droneEntity = viewer.entities.add({
      name: 'SkyNav Delivery UAV',
      position: posProp,
      // 3D glTF Drone Model
      model: {
        uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb',
        minimumPixelSize: 64,
        maximumScale: 150,
        scale: 1.2,
      },
      // High-visibility beacon point
      point: {
        pixelSize: 12,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(200, 20000),
      },
      // Polyline trail behind drone
      path: {
        resolution: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.CYAN,
        }),
        width: 3,
        leadTime: 0,
        trailTime: 120,
      },
      label: {
        text: `Drone in Transit\n${Math.round(initDroneAlt)}m Altitude`,
        font: '11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -32),
      },
    });

    droneEntityRef.current = droneEntity;

    // Initial Camera Framing
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(initDroneLng, initDroneLat, initDroneAlt + 400),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-40),
        roll: 0.0,
      },
      duration: 1.5,
    });

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      droneEntityRef.current = null;
      positionPropertyRef.current = null;
    };
  }, []);

  // Update Flight Route 3D Polyline
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove existing flight route entities
    const routeEntities = viewer.entities.values.filter((e) => e.name === 'Delivery Corridor Route');
    routeEntities.forEach((e) => viewer.entities.remove(e));

    if (Array.isArray(flightRoute) && flightRoute.length >= 2) {
      const positions: Cesium.Cartesian3[] = flightRoute.map(([lat, lng]) =>
        Cesium.Cartesian3.fromDegrees(lng, lat, 45)
      );

      viewer.entities.add({
        name: 'Delivery Corridor Route',
        polyline: {
          positions,
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.CYAN,
          }),
        },
      });
    }
  }, [flightRoute]);

  // Update Drone Position with smooth interpolation & follow camera
  useEffect(() => {
    const viewer = viewerRef.current;
    const posProp = positionPropertyRef.current;
    if (!viewer || viewer.isDestroyed() || !posProp || !droneLocation) return;

    const lat = droneLocation.latitude;
    const lng = droneLocation.longitude;
    const alt = droneLocation.altitudeMeters ?? 45;

    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const now = Cesium.JulianDate.now();
    const newPos = Cesium.Cartesian3.fromDegrees(lng, lat, alt);
    posProp.addSample(now, newPos);

    if (droneEntityRef.current?.label) {
      droneEntityRef.current.label.text = new Cesium.ConstantProperty(
        `Drone in Transit\n${Math.round(alt)}m • ${Math.round(droneLocation.speedKmh ?? 0)} km/h`
      );
    }

    if (followMode) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt + 350),
        orientation: {
          heading: Cesium.Math.toRadians(droneLocation.bearing ?? 0),
          pitch: Cesium.Math.toRadians(-40),
          roll: 0.0,
        },
        duration: 0.8,
      });
    }
  }, [droneLocation, followMode]);

  // Toggle OSM Buildings
  useEffect(() => {
    if (buildingsTilesetRef.current) {
      buildingsTilesetRef.current.show = showBuildings;
    }
  }, [showBuildings]);

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !droneLocation) return;

    const lat = droneLocation.latitude ?? 11.1132;
    const lng = droneLocation.longitude ?? 77.0277;
    const alt = droneLocation.altitudeMeters ?? 45;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt + 600),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
      duration: 1.0,
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '20px', overflow: 'hidden', background: '#090d16' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating 3D Airspace Controls */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(51, 65, 85, 0.8)',
        borderRadius: '16px',
        padding: '12px',
        fontSize: '12px',
        color: '#f8fafc',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(51, 65, 85, 0.8)',
          fontSize: '10px',
          fontFamily: 'monospace',
          fontWeight: 700,
          color: '#22d3ee',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass style={{ width: 14, height: 14 }} /> CESIUM 3D LIVE
          </span>
          <span style={{ color: '#4ade80' }}>TERRAIN ACTIVE</span>
        </div>

        <button
          onClick={() => setFollowMode((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: followMode ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
            background: followMode ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
            color: followMode ? '#22d3ee' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11px',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye style={{ width: 14, height: 14 }} /> Chase Drone
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{followMode ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowBuildings((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: showBuildings ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
            background: showBuildings ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
            color: showBuildings ? '#22d3ee' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11px',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Navigation style={{ width: 14, height: 14 }} /> 3D Buildings
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{showBuildings ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={handleResetCamera}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid transparent',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11px',
          }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} /> Center Drone View
        </button>
      </div>

      {/* Altitude HUD Badge */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(51, 65, 85, 0.6)',
        borderRadius: '12px',
        padding: '8px 14px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#cbd5e1',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee' }} />
          Flight Altitude: <strong>{Math.round(droneLocation?.altitudeMeters ?? 45)}m</strong>
        </span>
        <span style={{ color: '#64748b' }}>•</span>
        <span>Speed: <strong>{Math.round(droneLocation?.speedKmh ?? 0)} km/h</strong></span>
      </div>
    </div>
  );
};

export default CesiumLiveMap3D;
