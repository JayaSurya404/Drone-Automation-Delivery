import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { mockStore } from '../../services/mockDataStore';
import {
  Search,
  LayoutDashboard,
  Radio,
  ShoppingBag,
  Send,
  Package,
  Route as RouteIcon,
  Bot,
  BatteryCharging,
  Wrench,
  Users,
  Store,
  ShieldAlert,
  AlertOctagon,
  CreditCard,
  BarChart3,
  FileSpreadsheet,
  Bell,
  HelpCircle,
  History,
  UserCheck,
  Settings,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Command,
  ArrowRight,
  Zap,
  Activity,
  Download,
  PlaneTakeoff,
  X,
} from 'lucide-react';
import { AdminRole } from '../../types/skynav';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDigitalTwin?: (droneId?: string) => void;
  onOpenSimulation?: (scenarioId?: string) => void;
  onOpenMissionReplay?: (missionId?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenDigitalTwin,
  onOpenSimulation,
  onOpenMissionReplay,
}) => {
  const navigate = useNavigate();
  const { user, switchRole, getDefaultRouteForRole } = useAuth();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Keyboard listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate indexed items for quick action
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();

    const baseActions: {
      category: string;
      id: string;
      title: string;
      subtitle: string;
      icon: any;
      action: () => void;
    }[] = [
      // Navigation
      { category: 'Navigation', id: 'nav-dash', title: 'Command Center Dashboard', subtitle: 'Global airspace telemetry overview', icon: LayoutDashboard, action: () => navigate('/dashboard') },
      { category: 'Navigation', id: 'nav-ops', title: 'Live Drone Operations Map', subtitle: 'Satellite & hybrid airspace view', icon: Radio, action: () => navigate('/operations') },
      { category: 'Navigation', id: 'nav-fleet', title: 'Drone Fleet Directory', subtitle: '40 autonomous delivery drones', icon: Bot, action: () => navigate('/fleet') },
      { category: 'Navigation', id: 'nav-orders', title: 'Orders & Dispatches', subtitle: 'Real-time customer dispatches', icon: ShoppingBag, action: () => navigate('/orders') },
      { category: 'Navigation', id: 'nav-missions', title: 'Missions & Flight Corridors', subtitle: 'Flight plans & active corridors', icon: Send, action: () => navigate('/missions') },
      { category: 'Navigation', id: 'nav-geo', title: 'Geofencing & No-Fly Zones', subtitle: 'DGCA airspace restrictions', icon: ShieldAlert, action: () => navigate('/geofencing') },
      { category: 'Navigation', id: 'nav-emerg', title: 'Emergency Command Center', subtitle: 'Fail-safe RTH & incident control', icon: AlertOctagon, action: () => navigate('/emergency') },
      { category: 'Navigation', id: 'nav-battery', title: 'Battery Health Intelligence', subtitle: 'Pack telemetry, cycle degradation', icon: BatteryCharging, action: () => navigate('/battery-health') },
      { category: 'Navigation', id: 'nav-reports', title: 'Compliance & Export Reports', subtitle: 'Download audit spreadsheets & PDF', icon: FileSpreadsheet, action: () => navigate('/reports') },
      { category: 'Navigation', id: 'nav-cust', title: 'Customer Accounts Directory', subtitle: 'KYC verified dropoff coordinates', icon: Users, action: () => navigate('/customers') },
      { category: 'Navigation', id: 'nav-analytics', title: 'Business Analytics Center', subtitle: 'Revenue, utilization, fulfillment SLAs', icon: BarChart3, action: () => navigate('/analytics') },

      // Quick Operational Actions
      {
        category: 'Quick Operations',
        id: 'action-digital-twin',
        title: 'Launch Drone Digital Twin',
        subtitle: 'Engineering view of motors, ESC, battery cells & avionics',
        icon: Activity,
        action: () => {
          if (onOpenDigitalTwin) onOpenDigitalTwin('D-001');
          else navigate('/fleet');
        },
      },
      {
        category: 'Quick Operations',
        id: 'action-sim-route',
        title: 'Run Simulation: Off-Route Deviation (D-024)',
        subtitle: 'Simulate 320m drift with autopilot return',
        icon: Zap,
        action: () => {
          if (onOpenSimulation) onOpenSimulation('deviation');
          else navigate('/operations');
        },
      },
      {
        category: 'Quick Operations',
        id: 'action-sim-battery',
        title: 'Run Simulation: Low Battery Fail-Safe',
        subtitle: 'Trigger 18% low-battery warning and automated RTH',
        icon: Zap,
        action: () => {
          if (onOpenSimulation) onOpenSimulation('battery');
          else navigate('/emergency');
        },
      },
      {
        category: 'Quick Operations',
        id: 'action-replay-mission',
        title: 'Launch Mission Replay: MS-10284',
        subtitle: 'Play historical timeline playback from takeoff to drop',
        icon: PlaneTakeoff,
        action: () => {
          if (onOpenMissionReplay) onOpenMissionReplay('MS-10284');
          else navigate('/missions');
        },
      },

      // Demo Roles Switcher
      { category: 'Switch Demo Role', id: 'role-super', title: 'Switch Role: Super Admin', subtitle: 'Rajesh Sharma (Full Platform Access)', icon: UserCheck, action: () => { switchRole('super_admin'); navigate('/dashboard'); } },
      { category: 'Switch Demo Role', id: 'role-ops', title: 'Switch Role: Operations Admin', subtitle: 'Arjun Kumar (Dispatches & Corridors)', icon: UserCheck, action: () => { switchRole('ops_admin'); navigate('/dashboard'); } },
      { category: 'Switch Demo Role', id: 'role-fleet', title: 'Switch Role: Fleet Manager', subtitle: 'Ananya Menon (Hardware & Health)', icon: UserCheck, action: () => { switchRole('fleet_manager'); navigate('/fleet'); } },
      { category: 'Switch Demo Role', id: 'role-dispatch', title: 'Switch Role: Dispatch Manager', subtitle: 'Vikram Iyer (Smart Drone Assignments)', icon: UserCheck, action: () => { switchRole('dispatch_manager'); navigate('/orders'); } },
      { category: 'Switch Demo Role', id: 'role-support', title: 'Switch Role: Support Admin', subtitle: 'Deepa Krishnan (Customer Registry)', icon: UserCheck, action: () => { switchRole('support_admin'); navigate('/customers'); } },
      { category: 'Switch Demo Role', id: 'role-analytics', title: 'Switch Role: Analytics Admin', subtitle: 'Meera Patel (Financial Metrics & SLAs)', icon: UserCheck, action: () => { switchRole('analytics_admin'); navigate('/analytics'); } },

      // Theme Control
      { category: 'Theme Control', id: 'theme-dark', title: 'Set Theme: Aviation Dark Mode', subtitle: 'High contrast tactical dark interface', icon: Moon, action: () => setTheme('dark') },
      { category: 'Theme Control', id: 'theme-light', title: 'Set Theme: Daylight Light Mode', subtitle: 'Clean slate & white daylight interface', icon: Sun, action: () => setTheme('light') },
      { category: 'Theme Control', id: 'theme-sys', title: 'Set Theme: System Preference', subtitle: 'Follow operating system color mode', icon: Laptop, action: () => setTheme('system') },
    ];

    // Search live entities from mock store
    mockStore.getDrones().slice(0, 10).forEach((d) => {
      baseActions.push({
        category: 'Drones',
        id: `drone-${d.id}`,
        title: `${d.id} • ${d.name} (${d.model})`,
        subtitle: `Battery: ${d.battery}% | Status: ${d.status} | Location: ${d.location.lat.toFixed(4)}, ${d.location.lng.toFixed(4)}`,
        icon: Bot,
        action: () => {
          navigate('/fleet');
        },
      });
    });

    mockStore.getOrders().slice(0, 10).forEach((o) => {
      baseActions.push({
        category: 'Orders',
        id: `order-${o.id}`,
        title: `${o.id} — ${o.packageName}`,
        subtitle: `Customer: ${o.customerName} | Status: ${o.status} | Amount: ₹${o.paymentAmount}`,
        icon: ShoppingBag,
        action: () => navigate('/orders'),
      });
    });

    mockStore.getMissions().slice(0, 8).forEach((m) => {
      baseActions.push({
        category: 'Missions',
        id: `mission-${m.id}`,
        title: `${m.id} • Drone ${m.droneId}`,
        subtitle: `Route: ${m.pickupAddress} → ${m.destinationAddress} (${m.currentStatus})`,
        icon: Send,
        action: () => navigate('/missions'),
      });
    });

    if (!q) return baseActions;

    return baseActions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query, navigate, switchRole, setTheme, onOpenDigitalTwin, onOpenSimulation, onOpenMissionReplay]);

  if (!isOpen) return null;

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Command Search Input */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Command className="w-5 h-5" />
          </div>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search drones, missions, orders, actions, simulation..."
            className="flex-1 bg-transparent border-0 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0"
          />
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
              ESC to close
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {items.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 animate-pulse" />
              <p className="font-bold">No commands or records found matching "{query}"</p>
              <p className="text-[11px] text-slate-500">Try searching for Drone ID (e.g. D-001), Mission (MS-10284), or Simulation.</p>
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.action)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">{item.title}</span>
                        <span className="px-2 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-[9px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? 'translate-x-1 text-cyan-600 dark:text-cyan-400' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer Quick Hints */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-cyan-600 dark:text-cyan-400 font-bold">SKYNAV Command Palette 2.0</span>
        </div>
      </div>
    </div>
  );
};
