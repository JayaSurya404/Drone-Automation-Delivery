import React, { useState, useEffect, useCallback } from 'react';
import { Share2, Users, Bot, RefreshCw, Sparkles, CheckCircle2, AlertTriangle, Layers, Plus, ArrowRight } from 'lucide-react';
import { adminApiClient } from '../../context/AuthContext';
import { mockStore } from '../../services/mockDataStore';
import type { Swarm, SwarmDetail, SwarmPlan, Drone } from '@skynav/shared-types';

export const SwarmPage: React.FC = () => {
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [selectedSwarm, setSelectedSwarm] = useState<SwarmDetail | null>(null);
  const [swarmPlans, setSwarmPlans] = useState<SwarmPlan[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newSwarmName, setNewSwarmName] = useState<string>('');
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
      const swarmsList = await adminApiClient.listSwarms();
      setSwarms(swarmsList || []);
      if (swarmsList.length > 0) {
        const detail = await adminApiClient.getSwarm(swarmsList[0].id);
        setSelectedSwarm(detail);
        const plans = await adminApiClient.listSwarmPlans(swarmsList[0].id);
        setSwarmPlans(plans || []);
      }
    } catch (err: any) {
      console.warn('Swarm data fetch notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectSwarm = async (id: string) => {
    try {
      const detail = await adminApiClient.getSwarm(id);
      setSelectedSwarm(detail);
      const plans = await adminApiClient.listSwarmPlans(id);
      setSwarmPlans(plans || []);
    } catch (err: any) {
      console.error('Failed to load swarm detail:', err);
    }
  };

  const handleCreateSwarm = async () => {
    if (!newSwarmName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApiClient.createSwarm({
        name: newSwarmName.trim(),
      });
      // Enroll available drones into the new swarm
      for (const d of drones.slice(0, 3)) {
        await adminApiClient.addSwarmMember(created.id, { droneId: d.id, role: 'FOLLOWER' }).catch(() => {});
      }
      setNewSwarmName('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to create swarm:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Share2 className="h-5 w-5 text-indigo-500" /> Swarm Fleet Load Balancing & Coordination
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
              <Sparkles className="h-3 w-3" /> Simulation Algorithm
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dynamic swarm partitioning, decentralized task allocation, and inter-hub fleet rebalancing across Tamil Nadu SkyHubs.
          </p>
        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="self-start md:self-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Swarm Telemetry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Swarms List */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" /> Active Swarm Groups
            </h3>

            {/* Create Swarm Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New Swarm Name..."
                value={newSwarmName}
                onChange={(e) => setNewSwarmName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                onClick={handleCreateSwarm}
                disabled={creating || !newSwarmName.trim()}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 text-xs flex items-center gap-1 shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Deploy
              </button>
            </div>

            {swarms.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No active swarm groups deployed. Deploy a swarm above.</p>
            ) : (
              <div className="space-y-2">
                {swarms.map((sw) => (
                  <div
                    key={sw.id}
                    onClick={() => handleSelectSwarm(sw.id)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      selectedSwarm?.id === sw.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{sw.name}</span>
                      <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 font-bold">
                        {sw.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{sw.memberCount} node(s) connected</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Swarm Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedSwarm ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-500" /> Swarm Configuration: {selectedSwarm.name}
                  </h3>
                  <span className="text-xs text-slate-400">ID: {selectedSwarm.id}</span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-500">
                  {selectedSwarm.members?.length ?? 0} UAV Units Enrolled
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Enrolled Drone Nodes</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedSwarm.members?.map((member) => (
                    <div key={member.droneId} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">Drone {member.droneName || member.droneId.slice(0, 8)}</span>
                        <p className="text-[10px] text-slate-400">Role: {member.role}</p>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        Enrolled
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Swarm Allocation Plans */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Load Allocation Plans</h4>
                {swarmPlans.length === 0 ? (
                  <p className="text-xs text-slate-400">No active coordination plan recorded for this group.</p>
                ) : (
                  <div className="space-y-2">
                    {swarmPlans.map((plan) => (
                      <div key={plan.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span>Plan: {plan.status}</span>
                          <span className="text-[10px] text-slate-400">{new Date(plan.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="space-y-1">
                          {plan.assignments?.map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Delivery: {a.deliveryId ? a.deliveryId.slice(0, 8) : 'Direct Transit'}</span>
                              <span className="flex items-center gap-1 font-mono text-indigo-400">
                                Allocated to UAV {a.droneName || a.droneId?.slice(0, 8) || 'Unassigned'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400 text-xs">
              Select or deploy a swarm to inspect drone nodes and load-balancing schedules.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
