"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DroneIcon, MapPinIcon, ZapIcon, CheckIcon, ArrowLeftIcon } from "@skynav/ui";

export default function CustomerTrackingPage() {
  const [etaMinutes, setEtaMinutes] = useState(12);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <Link
        href="/customer"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 transition"
      >
        <ArrowLeftIcon size={14} /> Back to Store
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Live AirDrop Delivery Radar
        </h1>
        <p className="text-xs text-slate-500">
          Real-time package radar & touchdown countdown
        </p>
      </div>

      {/* Radar Visual Card */}
      <div className="relative overflow-hidden bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center text-white shadow-2xl space-y-6">
        {/* Radar concentric rings */}
        <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-brand-500/20 animate-ping opacity-25" />
          <div className="absolute w-52 h-52 rounded-full border border-brand-500/30" />
          <div className="absolute w-36 h-36 rounded-full border border-brand-500/40" />
          <div className="absolute w-20 h-20 rounded-full border border-brand-500/60 bg-brand-500/10" />

          {/* Sweeping Radar Beam */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-brand-500/20 to-transparent animate-spin duration-3000 pointer-events-none" />

          {/* Drone Icon Indicator */}
          <div className="relative z-10 p-3 rounded-full bg-brand-600 text-white shadow-xl shadow-brand-500/50 animate-bounce">
            <DroneIcon size={32} />
          </div>
        </div>

        {/* ETA Display */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
            <ZapIcon size={14} className="text-amber-400" />
            <span>AUTONOMOUS FLIGHT CORRIDOR ACTIVE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Touchdown in ~{etaMinutes} Minutes
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your package is in autonomous transit at 45m cruise altitude. Touchdown tether will lower gently upon arrival.
          </p>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Air Speed</span>
            <span className="font-mono font-bold text-slate-200">52 km/h</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Distance</span>
            <span className="font-mono font-bold text-slate-200">2.4 km remaining</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Flight Status</span>
            <span className="font-bold text-emerald-400">Optimal & Safe</span>
          </div>
        </div>
      </div>

      {/* Delivery Safety Guide */}
      <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CheckIcon size={16} className="text-emerald-500" />
          <span>Delivery Safety Tips</span>
        </h3>
        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-5">
          <li>Keep children and pets clear of the designated rooftop or lawn landing zone during tether descent.</li>
          <li>Drone will hover at 3.5m and gently lower the package to the ground before releasing the safety tether.</li>
          <li>You will receive an instant push confirmation the second the package is released.</li>
        </ul>
      </div>
    </div>
  );
}
