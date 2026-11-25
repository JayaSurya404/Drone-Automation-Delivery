import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Play, RefreshCw, Sparkles, CheckCircle2, AlertTriangle, Layers, Plus, Compass, Clock, BatteryCharging } from 'lucide-react';
import { adminApiClient } from '../../context/AuthContext';
import { mockStore } from '../../services/mockDataStore';
import type { SimulationScenario, SimulationRun, Drone } from '@skynav/shared-types';

export const DigitalTwinPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [scenarioRuns, setScenarioRuns] = useState<SimulationRun[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);

  // New Scenario form state
  const [name, setName] = useState<string>('Coimbatore South Corridor What-If');
  const [originLat, setOriginLat] = useState<string>('11.1132');
  const [originLng, setOriginLng] = useState<string>('77.0277');
  const [destLat, setDestLat] = useState<string>('11.0800');
  const [destLng, setDestLng] = useState<string>('77.0400');
  const [droneId, setDroneId] = useState<string>('');
  const [payloadKg, setPayloadKg] = useState<string>('1.5');
  const [priority, setPriority] = useState<'STANDARD' | 'EXPRESS'>('STANDARD');
  const [creating, setCreating] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const droneList = await adminApiClient.listDrones({ pageSize: 50 });
      setDrones(droneList.drones || []);
    } catch {
      const fallback = mockStore.getDrones() as any;
      setDrones(fallback);
    }

    try {
      const scenarioList = await adminApiClient.listSimulationScenarios();
      setScenarios(scenarioList || []);
      if (scenarioList.length > 0) {
        setSelectedScenario(scenarioList[0]);
        const runs = await adminApiClient.listSimulationRuns(scenarioList[0].id);
        setScenarioRuns(runs || []);
      }
    } catch (err: any) {
      console.warn('Simulation scenario fetch notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectScenario = async (scenario: SimulationScenario) => {
    setSelectedScenario(scenario);
    try {
      const runs = await adminApiClient.listSimulationRuns(scenario.id);
      setScenarioRuns(runs || []);
    } catch (err: any) {
      console.error('Failed to load scenario runs:', err);
    }
  };

  const handleCreateScenario = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await adminApiClient.createSimulationScenario({
        name: name.trim(),
        originLat: Number(originLat),
        originLng: Number(originLng),
        destinationLat: Number(destLat),
        destinationLng: Number(destLng),
        droneId: droneId || undefined,
        payloadKg: Number(payloadKg),
        priority,
      });
      setName('New What-If Analysis');
      await loadData();
      setSelectedScenario(created);
    } catch (err: any) {
      console.error('Failed to create scenario:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteWhatIfRun = async () => {
    if (!selectedScenario) return;
    setRunning(true);
    try {
      await adminApiClient.runSimulation(selectedScenario.id);
      const runs = await adminApiClient.listSimulationRuns(selectedScenario.id);
      setScenarioRuns(runs || []);
    } catch (err: any) {
      console.error('Failed to execute simulation run:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-500" /> Digital Twin Offline What-If Simulator
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
              <Sparkles className="h-3 w-3" /> Fully Isolated Offline Sandbox
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Offline what-if trajectory simulation, payload energy stress testing, and weather tolerance evaluation — completely isolated from live flight-control systems.
          </p>
        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="self-start md:self-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Scenarios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenarios List & Form */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Plus className="h-4 w-4 text-purple-500" /> New What-If Scenario
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Scenario Title</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Origin Lat</label>
                  <input
                    type="text"
                    value={originLat}
                    onChange={(e) => setOriginLat(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Origin Lng</label>
                  <input
                    type="text"
                    value={originLng}
                    onChange={(e) => setOriginLng(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Dest Lat</label>
                  <input
                    type="text"
                    value={destLat}
                    onChange={(e) => setDestLat(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Dest Lng</label>
                  <input
                    type="text"
                    value={destLng}
                    onChange={(e) => setDestLng(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Payload (kg)</label>
                  <input
                    type="text"
                    value={payloadKg}
                    onChange={(e) => setPayloadKg(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="EXPRESS">Express</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCreateScenario}
                  disabled={creating || !name.trim()}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Save Scenario Model
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Saved Scenarios
              </h4>
              {scenarios.length === 0 ? (
                <p className="text-xs text-slate-400">No scenarios created yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {scenarios.map((sc) => (
                    <div
                      key={sc.id}
                      onClick={() => handleSelectScenario(sc)}
                      className={`rounded-xl border p-2.5 cursor-pointer transition-all text-xs ${
                        selectedScenario?.id === sc.id
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">{sc.name}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">Payload: {sc.payloadKg} kg · {sc.priority}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What-If Run Inspector */}
        <div className="lg:col-span-2 space-y-4">
          {selectedScenario ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" /> Scenario: {selectedScenario.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    [{selectedScenario.originLat}, {selectedScenario.originLng}] → [{selectedScenario.destinationLat}, {selectedScenario.destinationLng}]
                  </span>
                </div>
                <button
                  onClick={handleExecuteWhatIfRun}
                  disabled={running}
                  className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 text-xs flex items-center gap-2 shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Execute What-If Run
                </button>
              </div>

              {/* Simulation Runs */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  Simulation Run History ({scenarioRuns.length})
                </h4>
                {scenarioRuns.length === 0 ? (
                  <p className="text-xs text-slate-400">Click &quot;Execute What-If Run&quot; above to calculate simulated flight performance.</p>
                ) : (
                  <div className="space-y-3">
                    {scenarioRuns.map((run) => (
                      <div key={run.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{run.summary}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(run.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Compass className="h-3 w-3" /> Distance
                            </span>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {run.distanceMeters ? `${(run.distanceMeters / 1000).toFixed(2)} km` : '—'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Duration
                            </span>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {run.durationSeconds ? `${Math.round(run.durationSeconds / 60)} min` : '—'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <BatteryCharging className="h-3 w-3" /> Battery Drain
                            </span>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {run.estimatedBatteryUsedPercent ? `${run.estimatedBatteryUsedPercent.toFixed(1)}%` : '—'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> Route Selected
                            </span>
                            <p className={`text-xs font-bold ${run.routeSelected ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {run.routeSelected ? 'Feasible' : 'Blocked'}
                            </p>
                          </div>
                        </div>

                        {run.riskFindings?.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[11px] font-semibold text-slate-500">Risk Assessment Findings:</span>
                            <ul className="text-[11px] text-slate-400 list-disc list-inside mt-0.5 space-y-0.5">
                              {run.riskFindings.map((finding) => (
                                <li key={finding.id}>
                                  <span className="font-semibold text-amber-500">[{finding.severity}] {finding.category}:</span> {finding.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400 text-xs">
              Select or create a scenario on the left to run offline what-if simulations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
