import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
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
  ChevronLeft,
  ChevronRight,
  PlaneTakeoff,
  Shield,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: any;
  isEmergency?: boolean;
  isSim?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user, hasPermission } = useAuth();

  const sections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Simulation Center', path: '/simulation', icon: Sparkles, isSim: true },
        { label: 'Live Operations', path: '/operations', icon: Radio },
      ],
    },
    {
      title: 'DELIVERY',
      items: [
        { label: 'Orders', path: '/orders', icon: ShoppingBag },
        { label: 'Missions', path: '/missions', icon: Send },
        { label: 'Packages', path: '/packages', icon: Package },
        { label: 'Routes', path: '/routes', icon: RouteIcon },
      ],
    },
    {
      title: 'FLEET',
      items: [
        { label: 'Drone Fleet', path: '/fleet', icon: Bot },
        { label: 'Battery & Health', path: '/battery-health', icon: BatteryCharging },
        { label: 'Maintenance', path: '/maintenance', icon: Wrench },
      ],
    },
    {
      title: 'PEOPLE',
      items: [
        { label: 'Customers', path: '/customers', icon: Users },
        { label: 'Merchants', path: '/merchants', icon: Store },
      ],
    },
    {
      title: 'SAFETY',
      items: [
        { label: 'Geofencing', path: '/geofencing', icon: ShieldAlert },
        { label: 'Emergency Center', path: '/emergency', icon: AlertOctagon, isEmergency: true },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { label: 'Payments', path: '/payments', icon: CreditCard },
        { label: 'Analytics', path: '/analytics', icon: BarChart3 },
        { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'Notifications', path: '/notifications', icon: Bell },
        { label: 'Support', path: '/support', icon: HelpCircle },
        { label: 'Audit Logs', path: '/audit-logs', icon: History },
        { label: 'Admin Management', path: '/admins', icon: UserCheck },
        { label: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  // Filter sections by role-based access control
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(item.path)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 shadow-xl backdrop-blur-xl transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <PlaneTakeoff className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <h1 className="text-base font-black tracking-widest text-slate-900 dark:text-slate-100 uppercase">
                SKY<span className="text-cyan-600 dark:text-cyan-400">NAV</span>
              </h1>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-tight truncate">
                Autonomous Delivery Control
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Role Indicator Banner */}
      {!collapsed && user && (
        <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-mono text-[10px] uppercase">Active Role:</span>
          <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider text-[10px]">
            {user.role.replace(/_/g, ' ')}
          </span>
        </div>
      )}

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {filteredSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                {section.title}
              </h3>
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? item.isEmergency
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-md shadow-rose-500/10'
                          : 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 shadow-md shadow-cyan-500/10'
                        : item.isEmergency
                        ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                      item.isEmergency ? 'text-rose-400 animate-pulse' : (item as any).isSim ? 'text-cyan-400 animate-pulse' : ''
                    }`}
                  />
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="truncate">{item.label}</span>
                      {(item as any).isSim && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-[9px] uppercase tracking-wider border border-cyan-500/30 shrink-0">
                          3D SIM
                        </span>
                      )}
                    </div>
                  )}

                  {collapsed && (
                    <div className="absolute left-full ml-2 hidden rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 shadow-xl border border-slate-800 group-hover:block z-50 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 text-[10px] text-slate-400 flex items-center justify-between">
          <span>SkyNav Admin v3.4.0</span>
          <span className="flex items-center gap-1 text-emerald-500 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" /> Live IST
          </span>
        </div>
      )}
    </aside>
  );
};
