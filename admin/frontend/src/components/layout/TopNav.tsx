import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSystemHealth } from '../../context/SystemHealthContext';
import { useOperationsModals } from '../../context/OperationsModalContext';
import { mockStore } from '../../services/mockDataStore';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { AdminRole } from '../../types/skynav';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Laptop,
  LogOut,
  ChevronDown,
  Menu,
  Clock,
  Sparkles,
  Phone,
  ShieldCheck,
  User,
  Bot,
} from 'lucide-react';

interface TopNavProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ sidebarCollapsed, onToggleSidebar, onToggleMobileMenu }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, switchRole, getDefaultRouteForRole } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { overallStatus, openHealthDrawer } = useSystemHealth();
  const { openCommandPalette, openDigitalTwin, openSimulation } = useOperationsModals();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPageTitle = () => {
    const p = location.pathname.substring(1);
    if (!p || p === 'dashboard') return 'Operations Command Center';
    return p.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const notifications = mockStore.getNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const ROLES_LIST: { role: AdminRole; label: string }[] = [
    { role: 'super_admin', label: 'Super Admin' },
    { role: 'ops_admin', label: 'Operations Admin' },
    { role: 'fleet_manager', label: 'Fleet Manager' },
    { role: 'dispatch_manager', label: 'Dispatch Manager' },
    { role: 'support_admin', label: 'Support Admin' },
    { role: 'analytics_admin', label: 'Analytics Admin' },
  ];

  // Format time components cleanly
  const timeFormatted = currentTime.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-all duration-300 flex items-center left-0 ${
        sidebarCollapsed ? 'md:left-20' : 'md:left-64'
      }`}
    >
      <div className="w-full flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
        {/* =========================================
            LEFT SECTION: Mobile Toggle & Breadcrumb
           ========================================= */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button
            onClick={onToggleMobileMenu || onToggleSidebar}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Toggle Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 max-w-[130px] sm:max-w-[200px] lg:max-w-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
              <span className="shrink-0">SKYNAV</span>
              <span>/</span>
              <span className="text-cyan-600 dark:text-cyan-400 truncate">{getPageTitle()}</span>
            </div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
              {getPageTitle()}
            </h2>
          </div>
        </div>

        {/* =========================================
            CENTER SECTION: Command Search Input
           ========================================= */}
        <div className="flex-1 max-w-sm lg:max-w-md mx-1 sm:mx-2 hidden md:flex items-center gap-2 min-w-0">
          <div
            onClick={openCommandPalette}
            className="relative w-full cursor-pointer group flex-1"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-hover:text-cyan-500 transition-colors" />
            <div className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 pl-8 pr-12 text-xs text-slate-400 flex items-center justify-between shadow-inner hover:border-cyan-500/50 transition-all">
              <span className="truncate">Search commands (Ctrl+K)...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT SECTION: Dedicated Independent Controls
           ========================================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Simulation Center Direct Hero Button */}
          <button
            onClick={() => navigate('/simulation')}
            className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-bold text-xs hover:bg-cyan-500/25 transition-all shadow-xs shrink-0 whitespace-nowrap"
            title="Launch 3D Autonomous Story Simulation Center"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse shrink-0" />
            <span className="hidden sm:inline">3D Sim Center</span>
            <span className="sm:hidden">3D Sim</span>
          </button>

          {/* Quick Digital Twin Pill (Visible on Large Desktop) */}
          <button
            onClick={() => openDigitalTwin('D-024')}
            className="hidden 2xl:flex items-center gap-1.5 h-9 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 font-bold text-xs hover:bg-cyan-500/20 transition-all shadow-xs shrink-0 whitespace-nowrap"
            title="Open Drone Digital Twin Diagnostics"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span>Digital Twin</span>
          </button>

          {/* Dedicated Live Clock Container */}
          <div className="hidden md:flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shrink-0 whitespace-nowrap shadow-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="font-mono font-bold text-xs tracking-wider tabular-nums text-slate-900 dark:text-slate-100">
              {timeFormatted}
            </span>
            <span className="px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-mono font-black text-[9px] uppercase tracking-wider">
              IST
            </span>
          </div>

          {/* Airspace System Status Pill */}
          <button
            onClick={openHealthDrawer}
            className={`hidden xl:flex items-center gap-2 h-9 px-3 rounded-full border text-xs font-bold transition-all shrink-0 whitespace-nowrap shadow-xs ${
              overallStatus === 'OPERATIONAL'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse hover:bg-rose-500/20'
            }`}
            title="Click to view detailed system health diagnostics"
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                overallStatus === 'OPERATIONAL' ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
              }`}
            />
            <span className="tracking-wider uppercase font-mono text-[10px]">
              AIRSPACE {overallStatus}
            </span>
          </button>

          {/* 3-Way Theme Switcher (Light / System / Dark) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shadow-xs"
              title={`Theme: ${theme} (Active: ${resolvedTheme})`}
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="h-4 w-4 text-cyan-400 shrink-0" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 shrink-0" />
              )}
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-36 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-1.5 z-50 space-y-1 text-xs font-semibold">
                <button
                  onClick={() => {
                    setTheme('light');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors ${
                    theme === 'light'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5 text-amber-500" /> ☀ Light
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors ${
                    theme === 'system'
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Laptop className="h-3.5 w-3.5 text-cyan-500" /> ◐ System
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors ${
                    theme === 'dark'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-cyan-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5 text-cyan-400" /> ☾ Dark
                </button>
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="h-9 w-9 flex items-center justify-center relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shrink-0 shadow-xs"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-md shadow-rose-500/50 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dynamic Authenticated User Profile Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="h-9 px-2 sm:px-2.5 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shadow-xs whitespace-nowrap"
            >
              <Avatar name={user?.name || 'Admin'} src={user?.avatar} size="xs" status="online" />
              <div className="text-left hidden md:block max-w-[100px] lg:max-w-[130px] truncate">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                  {user?.name || 'Administrator'}
                </p>
                <p className="text-[9px] text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wider truncate">
                  {(user?.role || 'super_admin').replace(/_/g, ' ')}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50 space-y-1">
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 text-xs flex items-center gap-3">
                  <Avatar name={user?.name} src={user?.avatar} size="md" />
                  <div className="truncate">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">{user?.email}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[9px] font-bold uppercase">
                      {(user?.role || 'super_admin').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Account Details Modal Trigger */}
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsAccountModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl p-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <User className="h-4 w-4 text-cyan-500" /> My Profile & Security
                </button>

                {/* Role Switcher Menu for Jury / Demo */}
                <div className="p-2 border-t border-b border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Switch Active Role
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {ROLES_LIST.map((r) => (
                      <button
                        key={r.role}
                        onClick={() => {
                          switchRole(r.role);
                          setIsProfileOpen(false);
                          const target = getDefaultRouteForRole(r.role);
                          navigate(target);
                        }}
                        className={`text-[10px] p-1.5 rounded-lg text-left font-bold capitalize transition-colors truncate ${
                          user?.role === r.role
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 rounded-xl p-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign Out Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account & Profile Modal */}
      {isAccountModalOpen && user && (
        <Modal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          title="Administrator Profile & Security Credentials"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <Avatar name={user.name} src={user.avatar} size="lg" />
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100">{user.name}</h4>
                <p className="text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold uppercase text-[10px]">
                    {user.role.replace(/_/g, ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    ● Active Session
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-cyan-500" /> Phone:
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {user.phone || '+91 98401 22910'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-500" /> Last Login:
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{user.lastLogin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Auth Level:
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">256-Bit TLS Verified</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold"
              >
                Close Profile
              </button>
            </div>
          </div>
        </Modal>
      )}
    </header>
  );
};
