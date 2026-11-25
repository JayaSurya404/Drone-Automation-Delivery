import React, { useState, useEffect, useRef } from 'react';
import { Mission } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { Modal } from '../common/Modal';
import L from 'leaflet';
import {
  Play,
  Pause,
  RotateCcw,
  PlaneTakeoff,
  Gauge,
  Battery,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  FastForward,
} from 'lucide-react';

interface MissionReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId?: string;
}

export const MissionReplayModal: React.FC<MissionReplayModalProps> = ({
  isOpen,
  onClose,
  missionId = 'MS-10284',
}) => {
  const missions = mockStore.getMissions();
  const [selectedId, setSelectedId] = useState(missionId);
  const mission = missions.find((m) => m.id === selectedId) || missions[0];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const droneMarkerRef = useRef<L.Marker | null>(null);
  const completedPolylineRef = useRef<L.Polyline | null>(null);

  // Timeline progress: 0 to 100%
  const [progress, setProgress] = useState(35);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Flight waypoints
  const origin: [number, number] = mission ? [mission.pickupCoords.lat, mission.pickupCoords.lng] : [11.0168, 76.9558];
  const destination: [number, number] = mission ? [mission.destinationCoords.lat, mission.destinationCoords.lng] : [11.028, 77.002];

  // Auto-play interval
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 1 * speedMultiplier;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying, speedMultiplier]);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: origin,
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri World Imagery',
        maxZoom: 18,
      }).addTo(map);

      // Corridor Planned Polyline
      L.polyline([origin, destination], {
        color: '#06b6d4',
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.8,
      }).addTo(map);

      // Origin Marker
      L.marker(origin, {
        icon: L.divIcon({
          className: 'origin-marker',
          html: `<div style="background: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">A</div>`,
          iconSize: [24, 24],
        }),
      })
        .addTo(map)
        .bindPopup(`<b>Launch Pad:</b> ${mission.pickupAddress}`);

      // Destination Marker
      L.marker(destination, {
        icon: L.divIcon({
          className: 'destination-marker',
          html: `<div style="background: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">B</div>`,
          iconSize: [24, 24],
        }),
      })
        .addTo(map)
        .bindPopup(`<b>Dropzone:</b> ${mission.destinationAddress}`);

      // Completed Path
      const completedPolyline = L.polyline([origin, origin], {
        color: '#10b981',
        weight: 5,
        opacity: 0.9,
      }).addTo(map);
      completedPolylineRef.current = completedPolyline;

      // Moving Drone Marker
      const droneIcon = L.divIcon({
        className: 'custom-drone-marker',
        html: `
          <div style="background: linear-gradient(135deg, #06b6d4, #2563eb); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 0 16px rgba(6,182,212,0.9);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <polygon points="12 2 19 21 12 17 5 21 12 2"/>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const droneMarker = L.marker(origin, { icon: droneIcon }).addTo(map);
      droneMarkerRef.current = droneMarker;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, selectedId]);

  // Update drone position as progress changes
  useEffect(() => {
    if (!mapInstanceRef.current || !droneMarkerRef.current || !completedPolylineRef.current) return;

    const lat = origin[0] + (destination[0] - origin[0]) * (progress / 100);
    const lng = origin[1] + (destination[1] - origin[1]) * (progress / 100);
    const currentPos: [number, number] = [lat, lng];

    droneMarkerRef.current.setLatLng(currentPos);
    completedPolylineRef.current.setLatLngs([origin, currentPos]);
  }, [progress, origin, destination]);

  if (!isOpen || !mission) return null;

  // Dynamic telemetry calculations
  const currentAlt = progress < 10 ? Math.round(progress * 12) : progress > 90 ? Math.round((100 - progress) * 12) : 120;
  const currentSpeed = progress < 5 ? 15 : progress > 92 ? 8 : 45;
  const batteryLeft = Math.round(92 - (progress / 100) * 18);
  const elapsedSecs = Math.round((progress / 100) * 540);
  const elapsedMins = Math.floor(elapsedSecs / 60);
  const elapsedRemainingSecs = elapsedSecs % 60;
  const timeFormatted = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedRemainingSecs).padStart(2, '0')}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Autonomous Mission Replay — ${mission.id}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
        {/* Mission Details Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900 text-white border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-cyan-400">{mission.id}</span>
              <span className="font-bold text-slate-200">Drone: {mission.droneId}</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-[10px]">
                ● HISTORICAL REPLAY
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-lg">
              {mission.pickupAddress} → {mission.destinationAddress} (Distance: {mission.distanceKm} km)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-mono">Mission:</span>
            <select
              value={mission.id}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setProgress(0);
                setIsPlaying(false);
              }}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-cyan-300 focus:outline-none"
            >
              {missions.slice(0, 10).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} (Drone: {m.droneId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Real Leaflet Geospatial Replay Map */}
        <div className="h-72 w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Floating Live Telemetry Badge */}
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 text-white shadow-xl z-[1000] grid grid-cols-4 gap-3 text-center font-mono text-[11px]">
            <div>
              <span className="text-slate-400 text-[9px] block">TIMELINE</span>
              <span className="font-bold text-cyan-400">{timeFormatted}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[9px] block">ALTITUDE</span>
              <span className="font-bold text-slate-100">{currentAlt} m</span>
            </div>
            <div>
              <span className="text-slate-400 text-[9px] block">SPEED</span>
              <span className="font-bold text-slate-100">{currentSpeed} km/h</span>
            </div>
            <div>
              <span className="text-slate-400 text-[9px] block">BATTERY</span>
              <span className="font-bold text-emerald-400">{batteryLeft}%</span>
            </div>
          </div>
        </div>

        {/* Interactive Playback Scrubber & Controls */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          {/* Scrubber Range Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>00:00 (Departure)</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                {progress < 20 ? 'Takeoff & Climb' : progress < 80 ? 'Cruising Airway' : progress < 100 ? 'Descent & Drop' : 'Mission Completed'} ({Math.round(progress)}%)
              </span>
              <span>09:00 (Delivery Drop)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Player Buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause Replay' : 'Play Replay'}</span>
              </button>

              <button
                onClick={() => {
                  setProgress(0);
                  setIsPlaying(false);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Reset to 00:00"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Speed multipliers */}
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-xl font-mono text-[11px] font-bold">
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeedMultiplier(spd)}
                  className={`px-2 py-1 rounded-lg transition-colors ${
                    speedMultiplier === spd
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
