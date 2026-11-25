import React, { useState, useEffect, useMemo } from 'react';
import { Order, Drone } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { Bot, Battery, Scale, CheckCircle2, AlertTriangle, ShieldAlert, Star, ShieldCheck } from 'lucide-react';

interface DroneAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onAssigned?: () => void;
}

export const DroneAssignmentModal: React.FC<DroneAssignmentModalProps> = ({
  isOpen,
  onClose,
  order,
  onAssigned,
}) => {
  // Hooks MUST be called unconditionally at the top level
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [allDrones, setAllDrones] = useState<Drone[]>(() => mockStore.getDrones());

  // Subscribe to store updates for live drone availability
  useEffect(() => {
    return mockStore.subscribe(() => {
      setAllDrones([...mockStore.getDrones()]);
    });
  }, []);

  // Reset selection when modal opens or order changes
  useEffect(() => {
    if (isOpen) {
      setSelectedDroneId(null);
      setIsAssigning(false);
    }
  }, [isOpen, order?.id]);

  // Evaluate candidate drones safely
  const { candidateDrones, recommendation } = useMemo(() => {
    if (!order) {
      return {
        candidateDrones: [],
        recommendation: { drone: null, score: 0, reasons: [] },
      };
    }

    const packageWeight = order.packageWeightKg ?? 1.0;
    const candidates = allDrones.map((drone) => {
      const isPayloadCompatible = packageWeight <= (drone.payloadCapacity ?? 5.0);
      const isBatterySufficient = (drone.battery ?? 0) >= 35;
      const isAvailable = drone.status === 'available';
      const isHealthy = (drone.batteryHealth ?? 100) >= 80;
      const isEligible = isPayloadCompatible && isBatterySufficient && isAvailable && isHealthy;

      return {
        drone,
        isEligible,
        isPayloadCompatible,
        isBatterySufficient,
        isAvailable,
        isHealthy,
      };
    });

    const rec = mockStore.getRecommendedDrone(order);
    return { candidateDrones: candidates, recommendation: rec };
  }, [allDrones, order]);

  const recommendedDrone = recommendation.drone;

  const handleAssign = async () => {
    if (!order) return;
    const droneIdToAssign = selectedDroneId || recommendedDrone?.id;
    if (!droneIdToAssign) return;

    setIsAssigning(true);
    try {
      await mockStore.assignDroneToOrder(order.id, droneIdToAssign);
      if (onAssigned) onAssigned();
      onClose();
    } catch (err) {
      console.error('Error assigning drone:', err);
    } finally {
      setIsAssigning(false);
    }
  };

  // Safe early return ONLY after all hooks have been invoked
  if (!isOpen || !order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Autonomous Drone — Order #${order.id}`} maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
        {/* Order & Package Specs Overview */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100">{order.packageName}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Pickup: {order.merchantName} → Dropoff: {order.customerName}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Scale className="h-3.5 w-3.5" /> Payload: {order.packageWeightKg} kg
            </span>
          </div>
        </div>

        {/* Section 37: Smart Recommended Drone AI Highlight */}
        {recommendedDrone && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider text-[11px]">
                <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" /> RECOMMENDED DRONE — BEST MATCH ({recommendation.score}% Score)
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{recommendedDrone.id}</span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              <b>{recommendedDrone.model}</b> is ranked highest for this delivery based on battery reserves and payload capacity.
            </p>

            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-slate-600 dark:text-slate-300">
              {recommendation.reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Candidate Drones List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
            All Available Autonomous Fleet Units ({candidateDrones.filter((c) => c.isEligible).length} Eligible)
          </h4>

          {candidateDrones.map(({ drone, isEligible, isPayloadCompatible }) => {
            const isRec = recommendedDrone?.id === drone.id;
            const isSelected = (selectedDroneId || recommendedDrone?.id) === drone.id;

            return (
              <div
                key={drone.id}
                onClick={() => isEligible && setSelectedDroneId(drone.id)}
                className={`rounded-2xl border p-3 transition-all flex items-center justify-between ${
                  !isEligible
                    ? 'opacity-50 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/30 cursor-not-allowed'
                    : isSelected
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 shadow-md cursor-pointer'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-cyan-600 dark:text-cyan-400">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-mono font-bold text-slate-900 dark:text-slate-100">{drone.id}</h5>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">({drone.model})</span>
                      {isRec && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                          ★ BEST MATCH
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Battery className="h-3 w-3 text-cyan-500" /> Battery: {drone.battery}%
                      </span>
                      <span>Capacity: {drone.payloadCapacity} kg</span>
                      <span>Health: {drone.batteryHealth}%</span>
                    </div>

                    {!isPayloadCompatible && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                        <ShieldAlert className="h-3 w-3" />
                        Package ({order.packageWeightKg} kg) exceeds max capacity ({drone.payloadCapacity} kg)
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <StatusBadge status={drone.status} size="sm" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={(!recommendedDrone && !selectedDroneId) || isAssigning}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> {isAssigning ? 'Reserving Drone...' : 'Confirm Drone Assignment & Dispatch'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
