import Link from "next/link";
import {
  DroneIcon,
  PackageIcon,
  RadarIcon,
  RouteIcon,
  ShieldIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  productName
} from "@skynav/ui";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#070b14] relative overflow-hidden">
      {/* Background HUD Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-20 px-8 max-w-7xl w-full mx-auto flex items-center justify-between z-10 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <DroneIcon size={22} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-white">{productName}</span>
            <span className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase">Aviation Logistics</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/customer"
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
          >
            Customer Portal
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-colors flex items-center gap-2"
          >
            <span>Operations Center</span>
            <ChevronRightIcon size={14} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl w-full mx-auto px-8 py-16 flex-1 flex flex-col justify-center gap-12 z-10">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>SkyNav v2.0 Operational Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
            Deterministic Autonomous <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
              UAV Fleet Operations
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl">
            A software-first drone logistics platform featuring real-time corridor navigation, deterministic kinematic simulation, mission dispatch boards, and live telemetry tracking.
          </p>
        </div>

        {/* Experience Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Customer Portal Card */}
          <Link
            href="/customer"
            className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 group flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <PackageIcon size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                Customer Delivery Portal
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track active airborne deliveries, view live drone radar, verify delivery drop codes, and inspect past order manifests.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform gap-1">
              <span>Open Customer Experience</span>
              <ChevronRightIcon size={14} />
            </div>
          </Link>

          {/* Admin Operations Card */}
          <Link
            href="/admin"
            className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/50 hover:bg-slate-900/90 transition-all duration-200 group flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <RadarIcon size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                Flight Operations Center
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Command center for multi-drone fleet monitoring, corridor validation, tactical emergency aborts, and automated dispatch.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform gap-1">
              <span>Launch Operations Center</span>
              <ChevronRightIcon size={14} />
            </div>
          </Link>

          {/* Live Tracking & Telemetry Card */}
          <Link
            href="/admin/tracking"
            className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all duration-200 group flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <RouteIcon size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Live Tactical Radar & HUD
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time 2D radar overlay with great-circle waypoints, geofence restricted zones, battery gauges, and telemetry streams.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform gap-1">
              <span>View Tactical Radar</span>
              <ChevronRightIcon size={14} />
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 px-8 max-w-7xl w-full mx-auto border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-mono z-10">
        <div>SkyNav UAV Delivery Architecture — Milestone 2A UI Shell</div>
        <div className="flex items-center gap-2 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SIMULATOR STATUS: OPTIMAL</span>
        </div>
      </footer>
    </div>
  );
}
