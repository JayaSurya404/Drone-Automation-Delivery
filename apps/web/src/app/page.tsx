"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  DroneIcon,
  PackageIcon,
  RadarIcon,
  RouteIcon,
  ShieldIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  BatteryIcon,
  SignalIcon,
  CloseIcon,
  MapPinIcon
} from "@skynav/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-x-hidden">
      {/* Background Ambience / Subtle Radial Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 dark:from-blue-600/15 via-cyan-500/5 dark:via-cyan-500/5 to-transparent pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-20 px-6 sm:px-8 max-w-7xl w-full mx-auto flex items-center justify-between z-30 sticky top-0 bg-slate-50/80 dark:bg-[#070b14]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <DroneIcon size={22} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">SkyNav</span>
            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono tracking-wider uppercase">Aviation Logistics</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-600 dark:text-slate-300">
          <a href="#platform" className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors">Platform</a>
          <a href="#capabilities" className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors">Capabilities</a>
          <a href="#delivery-flow" className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors">Delivery Flow</a>
          <a href="#technology" className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors">Technology</a>
        </nav>

        {/* Desktop CTA & Theme Switcher */}
        <div className="hidden sm:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-white rounded-xl transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <span>Create Account</span>
            <ChevronRightIcon size={14} />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <CloseIcon size={20} /> : <div className="space-y-1 w-5"><div className="h-0.5 w-5 bg-current" /><div className="h-0.5 w-5 bg-current" /><div className="h-0.5 w-5 bg-current" /></div>}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-20 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 sm:hidden animate-fadeIn shadow-2xl">
          <a
            href="#platform"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-slate-800 dark:text-slate-200 py-1"
          >
            Platform
          </a>
          <a
            href="#capabilities"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-slate-800 dark:text-slate-200 py-1"
          >
            Capabilities
          </a>
          <a
            href="#delivery-flow"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-slate-800 dark:text-slate-200 py-1"
          >
            Delivery Flow
          </a>
          <a
            href="#technology"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-slate-800 dark:text-slate-200 py-1"
          >
            Technology
          </a>
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-semibold rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20"
            >
              Create Customer Account
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="platform" className="max-w-7xl w-full mx-auto px-6 sm:px-8 pt-16 pb-20 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left Hero Copy */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span>SkyNav Next-Gen Digital Twin Architecture</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Autonomous Delivery. <br />
              <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-300 dark:to-teal-200 bg-clip-text text-transparent">
                Engineered for the Sky.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Unified autonomous UAV logistics, deterministic digital-twin simulation, real-time fleet orchestration, advisory AI routing, and precision computer-vision landing intelligence.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <Link
                href="/signup"
                className="px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-center"
              >
                <span>Launch Customer Portal</span>
                <ChevronRightIcon size={16} />
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-all flex items-center justify-center gap-2 text-center shadow-sm"
              >
                <span>Explore Operations</span>
              </Link>
            </div>

            {/* Safety & Compliance Badge */}
            <div className="flex items-center gap-6 pt-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon size={16} className="text-emerald-500" />
                <span>Deterministic Geofencing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon size={16} className="text-emerald-500" />
                <span>10 Hz Real-Time Radar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon size={16} className="text-emerald-500" />
                <span>Airspace AI Advisory</span>
              </div>
            </div>
          </div>

          {/* Right Operational Preview HUD Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-750 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl p-6 space-y-5 transition-all relative">

              {/* Card Header with Live Status */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-cyan-400 flex items-center justify-center font-mono text-xs font-bold">
                    UAV
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">DRONE-AERO-01</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Falcon X-4 Cargo Variant</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AIRBORNE</span>
                </div>
              </div>

              {/* Dynamic Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <span className="block text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Altitude</span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">82.4 m</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <span className="block text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Airspeed</span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">14.2 m/s</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <span className="block text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Battery</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">88.5%</span>
                </div>
              </div>

              {/* Mission Progress Stepper Preview */}
              <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Mission MS-4091: Downtown Corridor</span>
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">ETA 4 min</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full w-3/4 rounded-full" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Hub North</span>
                  <span className="text-blue-600 dark:text-cyan-400 font-semibold">Waypoint 3/4</span>
                  <span>Drop Zone B</span>
                </div>
              </div>

              {/* Perception / Computer Vision Preview */}
              <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RadarIcon size={16} className="text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">YOLO Pad Detection</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">PAD VERIFIED (0.97)</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* System Stats Bar */}
      <section className="border-y border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">100%</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deterministic Safety Compliance</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-600 dark:text-cyan-400">10 Hz</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Streaming Telemetry Frequency</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">Zero</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Physical UAV Hardware Risk</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">Sub-ms</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Digital Twin Sync Latency</p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-20 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-xs font-mono font-bold tracking-widest text-blue-600 dark:text-cyan-400 uppercase">
            Core Architecture
          </h2>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Built for Autonomous Flight Operations
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Engineered modularly with strict separation between simulation physics, advisory intelligence, and human command gates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/40 transition-all duration-200 space-y-3 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
              <PackageIcon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Autonomous Last-Mile Delivery</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Complete vertical slice from customer order placement to payload latching, aerial dispatch, and secure drop-zone package release.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/40 transition-all duration-200 space-y-3 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <DroneIcon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Fleet Intelligence & Command</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Comprehensive drone registry tracking battery state-of-charge, operational readiness, maintenance cycles, and dynamic assignment.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/40 transition-all duration-200 space-y-3 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <RouteIcon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Geospatial Routing & Geofences</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Strict spatial safety boundary enforcement preventing unauthorized flight through no-fly zones, buildings, and restricted corridors.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/40 transition-all duration-200 space-y-3 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <RadarIcon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Advisory AI & Weather Scoring</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Machine learning microservice evaluates weather conditions, wind vectors, and route safety scores. AI is advisory; safety gates are authoritative.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/40 transition-all duration-200 space-y-3 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldIcon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Computer Vision Verification</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              YOLO vision inference inspects delivery drop pads, detecting fiducial markers, human obstacles, and landing zone clearance before descent.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/40 transition-all duration-200 space-y-3 shadow-sm hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <SignalIcon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Digital Twin Telemetry</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Synchronized software representation tracks position, velocity vectors, battery depletion curves, and mission status across all clients.
            </p>
          </div>
        </div>
      </section>

      {/* Delivery Flow Timeline Stepper */}
      <section id="delivery-flow" className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 py-20 transition-colors">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-mono font-bold tracking-widest text-blue-600 dark:text-cyan-400 uppercase">
              Mission Lifecycle
            </h2>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              End-to-End Delivery Pipeline
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Every package lifecycle executes through a deterministic six-stage safety corridor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Step 1 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">1</span>
                <span className="text-[10px] font-mono text-slate-400">STAGE 01</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Order Placed</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Recipient submits coordinates & delivery window.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">2</span>
                <span className="text-[10px] font-mono text-slate-400">STAGE 02</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Safety Check</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Geofence validation, battery reserve & AI score.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">3</span>
                <span className="text-[10px] font-mono text-slate-400">STAGE 03</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Dispatch & Launch</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Operator authorizes takeoff into flight corridor.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">4</span>
                <span className="text-[10px] font-mono text-slate-400">STAGE 04</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Live Telemetry</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">10 Hz kinematic position updates via WebSocket.</p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">5</span>
                <span className="text-[10px] font-mono text-slate-400">STAGE 05</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">CV Landing & Drop</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Optical pad alignment & winch package release.</p>
              </div>
            </div>

            {/* Step 6 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-mono text-xs flex items-center justify-center font-bold">6</span>
                <span className="text-[10px] font-mono text-slate-400">STAGE 06</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Return to Base</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Autonomous RTB trajectory and pod recharge.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology / Architecture Section */}
      <section id="technology" className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-20 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-xs font-mono font-bold tracking-widest text-blue-600 dark:text-cyan-400 uppercase">
            Engineering Rigor
          </h2>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Technology Foundation
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A hardened microservice monorepo built on enterprise standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Fastify & TypeScript Monorepo</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              High-throughput asynchronous event architecture with strictly typed Zod shared contracts, avoiding duplicate domain types across services.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">PostgreSQL + Redis Transport</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Transactional outbox pattern guarantees reliable notification delivery, paired with Redis pub/sub for real-time telemetry fanout.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Python FastAI & PyTorch CV</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Isolated AI services compute corridor route advisory scoring and computer-vision landing zone obstacle segmentation.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="max-w-7xl w-full mx-auto px-6 sm:px-8 pb-20">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-600/10 via-cyan-500/10 to-transparent p-8 sm:p-12 text-center space-y-6 relative overflow-hidden shadow-xl">
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Ready to experience autonomous aerial logistics?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Sign up as a customer to track deliveries or log into flight operations with your administrator credentials.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-7 py-3 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all text-center"
            >
              Sign Up as Customer
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-all text-center shadow-sm"
            >
              Sign In to Operations
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 py-10 transition-colors">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <DroneIcon size={18} />
            </div>
            <div className="text-left">
              <span className="font-bold text-sm text-slate-900 dark:text-white">SkyNav Aviation Logistics</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Autonomous UAV Last-Mile Delivery Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600 dark:text-slate-400">
            <Link href="/login" className="hover:text-blue-600 dark:hover:text-cyan-400">Operations</Link>
            <Link href="/customer" className="hover:text-blue-600 dark:hover:text-cyan-400">Customer</Link>
            <Link href="/signup" className="hover:text-blue-600 dark:hover:text-cyan-400">Register</Link>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle showLabel />
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Simulation Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
