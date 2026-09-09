import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { mockStore } from '../../services/mockDataStore';
import {
  Zap,
  Radio,
  AlertOctagon,
  BatteryWarning,
  Compass,
  Wind,
  ShieldAlert,
  HeartPulse,
  Play,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Bot,
} from 'lucide-react';

interface SimulationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScenario?: string;
}

export const SCENARIOS = [
  {
    id: 'normal',
    title: '1. Autonomous Commercial Express Drop',
    desc: 'Simulate flawless nominal corridor flight from Coimbatore Hub Pad 1 to RS Puram with auto-tether release.',
    icon: Zap,
    severity: 'Nominal',
    badge: 'Standard Operations',
    actionLog: 'Mission MS-10290 launched nominal trajectory. Altitude 120m, Speed 45 km/h.',
  },
  {
    id: 'battery',
    title: '2. Critical Low Battery Warning & RTH',
    desc: 'Simulate unexpected cell voltage drop on D-011 down to 18%. Triggers automated Return to Home override.',
    icon: BatteryWarning,
    severity: 'Critical',
    badge: 'Power Fail-Safe',
    actionLog: 'D-011 battery critical at 18%. Autonomous Fail-safe RTH executed. Landing at safe hub.',
  },
  {
    id: 'deviation',
    title: '3. Airspace Route Deviation Alert (D-024)',
    desc: 'Simulate crosswind drift on D-024, pushing it 320m off corridor into Peelamedu Caution Zone.',
    icon: Compass,
    severity: 'Warning',
    badge: 'Navigation Risk',
    actionLog: 'D-024 drifted 320m East of corridor. Autopilot thrust vectoring engaged for re-alignment.',
  },
  {
    id: 'gps',
    title: '4. RTK GPS Loss & Optical Flow Failover',
    desc: 'Simulate GNSS satellite loss. Flight controller switches immediately to downward Optical Flow LiDAR.',
    icon: Radio,
    severity: 'Warning',
    badge: 'Sensor Failover',
    actionLog: 'Dual RTK lock dropped. Optical Flow hovering engaged. Position stabilized at 120m.',
  },
  {
    id: 'weather',
    title: '5. High Wind Gust & Airspace Weather Alert',
    desc: 'Simulate sudden 42 km/h wind shear over Gandhipuram. Flight altitudes restricted to 60m.',
    icon: Wind,
    severity: 'Caution',
    badge: 'Airspace Weather',
    actionLog: 'Wind shear detected (42 km/h). Speed capped at 25 km/h for all active corridor drones.',
  },
  {
    id: 'nofly',
    title: '6. DGCA Airport No-Fly Zone Boundary Bounce',
    desc: 'Simulate delivery route approaching Coimbatore International Airport red zone. Automatic repulsion activated.',
    icon: ShieldAlert,
    severity: 'Critical',
    badge: 'Geofence Enforcement',
    actionLog: 'Proximity alert: 150m from Airport Red Zone. Hard geofence barrier enforced waypoint reroute.',
  },
  {
    id: 'medical',
    title: '7. Emergency Medical Priority Corridor',
    desc: 'Simulate urgent blood/organ transport between KMCH and Ganga Hospital. All other routes yield right-of-way.',
    icon: HeartPulse,
    severity: 'Priority',
    badge: 'Medical Expedited',
    actionLog: 'Medical Priority Airway active: MS-99002. High-speed 85 km/h VTOL corridor cleared.',
  },
];

export const SimulationCenterModal: React.FC<SimulationCenterModalProps> = ({
  isOpen,
  onClose,
  initialScenario = 'deviation',
}) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState(initialScenario);
  const [isRunning, setIsRunning] = useState(false);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunScenario = (scenarioId: string) => {
    setIsRunning(true);
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];

    setTimeout(() => {
      setIsRunning(false);
      setLastExecuted(scenario.title);

      // Trigger actual system changes in mock store
      if (scenarioId === 'battery') {
        mockStore.triggerEmergency(
          'D-011',
          'Critical Battery',
          'Simulated 18% battery state. Autonomous RTH initiated.'
        );
      } else if (scenarioId === 'deviation') {
        mockStore.triggerEmergency(
          'D-024',
          'Route Deviation',
          'Simulated 320m drift off corridor in Peelamedu.'
        );
      }

      addToast(
        scenario.severity === 'Critical' ? 'error' : scenario.severity === 'Warning' ? 'warning' : 'success',
        `Simulation Executed: ${scenario.title}`,
        scenario.actionLog
      );
    }, 600);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Interactive Operations Simulation & Scenario Engine"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
        {/* Full 3D Story Simulation Hero Launch Card */}
        <div
          onClick={() => {
            onClose();
            navigate('/simulation');
          }}
          className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/50 shadow-xl cursor-pointer hover:border-cyan-400 transition-all flex items-center justify-between gap-4 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                  Launch Realistic 3D Autonomous Drone Story Simulation
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-mono font-black text-[9px] uppercase">
                  3D LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Full 15-scene visual delivery story: Takeoff ➔ Cruise ➔ Obstacle Avoidance ➔ Precision Drop ➔ Return to Base.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 font-bold text-xs text-cyan-600 dark:text-cyan-400 shrink-0 group-hover:translate-x-1 transition-transform">
            <span>Open Center</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Simulation Disclaimer Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-2.5">
          <Bot className="w-5 h-5 text-cyan-500 shrink-0" />
          <div className="text-[11px]">
            <span className="font-bold block uppercase tracking-wider font-mono text-slate-900 dark:text-slate-100">QUICK INJECT SCENARIOS</span>
            <span>
              Trigger individual fault-injection events into the live production airspace mock ledger.
            </span>
          </div>
        </div>

        {/* Scenarios Grid */}
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
          {SCENARIOS.map((sc) => {
            const Icon = sc.icon;
            const isSelected = selectedScenario === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => setSelectedScenario(sc.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/80 shadow-md text-slate-900 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-200 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{sc.title}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[9px] font-mono font-bold uppercase text-cyan-700 dark:text-cyan-300">
                        {sc.badge}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">{sc.desc}</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunScenario(sc.id);
                  }}
                  disabled={isRunning}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Simulate</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          {lastExecuted ? (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Active Simulation: {lastExecuted}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono">Select any scenario and click Simulate</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold"
          >
            Close Engine
          </button>
        </div>
      </div>
    </Modal>
  );
};
