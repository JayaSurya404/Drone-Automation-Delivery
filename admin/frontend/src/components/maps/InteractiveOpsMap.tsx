import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Drone, GeofenceZone, Order, Mission } from '../../types/skynav';
import { TelemetryFloatingCard } from './TelemetryFloatingCard';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Navigation,
  Shield,
  Radio,
  MapPin,
  Eye,
  Satellite,
  Compass,
  Target,
  Crosshair,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Battery,
  Gauge,
  Wind,
  CloudSun,
  X,
} from 'lucide-react';
import L from 'leaflet';

interface InteractiveOpsMapProps {
  drones: Drone[];
  geofences?: GeofenceZone[];
  orders?: Order[];
  missions?: Mission[];
  onSelectDrone?: (drone: Drone) => void;
  selectedDroneId?: string;
  onEmergencyAction?: (droneId: string, cmd: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL') => void;
  heightClass?: string;
}

export const InteractiveOpsMap: React.FC<InteractiveOpsMapProps> = ({
  drones,
  geofences = [],
  orders = [],
  missions = [],
  onSelectDrone,
  selectedDroneId,
  onEmergencyAction,
  heightClass = 'h-[560px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routesGroupRef = useRef<L.LayerGroup | null>(null);
  const geofencesGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapType, setMapType] = useState<'satellite' | 'roadmap' | 'hybrid'>('satellite');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Layer toggles
  const [layers, setLayers] = useState({
    activeDrones: true,
    plannedRoutes: true,
    actualRoutes: true,
    pickupPoints: true,
    deliveryPoints: true,
    deliveryZones: true,
    restrictedZones: true,
    cautionZones: true,
    weatherAlerts: true,
  });

  // Default SkyHub Kurumbapalayam Ops Base
  const defaultCenter: [number, number] = [11.1132, 77.0277];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
      routesGroupRef.current = L.layerGroup().addTo(map);
      geofencesGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle window/container resize
  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Update Tile Layers when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    if (labelLayerRef.current) map.removeLayer(labelLayerRef.current);

    if (mapType === 'satellite') {
      // Real ESRI High-Resolution World Imagery
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map);
    } else if (mapType === 'hybrid') {
      // ESRI Satellite + CartoDB Labels
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map);

      labelLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(map);
    } else {
      // Clean Dark/Vector Road Map
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(map);
    }
  }, [mapType]);

  // Sync selected drone from props (Without automatic camera movement)
  useEffect(() => {
    if (selectedDroneId) {
      const d = drones.find((dr) => dr.id === selectedDroneId);
      if (d) {
        setSelectedDrone(d);
      }
    }
  }, [selectedDroneId, drones]);

  // Render Geofences
  useEffect(() => {
    const group = geofencesGroupRef.current;
    if (!group) return;
    group.clearLayers();

    geofences.forEach((gf) => {
      if (gf.type === 'delivery' && !layers.deliveryZones) return;
      if (gf.type === 'nofly' && !layers.restrictedZones) return;
      if (gf.type === 'caution' && !layers.cautionZones) return;

      const fillColor =
        gf.type === 'delivery' ? '#10b981' : gf.type === 'nofly' ? '#ef4444' : '#f59e0b';
      const fillOpacity = gf.type === 'delivery' ? 0.18 : gf.type === 'nofly' ? 0.28 : 0.22;

      const polygon = L.polygon(gf.coordinates as [number, number][], {
        color: fillColor,
        fillColor,
        fillOpacity,
        weight: 2,
        dashArray: gf.type === 'nofly' ? '6, 6' : undefined,
      });

      polygon.bindTooltip(
        `<div class="p-1 text-xs">
          <p class="font-bold font-mono uppercase text-slate-100">${gf.name}</p>
          <p class="text-[10px] text-slate-400">${gf.type.toUpperCase()} ZONE • Max Alt: ${gf.maxAltitudeMeters || 120}m</p>
        </div>`,
        { sticky: true, className: 'leaflet-popup-content-wrapper' }
      );

      group.addLayer(polygon);
    });
  }, [geofences, layers]);

  // Render Flight Routes & Waypoints
  useEffect(() => {
    const group = routesGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // Render routes for active orders / missions
    orders.slice(0, 15).forEach((order) => {
      const isSelected = selectedDrone && (selectedDrone.id === order.droneId || selectedDrone.currentMissionId === order.missionId);

      // Pickup point
      if (layers.pickupPoints) {
        const pickupIcon = L.divIcon({
          className: 'custom-drone-marker',
          html: `<div class="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center text-[9px] font-bold text-white">P</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const pMarker = L.marker([order.pickupCoords.lat, order.pickupCoords.lng], { icon: pickupIcon });
        pMarker.bindTooltip(`<div class="text-xs"><b>Pickup:</b> ${order.pickupAddress}</div>`);
        group.addLayer(pMarker);
      }

      // Delivery destination point
      if (layers.deliveryPoints) {
        const deliveryIcon = L.divIcon({
          className: 'custom-drone-marker',
          html: `<div class="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-[9px] font-bold text-white">D</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const dMarker = L.marker([order.destinationCoords.lat, order.destinationCoords.lng], { icon: deliveryIcon });
        dMarker.bindTooltip(`<div class="text-xs"><b>Dropoff:</b> ${order.destinationAddress}</div>`);
        group.addLayer(dMarker);
      }

      // Planned flight route (dashed line)
      if (layers.plannedRoutes) {
        const plannedLine = L.polyline(
          [
            [order.pickupCoords.lat, order.pickupCoords.lng],
            [order.destinationCoords.lat, order.destinationCoords.lng],
          ],
          {
            color: isSelected ? '#38bdf8' : '#0284c7',
            weight: isSelected ? 3.5 : 2,
            dashArray: '6, 6',
            opacity: isSelected ? 0.9 : 0.6,
          }
        );
        group.addLayer(plannedLine);
      }

      // If active mission with actual route
      if (layers.actualRoutes && order.droneId) {
        const drone = drones.find((d) => d.id === order.droneId);
        if (drone && (drone.status === 'in_flight' || drone.status === 'returning' || drone.status === 'emergency')) {
          const actualLine = L.polyline(
            [
              [order.pickupCoords.lat, order.pickupCoords.lng],
              [drone.location.lat, drone.location.lng],
            ],
            {
              color: drone.id === 'D-024' ? '#f43f5e' : '#10b981',
              weight: isSelected ? 4 : 2.5,
              opacity: 0.95,
            }
          );
          group.addLayer(actualLine);
        }
      }
    });
  }, [orders, selectedDrone, layers, drones]);

  // Render Animated Live Drone Markers
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!layers.activeDrones) return;

    // Render SkyHub Kurumbapalayam Central Operating Base Station
    const hubIcon = L.divIcon({
      className: 'custom-hub-marker',
      html: `
        <div class="relative flex flex-col items-center cursor-pointer group">
          <div class="absolute -inset-2 rounded-full bg-cyan-500/25 animate-pulse"></div>
          <div class="w-9 h-9 rounded-xl bg-slate-900/95 border-2 border-cyan-400 shadow-2xl flex items-center justify-center text-cyan-400 font-bold">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div class="mt-1 px-2 py-0.5 rounded bg-slate-900/90 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 font-mono shadow whitespace-nowrap">
            SkyHub Kurumbapalayam Base
          </div>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 24],
    });
    const hubMarker = L.marker([11.1132, 77.0277], { icon: hubIcon, zIndexOffset: 400 });
    hubMarker.bindTooltip(`
      <div class="p-1.5 text-xs font-sans">
        <div class="font-bold text-cyan-300">SkyHub Kurumbapalayam Base</div>
        <div class="text-[10px] text-slate-300">Authoritative Home Hub • 40 Fleet Units</div>
        <div class="text-[10px] text-emerald-400">DGCA UAS Operational Air Corridor</div>
      </div>
    `, { sticky: true });
    group.addLayer(hubMarker);

    // Authoritative 2D Live Telemetry Synchronization Hook
    // Strictly track the physical Gazebo drone D-001 across all flight and ground phases
    const activeAirborneDrone =
      drones.find((d) => d.id === 'D-001') ||
      selectedDrone ||
      drones.find((d) => d.status === 'in_flight' || d.status === 'returning' || (d.status as any) === 'touchdown' || d.status === 'charging') ||
      drones[0];

    if (typeof window !== 'undefined' && activeAirborneDrone) {
      (window as any).__skynav2DDrone = {
        droneId: activeAirborneDrone.id,
        lat: activeAirborneDrone.location.lat,
        lng: activeAirborneDrone.location.lng,
        alt: activeAirborneDrone.location.altitude || 0,
        speed: activeAirborneDrone.location.speed || 0,
        heading: activeAirborneDrone.location.heading || 0,
        status: activeAirborneDrone.status,
        battery: activeAirborneDrone.battery,
      };
      (window as any).__skynav2DMapCamera = {
        center: mapInstanceRef.current ? [mapInstanceRef.current.getCenter().lat, mapInstanceRef.current.getCenter().lng] : null,
        zoom: mapInstanceRef.current ? mapInstanceRef.current.getZoom() : null,
      };
    }

    drones.forEach((drone) => {
      const isSelected = selectedDrone?.id === drone.id;
      const isDeviation = drone.id === 'D-024';
      const isEmergency = drone.status === 'emergency';

      const statusColor = isEmergency
        ? '#ef4444'
        : isDeviation
        ? '#f59e0b'
        : drone.status === 'in_flight'
        ? '#06b6d4'
        : drone.status === 'charging'
        ? '#eab308'
        : drone.status === 'available'
        ? '#10b981'
        : '#94a3b8';

      // Base Apron Slot Positioning:
      // Only when idle/charging at Kurumbapalayam hub, position neatly on the flight deck apron
      const isAtHub = (drone.status === 'available' || drone.status === 'charging' || drone.status === 'idle' || !drone.status) &&
                      Math.abs(drone.location.lat - 11.1132) < 0.002 &&
                      Math.abs(drone.location.lng - 77.0277) < 0.002;

      let displayLat = drone.location.lat;
      let displayLng = drone.location.lng;

      if (isAtHub) {
        const droneIndex = parseInt(drone.id.replace(/\D/g, ''), 10) || 1;
        const ring = droneIndex <= 20 ? 1 : 2;
        const angle = (droneIndex % 20) * (Math.PI / 10);
        const radius = ring === 1 ? 0.0004 : 0.00075;
        displayLat = 11.1132 + Math.sin(angle) * radius;
        displayLng = 77.0277 + Math.cos(angle) * radius;
      }

      const droneHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <!-- Selection Pulse Ring -->
          ${
            isSelected || isEmergency || isDeviation
              ? `<div class="absolute -inset-3 rounded-full animate-ping opacity-60" style="background-color: ${statusColor};"></div>`
              : ''
          }
          
          <!-- Outer Status Glow Ring -->
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-2xl backdrop-blur-md transition-transform duration-300 group-hover:scale-125"
               style="background-color: rgba(15, 23, 42, 0.92); border-color: ${statusColor};">
            <!-- Drone SVG Craft (Rotated to heading) -->
            <svg viewBox="0 0 24 24" class="w-5 h-5 text-white transition-transform duration-500" style="transform: rotate(${drone.location.heading || 0}deg);">
              <path fill="${statusColor}" d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>

          <!-- Micro Floating Label -->
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono text-white shadow-md border"
               style="background-color: rgba(15, 23, 42, 0.95); border-color: ${statusColor};">
            ${drone.id} • ${drone.battery}%
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-drone-marker',
        html: droneHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([displayLat, displayLng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedDrone(drone);
        if (onSelectDrone) onSelectDrone(drone);
      });

      marker.bindTooltip(
        `<div class="p-1 space-y-1 text-xs">
          <div class="flex items-center justify-between gap-2 border-b border-slate-700 pb-1 font-bold">
            <span class="text-cyan-400 font-mono">${drone.id} (${drone.model})</span>
            <span class="text-[10px] uppercase px-1.5 py-0.5 rounded" style="background: ${statusColor}33; color: ${statusColor};">
              ${drone.status}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-300">
            <span>Battery: <b>${drone.battery}%</b></span>
            <span>Altitude: <b>${drone.location.altitude || 70}m</b></span>
            <span>Speed: <b>${drone.location.speed || 34} km/h</b></span>
            <span>Signal: <b>${drone.signalStrength}%</b></span>
          </div>
        </div>`,
        { sticky: true, className: 'leaflet-popup-content-wrapper' }
      );

      group.addLayer(marker);
    });
  }, [drones, selectedDrone, layers, onSelectDrone]);

  // Fit fleet view helper
  const handleFitFleet = () => {
    if (!mapInstanceRef.current || drones.length === 0) return;
    const group = L.featureGroup(
      drones.map((d) => L.marker([d.location.lat, d.location.lng]))
    );
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
  };

  // Locate selected drone
  const handleLocateSelected = () => {
    if (selectedDrone && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([selectedDrone.location.lat, selectedDrone.location.lng], 16, { duration: 1 });
    } else {
      handleFitFleet();
    }
  };

  // Selected Drone Active Order Info
  const activeOrder = useMemo(() => {
    if (!selectedDrone) return orders[0] || null;
    return orders.find((o) => o.droneId === selectedDrone.id || o.missionId === selectedDrone.currentMissionId) || orders[0];
  }, [selectedDrone, orders]);

  return (
    <div
      className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-50 h-screen rounded-none' : `${heightClass} rounded-3xl`} border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden shadow-2xl group transition-all duration-300`}
    >
      {/* Top Header Overlay: Live Drone Operations Title + Subtitle */}
      <div className="absolute left-4 top-4 z-[400] flex flex-wrap items-center gap-2">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 p-2.5 backdrop-blur-xl shadow-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                LIVE DRONE OPERATIONS
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {drones.filter((d) => d.status === 'in_flight').length} Airborne
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Real-time autonomous fleet tracking • Coimbatore Airspace Hub (11.0168° N, 76.9558° E)
            </p>
          </div>
        </div>
      </div>

      {/* Top Right Controls: [Map] [Satellite] [Hybrid] [Fullscreen] [Fit Fleet] [Layers] */}
      <div className="absolute right-4 top-4 z-[400] flex items-center gap-2">
        {/* Map Type Mode Switcher */}
        <div className="flex items-center rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 p-1 backdrop-blur-xl shadow-2xl text-xs font-bold">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mapType === 'roadmap'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mapType === 'satellite'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapType('hybrid')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mapType === 'hybrid'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Hybrid
          </button>
        </div>

        {/* Layer Controls Dropdown Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu((prev) => !prev)}
            className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-2xl backdrop-blur-xl transition-colors"
            title="Map Layer Controls"
          >
            <Layers className="w-4 h-4 text-cyan-500" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-3 z-50 space-y-2 text-xs">
              <p className="font-bold text-[10px] font-mono uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                MAP LAYERS
              </p>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-500">
                  <input
                    type="checkbox"
                    checked={layers.activeDrones}
                    onChange={(e) => setLayers({ ...layers, activeDrones: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  Active Drones
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-500">
                  <input
                    type="checkbox"
                    checked={layers.plannedRoutes}
                    onChange={(e) => setLayers({ ...layers, plannedRoutes: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  Planned Routes
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-500">
                  <input
                    type="checkbox"
                    checked={layers.actualRoutes}
                    onChange={(e) => setLayers({ ...layers, actualRoutes: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  Actual Routes
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-500">
                  <input
                    type="checkbox"
                    checked={layers.deliveryZones}
                    onChange={(e) => setLayers({ ...layers, deliveryZones: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  Delivery Zones
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-500">
                  <input
                    type="checkbox"
                    checked={layers.restrictedZones}
                    onChange={(e) => setLayers({ ...layers, restrictedZones: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  Restricted / Airport Zones
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-500">
                  <input
                    type="checkbox"
                    checked={layers.cautionZones}
                    onChange={(e) => setLayers({ ...layers, cautionZones: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  Caution Event Zones
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Fit Fleet & Fullscreen */}
        <button
          onClick={handleLocateSelected}
          className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-2xl backdrop-blur-xl"
          title="Fit Fleet in View"
        >
          <Target className="w-4 h-4 text-cyan-500" />
        </button>

        <button
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-2xl backdrop-blur-xl"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Visual Route Deviation Banner (Section 12) if D-024 is flying */}
      {selectedDrone?.id === 'D-024' && (
        <div className="absolute top-20 left-4 z-[400] max-w-sm rounded-2xl border border-amber-500/50 bg-amber-500/15 backdrop-blur-xl p-3.5 shadow-2xl text-xs space-y-2 animate-slide-up">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" /> ROUTE DEVIATION DETECTED
            </h4>
            <span className="font-mono font-bold text-amber-400 text-[10px]">320m Off Route</span>
          </div>
          <p className="text-[11px] text-amber-100">
            Drone <b>D-024</b> drifted south of Peelamedu Air Corridor on Mission <b>MS-10284</b>. Autopilot holding altitude at 82m.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (onEmergencyAction) onEmergencyAction('D-024', 'RTH');
              }}
              className="flex-1 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] transition-colors"
            >
              Re-align Corridor
            </button>
            <button
              onClick={() => {
                if (onEmergencyAction) onEmergencyAction('D-024', 'RTH');
              }}
              className="py-1 px-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition-colors"
            >
              RTH Override
            </button>
          </div>
        </div>
      )}

      {/* Floating Route Information Panel (Section 11) */}
      {selectedDrone && (
        <div className="absolute right-4 bottom-4 z-[400] w-80 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl p-4 shadow-2xl space-y-3 animate-slide-up">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-cyan-600 dark:text-cyan-400">{selectedDrone.id}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40">
                  {selectedDrone.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Mission: {selectedDrone.currentMissionId || 'MS-10284'}
              </p>
            </div>
            <button
              onClick={() => setSelectedDrone(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">FROM:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                {activeOrder?.pickupAddress || 'Coimbatore Hub'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TO:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                {activeOrder?.destinationAddress || 'Customer Delivery Point'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px]">
            <div>
              <span className="text-slate-400 block">DISTANCE</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">8.4 km</span>
            </div>
            <div>
              <span className="text-slate-400 block">TRAVELLED</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs">5.7 km</span>
            </div>
            <div>
              <span className="text-slate-400 block">ETA</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">06:42</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-1">
              <Battery className="w-3 h-3 text-cyan-500" />
              <span>{selectedDrone.battery}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-emerald-500" />
              <span>{selectedDrone.location.altitude || 82}m</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-blue-500" />
              <span>{selectedDrone.location.speed || 34}km/h</span>
            </div>
          </div>

          {/* Quick Command Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (onEmergencyAction) onEmergencyAction(selectedDrone.id, 'RTH');
              }}
              className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors border border-slate-300 dark:border-slate-700"
            >
              Return Base
            </button>
            <button
              onClick={() => {
                if (onEmergencyAction) onEmergencyAction(selectedDrone.id, 'LAND');
              }}
              className="py-1.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-bold rounded-xl text-xs transition-colors border border-rose-500/30"
            >
              Hold / Land
            </button>
          </div>
        </div>
      )}

      {/* Floating Map Legend (Bottom-Left) */}
      <div className="absolute left-4 bottom-4 z-[400] hidden lg:block rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 p-3.5 backdrop-blur-2xl text-[11px] shadow-2xl w-48 space-y-2">
        <p className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[9px] font-mono border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
          <span>AIRSPACE LEGEND</span>
          <Target className="w-3 h-3 text-cyan-500" />
        </p>
        <div className="space-y-1.5 text-[10px] text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <span>● In Flight (Active)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>● Available (Hub)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>● Charging Station</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>● Emergency Alert</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-cyan-500" />
            <span>━━ Planned Route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-emerald-500" />
            <span>━━ Actual Route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2 rounded bg-emerald-500/20 border border-emerald-500" />
            <span>Delivery Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2 rounded bg-rose-500/20 border border-rose-500" />
            <span>Restricted / No-Fly</span>
          </div>
        </div>
      </div>
    </div>
  );
};
