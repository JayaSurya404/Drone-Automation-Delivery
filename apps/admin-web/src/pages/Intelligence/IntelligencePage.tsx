import React, { useState, useEffect, useCallback } from 'react';
import { Eye, MapPin, Compass, ShieldAlert, Cpu, Sparkles, Navigation, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { adminApiClient } from '../../context/AuthContext';
import { mockStore } from '../../services/mockDataStore';
import type { VisionAnalysis, LandingZoneEvaluation, Drone } from '@skynav/shared-types';

export const IntelligencePage: React.FC = () => {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<string>('');
  const [lat, setLat] = useState<string>('11.1132');
  const [lng, setLng] = useState<string>('77.0277');
  const [altitude, setAltitude] = useState<string>('45');
  const [visionResult, setVisionResult] = useState<VisionAnalysis | null>(null);
  const [visionLoading, setVisionLoading] = useState<boolean>(false);
  const [recentAnalyses, setRecentAnalyses] = useState<VisionAnalysis[]>([]);

  // Landing Zone evaluation state
  const [lzDroneId, setLzDroneId] = useState<string>('');
  const [lzLat, setLzLat] = useState<string>('11.0800');
  const [lzLng, setLzLng] = useState<string>('77.0400');
  const [lzResult, setLzResult] = useState<LandingZoneEvaluation | null>(null);
  const [lzLoading, setLzLoading] = useState<boolean>(false);
  const [recentLz, setRecentLz] = useState<LandingZoneEvaluation[]>([]);

  // Corridor route intelligence state
  const [corridorOriginLat, setCorridorOriginLat] = useState<string>('11.1132');
  const [corridorOriginLng, setCorridorOriginLng] = useState<string>('77.0277');
  const [corridorDestLat, setCorridorDestLat] = useState<string>('11.0800');
  const [corridorDestLng, setCorridorDestLng] = useState<string>('77.0400');
  const [corridorResult, setCorridorResult] = useState<any | null>(null);
  const [corridorLoading, setCorridorLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'vision' | 'landing_zone' | 'corridor'>('vision');

  const loadInitialData = useCallback(async () => {
    try {
      const droneList = await adminApiClient.listDrones({ pageSize: 50 });
      setDrones(droneList.drones || []);
      if (droneList.drones?.length > 0) {
        setSelectedDroneId(droneList.drones[0].id);
        setLzDroneId(droneList.drones[0].id);
      }
    } catch {
      const fallback = mockStore.getDrones() as any;
      setDrones(fallback);
      if (fallback.length > 0) {
        setSelectedDroneId(fallback[0].id);
        setLzDroneId(fallback[0].id);
      }
    }

    try {
      const rec = await adminApiClient.listVisionAnalyses(5);
      setRecentAnalyses(rec || []);
    } catch {
      // offline / initial
    }

    try {
      const lzRec = await adminApiClient.listLandingZoneEvaluations(5);
      setRecentLz(lzRec || []);
    } catch {
      // offline / initial
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleAnalyzeVision = async () => {
    setVisionLoading(true);
    try {
      const res = await adminApiClient.analyzeVisionFrame({
        droneId: selectedDroneId || undefined,
        lat: Number(lat),
        lng: Number(lng),
        altitudeMeters: Number(altitude),
      });
      setVisionResult(res);
      const rec = await adminApiClient.listVisionAnalyses(5);
      setRecentAnalyses(rec || []);
    } catch (err: any) {
      console.error('Vision analysis error:', err);
    } finally {
      setVisionLoading(false);
    }
  };

  const handleEvaluateLandingZone = async () => {
    setLzLoading(true);
    try {
      const res = await adminApiClient.evaluateLandingZone({
        droneId: lzDroneId || undefined,
        lat: Number(lzLat),
        lng: Number(lzLng),
      });
      setLzResult(res);
      const lzRec = await adminApiClient.listLandingZoneEvaluations(5);
      setRecentLz(lzRec || []);
    } catch (err: any) {
      console.error('Landing zone error:', err);
    } finally {
      setLzLoading(false);
    }
  };

  const handleLookupCorridor = async () => {
    setCorridorLoading(true);
    try {
      const token = adminApiClient.getAccessToken();
      const res = await fetch(
        `/api/v1/route-intelligence?originLat=${corridorOriginLat}&originLng=${corridorOriginLng}&destinationLat=${corridorDestLat}&destinationLng=${corridorDestLng}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const json = await res.json();
      setCorridorResult(json.data || json);
    } catch (err: any) {
      console.error('Corridor lookup error:', err);
    } finally {
      setCorridorLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-cyan-500" /> Advanced Intelligence & Autonomous Vision
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
              <Sparkles className="h-3 w-3" /> Simulation & Synthetic Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Computer vision landing candidate verification, landing-zone obstacle detection, and shared corridor risk scoring across Coimbatore.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 text-xs">
          <button
            onClick={() => setActiveTab('vision')}
            className={`rounded-lg px-3 py-1 font-semibold transition-all ${
              activeTab === 'vision' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Vision Obstacle Detection
          </button>
          <button
            onClick={() => setActiveTab('landing_zone')}
            className={`rounded-lg px-3 py-1 font-semibold transition-all ${
              activeTab === 'landing_zone' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Landing Zone Suitability
          </button>
          <button
            onClick={() => setActiveTab('corridor')}
            className={`rounded-lg px-3 py-1 font-semibold transition-all ${
              activeTab === 'corridor' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Corridor Intelligence
          </button>
        </div>
      </div>

      {/* Tab 1: Vision Frame Analysis */}
      {activeTab === 'vision' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-500" /> Synthetic Optical Frame Analysis
                </h3>
                <span className="text-xs text-slate-400 font-mono">50 km/h Autonomous Cruise</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Target Drone</label>
                  <select
                    value={selectedDroneId}
                    onChange={(e) => setSelectedDroneId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Standalone Camera</option>
                    {drones.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.model})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Latitude</label>
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Longitude</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Altitude (AGL)</label>
                  <input
                    type="text"
                    value={altitude}
                    onChange={(e) => setAltitude(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleAnalyzeVision}
                  disabled={visionLoading}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 text-xs flex items-center gap-2 shadow-md shadow-cyan-600/20 disabled:opacity-50"
                >
                  {visionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Run Neural Vision Evaluation
                </button>
              </div>

              {visionResult && (
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Analysis Output: {visionResult.summary}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(visionResult.createdAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Detected Obstacles / Objects:</span>
                    {visionResult.objects.length === 0 ? (
                      <p className="text-xs text-slate-400">Air corridor clear. No obstruction detected.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {visionResult.objects.map((obj, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{obj.class}</span>
                            <span className="font-mono text-cyan-600 dark:text-cyan-400">{(obj.confidence * 100).toFixed(0)}% confidence</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Recent Vision Detections
              </h3>
              {recentAnalyses.length === 0 ? (
                <p className="text-xs text-slate-400">No prior scans recorded.</p>
              ) : (
                <div className="space-y-2">
                  {recentAnalyses.map((rec) => (
                    <div key={rec.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-slate-700 dark:text-slate-200">{rec.summary}</span>
                        <span className="text-[10px] text-slate-400">{new Date(rec.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{rec.objects.length} object(s) detected</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Landing Zone Suitability */}
      {activeTab === 'landing_zone' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-500" /> Downward Sensor Landing Zone Evaluation
                </h3>
                <span className="text-xs text-slate-400 font-mono">Threshold: 75/100</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">UAV Unit</label>
                  <select
                    value={lzDroneId}
                    onChange={(e) => setLzDroneId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Autonomous Downward Array</option>
                    {drones.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Target Latitude</label>
                  <input
                    type="text"
                    value={lzLat}
                    onChange={(e) => setLzLat(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Target Longitude</label>
                  <input
                    type="text"
                    value={lzLng}
                    onChange={(e) => setLzLng(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleEvaluateLandingZone}
                  disabled={lzLoading}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {lzLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify Landing Zone Safety
                </button>
              </div>

              {lzResult && (
                <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        lzResult.verdict === 'SUITABLE'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : lzResult.verdict === 'MARGINAL'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}>
                        VERDICT: {lzResult.verdict}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                        Suitability Score: {lzResult.suitabilityScore}/100
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Clear Area</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{lzResult.sizeScore}/100</p>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Obstruction Score</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{lzResult.obstructionScore}/100</p>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Safety Margin</span>
                      <p className="text-sm font-bold text-emerald-500">{lzResult.safetyScore}/100</p>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Proximity Score</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{lzResult.proximityScore}/100</p>
                    </div>
                  </div>

                  {lzResult.reasons?.length > 0 && (
                    <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                      {lzResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Recent Zone Evaluations
              </h3>
              {recentLz.length === 0 ? (
                <p className="text-xs text-slate-400">No recent evaluations recorded.</p>
              ) : (
                <div className="space-y-2">
                  {recentLz.map((rec) => (
                    <div key={rec.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 text-xs flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.verdict === 'SUITABLE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {rec.verdict}
                      </span>
                      <span className="text-slate-500 font-mono">{rec.suitabilityScore}/100</span>
                      <span className="text-slate-400 text-[10px]">{new Date(rec.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Corridor Intelligence */}
      {activeTab === 'corridor' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Navigation className="h-4 w-4 text-blue-500" /> Historical Corridor Performance & Hazard Analytics
              </h3>
              <span className="text-xs text-slate-400 font-mono">Air Corridors (SkyHub Kurumbapalayam)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Origin Lat</label>
                <input
                  type="text"
                  value={corridorOriginLat}
                  onChange={(e) => setCorridorOriginLat(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Origin Lng</label>
                <input
                  type="text"
                  value={corridorOriginLng}
                  onChange={(e) => setCorridorOriginLng(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Destination Lat</label>
                <input
                  type="text"
                  value={corridorDestLat}
                  onChange={(e) => setCorridorDestLat(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Destination Lng</label>
                <input
                  type="text"
                  value={corridorDestLng}
                  onChange={(e) => setCorridorDestLng(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleLookupCorridor}
                disabled={corridorLoading}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {corridorLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                Query Corridor Telemetry Database
              </button>
            </div>

            {corridorResult && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">Sample Missions</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{corridorResult.sampleSize ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">Avg. Distance</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {corridorResult.averageDistanceMeters ? `${(corridorResult.averageDistanceMeters / 1000).toFixed(2)} km` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">Avg. Duration</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {corridorResult.averageDurationSeconds ? `${Math.round(corridorResult.averageDurationSeconds)} s` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">Corridor Abort Rate</span>
                    <p className="text-sm font-bold text-emerald-500">
                      {corridorResult.abortRate !== null && corridorResult.abortRate !== undefined ? `${corridorResult.abortRate}%` : '0%'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
