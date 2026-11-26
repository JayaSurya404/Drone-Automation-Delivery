import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Drone, GeofenceZone, Order, Mission } from '../../types/skynav';
import { Compass, Eye, Shield, Layers, RotateCcw } from 'lucide-react';

interface CesiumOpsMap3DProps {
  drones: Drone[];
  geofences?: GeofenceZone[];
  orders?: Order[];
  missions?: Mission[];
  selectedDroneId?: string;
  onSelectDrone?: (drone: Drone) => void;
  heightClass?: string;
}

export const CesiumOpsMap3D: React.FC<CesiumOpsMap3DProps> = ({
  drones,
  geofences = [],
  orders = [],
  missions = [],
  selectedDroneId,
  onSelectDrone,
  heightClass = 'h-[560px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const droneEntitiesRef = useRef<Map<string, { entity: Cesium.Entity; positionProperty: Cesium.SampledPositionProperty }>>(new Map());
  const [followDrone, setFollowDrone] = useState<boolean>(true);
  const [showBuildings, setShowBuildings] = useState<boolean>(true);
  const [showGeofences, setShowGeofences] = useState<boolean>(true);
  const buildingsTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);

  // Initialize Cesium 3D Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const ionToken = (import.meta as any).env?.VITE_CESIUM_ION_TOKEN || '';
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

    // Enable high-DPI and lighting
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Add OSM Buildings if Ion Token is configured
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

    // Default Camera Framing: SkyHub Kurumbapalayam, Coimbatore (11.1132° N, 77.0277° E)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(77.0277, 11.1132, 1200),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0.0,
      },
      duration: 1.5,
    });

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      droneEntitiesRef.current.clear();
    };
  }, []);

  // Update 3D Geofence Volumes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove existing geofence entities
    const geofenceEntities = viewer.entities.values.filter((e) => e.name?.startsWith('geofence-'));
    geofenceEntities.forEach((e) => viewer.entities.remove(e));

    if (!showGeofences) return;

    geofences.forEach((zone) => {
      const rawCoords = (zone as any).points || (zone as any).coordinates || [];
      const flatCoords: number[] = [];

      rawCoords.forEach((pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          flatCoords.push(pt[1], pt[0]); // [lng, lat]
        } else if (pt && typeof pt === 'object' && 'lat' in pt && 'lng' in pt) {
          flatCoords.push(pt.lng, pt.lat);
        }
      });

      if (flatCoords.length >= 6) {
        const isNoFly = zone.type === 'nofly' || (zone.type as string) === 'no_fly';
        const color = isNoFly ? Cesium.Color.RED : Cesium.Color.ORANGE;

        viewer.entities.add({
          name: `geofence-${zone.id}`,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(flatCoords),
            height: 0,
            extrudedHeight: (zone as any).maxAltitude ?? (zone as any).maxAltitudeMeters ?? 120, // 3D airspace volume height
            material: color.withAlpha(0.25),
            outline: true,
            outlineColor: color.withAlpha(0.8),
            outlineWidth: 2,
          },
          description: `${zone.name} (${isNoFly ? 'DGCA Red Zone' : 'Restricted Corridor'})`,
        });
      }
    });
  }, [geofences, showGeofences]);

  // Update Flight Path Polylines
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove existing mission path entities
    const pathEntities = viewer.entities.values.filter((e) => e.name?.startsWith('path-'));
    pathEntities.forEach((e) => viewer.entities.remove(e));

    missions.forEach((m) => {
      const waypoints = (m as any).waypoints || [];
      if (Array.isArray(waypoints) && waypoints.length >= 2) {
        const positions: Cesium.Cartesian3[] = [];
        waypoints.forEach((wp: any) => {
          const lat = wp.lat ?? wp.latitude;
          const lng = wp.lng ?? wp.longitude;
          const alt = wp.alt ?? wp.altitude ?? 45;
          if (typeof lat === 'number' && typeof lng === 'number') {
            positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, alt));
          }
        });

        if (positions.length >= 2) {
          viewer.entities.add({
            name: `path-${m.id}`,
            polyline: {
              positions,
              width: 3,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.25,
                color: Cesium.Color.CYAN,
              }),
            },
          });
        }
      }
    });
  }, [missions]);

  // Update Drone Entities with real altitude and smooth interpolation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const now = Cesium.JulianDate.now();

    drones.forEach((d) => {
      const lat = d.location?.lat;
      const lng = d.location?.lng;
      const alt = d.location?.altitude ?? 45; // Real altitude from telemetry

      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const newPos = Cesium.Cartesian3.fromDegrees(lng, lat, alt);

      let record = droneEntitiesRef.current.get(d.id);
      if (!record) {
        const posProp = new Cesium.SampledPositionProperty();
        posProp.setInterpolationOptions({
          interpolationDegree: 1,
          interpolationAlgorithm: Cesium.LinearApproximation,
        });
        posProp.addSample(now, newPos);

        const entity = viewer.entities.add({
          id: d.id,
          name: `${d.id} • ${d.model}`,
          position: posProp,
          // 3D Drone glTF Model or fallback geometry with real altitude
          model: {
            uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb',
            minimumPixelSize: 48,
            maximumScale: 120,
            scale: 1.0,
            color: d.id === selectedDroneId ? Cesium.Color.YELLOW : Cesium.Color.WHITE,
          },
          // Beacon point indicator for high-visibility at distance
          point: {
            pixelSize: 10,
            color: d.status === 'in_flight' ? Cesium.Color.CYAN : Cesium.Color.GREEN,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(500, 50000),
          },
          // Telemetry flight path trail
          path: {
            resolution: 1,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.15,
              color: Cesium.Color.CYAN.withAlpha(0.7),
            }),
            width: 2,
            leadTime: 0,
            trailTime: 60,
          },
          label: {
            text: `${d.id}\n${Math.round(alt)}m • ${d.battery}%`,
            font: '10px monospace',
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000),
          },
        });

        droneEntitiesRef.current.set(d.id, { entity, positionProperty: posProp });
      } else {
        record.positionProperty.addSample(now, newPos);
      }
    });

    // Handle Follow Drone Camera
    if (followDrone && selectedDroneId) {
      const sel = drones.find((d) => d.id === selectedDroneId);
      if (sel && typeof sel.location?.lat === 'number') {
        const selLat = sel.location.lat;
        const selLng = sel.location.lng;
        const selAlt = sel.location.altitude ?? 45;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(selLng, selLat, selAlt + 350),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0,
          },
          duration: 0.8,
        });
      }
    }
  }, [drones, selectedDroneId, followDrone]);

  // Toggle OSM Buildings
  useEffect(() => {
    if (buildingsTilesetRef.current) {
      buildingsTilesetRef.current.show = showBuildings;
    }
  }, [showBuildings]);

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(77.0277, 11.1132, 1400),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0.0,
      },
      duration: 1.2,
    });
  };

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-800 bg-slate-950`}>
      {/* Cesium Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating 3D Airspace Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2 rounded-xl shadow-xl text-xs">
        <div className="flex items-center justify-between gap-3 px-2 py-1 text-[10px] font-mono font-bold text-cyan-400 border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" /> CESIUM 3D LIVE
          </span>
          <span className="text-emerald-400">PHOTOREALISTIC</span>
        </div>

        <button
          onClick={() => setFollowDrone((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-left flex items-center justify-between gap-3 font-semibold transition-all ${
            followDrone ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" /> Drone Chase Cam
          </span>
          <span className="text-[10px] font-mono">{followDrone ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowBuildings((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-left flex items-center justify-between gap-3 font-semibold transition-all ${
            showBuildings ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> OSM 3D Buildings
          </span>
          <span className="text-[10px] font-mono">{showBuildings ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowGeofences((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-left flex items-center justify-between gap-3 font-semibold transition-all ${
            showGeofences ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> 3D Airspace Volumes
          </span>
          <span className="text-[10px] font-mono">{showGeofences ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="px-3 py-1.5 rounded-lg text-left flex items-center gap-2 font-semibold text-slate-400 hover:text-cyan-300 transition-all border border-transparent hover:border-slate-800"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset SkyHub View
        </button>
      </div>

      {/* Airspace Altitude Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-xl text-[11px] font-mono text-slate-400 flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" /> Live Corridor (45m AGL)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-red-500/50 border border-red-500" /> DGCA No-Fly 3D Volume
        </span>
        <span className="text-slate-500">Coimbatore Center: 11.1132°N 77.0277°E</span>
      </div>
    </div>
  );
};

export default CesiumOpsMap3D;
