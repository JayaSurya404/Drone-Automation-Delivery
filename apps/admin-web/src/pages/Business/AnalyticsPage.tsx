import React, { useState } from 'react';
import { BarChart3, Calendar, TrendingUp, Zap, Clock, ShieldCheck } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('30 Days');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" /> Operational Analytics Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Deep insights into delivery SLAs, fleet utilization, flight hours, and revenue metrics
          </p>
        </div>

        {/* Date Range Selector (Section 30) */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
          {['Today', '7 Days', '30 Days', '90 Days', 'Custom'].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`rounded-lg px-3 py-1 font-semibold transition-all ${
                dateRange === r ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Visual Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delivery SLA Performance */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" /> Average Delivery Time SLA (Minutes)
            </h3>
            <span className="text-xs font-bold text-emerald-400">14.2 min Avg</span>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-4 px-2">
            {[18, 16, 15, 14, 13.8, 14.5, 14.2].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gradient-to-t from-cyan-600 to-blue-500 rounded-t-md" style={{ height: `${val * 8}px` }} />
                <span className="text-[10px] text-slate-400 font-mono">Day {idx + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Utilization Rate */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" /> Fleet Airspace Utilization Rate (%)
            </h3>
            <span className="text-xs font-bold text-cyan-400">78.4% Peak</span>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-4 px-2">
            {[62, 70, 75, 82, 88, 78, 81].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gradient-to-t from-emerald-600 to-cyan-500 rounded-t-md" style={{ height: `${val * 1.8}px` }} />
                <span className="text-[10px] text-slate-400 font-mono">Day {idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
