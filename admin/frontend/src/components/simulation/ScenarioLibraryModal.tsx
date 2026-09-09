import React, { useState } from 'react';
import { Modal } from '../common/Modal';
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
  Bot,
  CloudRain,
  Flame,
  Wrench,
  RotateCcw,
  Layers,
  HelpCircle,
} from 'lucide-react';

export interface PresetScenario {
  id: string;
  title: string;
  category: 'nominal' | 'emergency' | 'environmental' | 'fleet';
  desc: string;
  icon: any;
  severity: 'Nominal' | 'Warning' | 'Critical' | 'Priority';
  badge: string;
  recommendedDrone: string;
  durationSec: number;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'normal',
    title: '1. Standard Autonomous Medical Express',
    category: 'nominal',
    desc: 'Nominal corridor flight from Coimbatore Hub Pad 1 to RS Puram with automated cargo release.',
    icon: Zap,
    severity: 'Nominal',
    badge: 'Standard Delivery',
    recommendedDrone: 'D-024 (SKYNAV X1)',
    durationSec: 180,
  },
  {
    id: 'multi_drone',
    title: '2. Multi-Drone Simultaneous Fleet (10 UAVs)',
    category: 'fleet',
    desc: 'Dense city airway simulation coordinating 10 autonomous UAVs with dynamic spatial separation.',
    icon: Bot,
    severity: 'Nominal',
    badge: 'Multi-Drone',
    recommendedDrone: 'Fleet Alpha (10 Units)',
    durationSec: 240,
  },
  {
    id: 'high_demand',
    title: '3. Peak Surge Dispatch & Smart Queueing',
    category: 'fleet',
    desc: 'Simulate 25 simultaneous customer orders across tech corridors with automated battery batching.',
    icon: Layers,
    severity: 'Nominal',
    badge: 'High Demand',
    recommendedDrone: 'Fleet Beta (25 Units)',
    durationSec: 300,
  },
  {
    id: 'battery',
    title: '4. Critical Low Battery (18%) & RTH Divert',
    category: 'emergency',
    desc: 'Simulate unexpected cell degradation down to 18%. Autonomous Fail-Safe RTH overrides mission.',
    icon: BatteryWarning,
    severity: 'Critical',
    badge: 'Power Fail-Safe',
    recommendedDrone: 'D-011 (SKYNAV X2)',
    durationSec: 120,
  },
  {
    id: 'gps',
    title: '5. RTK Dual GNSS Loss & Optical Flow Lock',
    category: 'emergency',
    desc: 'Simulate loss of satellite constellation. Drone switches instantly to downward Optical Flow LiDAR.',
    icon: Radio,
    severity: 'Warning',
    badge: 'Sensor Failover',
    recommendedDrone: 'D-024 (SKYNAV X1)',
    durationSec: 150,
  },
  {
    id: 'comm_loss',
    title: '6. 5G Command Link Interruption & Autonomous Fallback',
    category: 'emergency',
    desc: 'Simulate cellular black spot. Autopilot engages autonomous offline return profile on RF 868MHz.',
    icon: Radio,
    severity: 'Warning',
    badge: 'Mesh Failover',
    recommendedDrone: 'D-009 (SKYNAV VTOL)',
    durationSec: 160,
  },
  {
    id: 'deviation',
    title: '7. Airspace Crosswind Drift & Corridor Realignment',
    category: 'environmental',
    desc: 'Simulate 320m drift off corridor in Peelamedu. Autopilot engages thrust vectoring re-centering.',
    icon: Compass,
    severity: 'Warning',
    badge: 'Navigation Risk',
    recommendedDrone: 'D-024 (SKYNAV X1)',
    durationSec: 140,
  },
  {
    id: 'weather',
    title: '8. Severe Wind Shear (45 km/h) & Rain Downburst',
    category: 'environmental',
    desc: 'Simulate sudden storm gusts. Drone lowers altitude to 60m and reduces cruise speed to 25 km/h.',
    icon: Wind,
    severity: 'Warning',
    badge: 'Weather Warning',
    recommendedDrone: 'D-031 (SKYNAV Cargo)',
    durationSec: 200,
  },
  {
    id: 'obstacle',
    title: '9. Unscheduled Construction Crane Obstacle Avoidance',
    category: 'emergency',
    desc: 'Simulate dynamic obstacle at 180m. LiDAR computes 120m lateral West bypass maneuver in 38ms.',
    icon: AlertOctagon,
    severity: 'Critical',
    badge: 'Dynamic Avoidance',
    recommendedDrone: 'D-024 (SKYNAV X1)',
    durationSec: 180,
  },
  {
    id: 'nofly',
    title: '10. DGCA International Airport No-Fly Zone Repulsion',
    category: 'emergency',
    desc: 'Simulate route encroaching Coimbatore Airport perimeter. Geofence repulsion initiates hard turn.',
    icon: ShieldAlert,
    severity: 'Critical',
    badge: 'Geofence Barrier',
    recommendedDrone: 'D-018 (SKYNAV X2)',
    durationSec: 140,
  },
  {
    id: 'emergency_landing',
    title: '11. Emergency Field Touchdown on Safe Helipad',
    category: 'emergency',
    desc: 'Simulate rotor bird strike anomaly. Drone identifies designated secondary rooftop landing zone.',
    icon: Flame,
    severity: 'Critical',
    badge: 'Field Landing',
    recommendedDrone: 'D-014 (SKYNAV Medical)',
    durationSec: 110,
  },
  {
    id: 'motor_failure',
    title: '12. Motor #3 ESC Vibration Anomaly & Limp Mode',
    category: 'emergency',
    desc: 'Simulate motor coil thermal spike. Flight controller adjusts quad-rotor PWM distribution.',
    icon: Wrench,
    severity: 'Critical',
    badge: 'Hardware Anomaly',
    recommendedDrone: 'D-031 (SKYNAV Cargo)',
    durationSec: 130,
  },
  {
    id: 'sensor_failure',
    title: '13. Barometric Altimeter Failure & LiDAR Fusion',
    category: 'emergency',
    desc: 'Simulate pitot tube blockage. System fuses laser rangefinder with inertial IMU integration.',
    icon: HelpCircle,
    severity: 'Warning',
    badge: 'Sensor Fusion',
    recommendedDrone: 'D-005 (SKYNAV X1)',
    durationSec: 120,
  },
  {
    id: 'return_home',
    title: '14. Automated Return to Base (RTH) Corridor Flight',
    category: 'nominal',
    desc: 'Simulate unladen high-speed inbound transit at 52 km/h back to central warehouse charging bay.',
    icon: RotateCcw,
    severity: 'Nominal',
    badge: 'Inbound Transit',
    recommendedDrone: 'D-024 (SKYNAV X1)',
    durationSec: 160,
  },
  {
    id: 'mission_failure',
    title: '15. Customer Address Blocked & Safe Package Abort',
    category: 'emergency',
    desc: 'Customer backyard landing pad obstructed by scaffolding. Drone aborts drop and returns package.',
    icon: AlertOctagon,
    severity: 'Warning',
    badge: 'Drop Abort',
    recommendedDrone: 'D-018 (SKYNAV X2)',
    durationSec: 170,
  },
  {
    id: 'mission_recovery',
    title: '16. Autonomous Mission Recovery & Relayed Handover',
    category: 'nominal',
    desc: 'Simulate dynamic air-to-ground mission handover to secondary UAV for long-range relay.',
    icon: HeartPulse,
    severity: 'Priority',
    badge: 'Relay Handover',
    recommendedDrone: 'D-024 + D-012 Relay',
    durationSec: 220,
  },
];

interface ScenarioLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (scenario: PresetScenario) => void;
}

export const ScenarioLibraryModal: React.FC<ScenarioLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectScenario,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'nominal' | 'emergency' | 'environmental' | 'fleet'>('all');

  if (!isOpen) return null;

  const filteredScenarios = PRESET_SCENARIOS.filter(
    (s) => selectedCategory === 'all' || s.category === selectedCategory
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Autonomous Scenario Library (16 Operational Presets)"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
        {/* Category Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {[
            { id: 'all', label: 'All 16 Scenarios' },
            { id: 'nominal', label: 'Nominal Operations' },
            { id: 'emergency', label: 'Emergency & Fail-Safe' },
            { id: 'environmental', label: 'Weather & Wind' },
            { id: 'fleet', label: 'Multi-Drone Fleets' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold font-mono text-xs whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredScenarios.map((sc) => {
            const Icon = sc.icon;
            return (
              <div
                key={sc.id}
                className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 hover:border-cyan-500/50 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${sc.severity === 'Critical' ? 'bg-rose-500/20 text-rose-500' : sc.severity === 'Warning' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                        {sc.badge}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{sc.durationSec}s Sim</span>
                  </div>

                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{sc.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">{sc.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">{sc.recommendedDrone}</span>
                  <button
                    onClick={() => {
                      onSelectScenario(sc);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" /> Launch Scenario
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-mono text-slate-400">16 Deterministic Simulation Presets Loaded</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold"
          >
            Close Library
          </button>
        </div>
      </div>
    </Modal>
  );
};
