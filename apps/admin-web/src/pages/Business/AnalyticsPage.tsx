import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, Zap, TrendingUp, Sparkles, RefreshCw, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { adminApiClient } from '../../context/AuthContext';

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('30 Days');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const data = await adminApiClient.getAnalyticsDashboard({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        if (isMounted) setOverview(data);
      } catch (err) {
        console.warn('Analytics fetch notice:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchAnalytics();
    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-500" /> Operational Analytics Intelligence
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
              <Sparkles className="h-3 w-3" /> Simulation & Aggregated Data
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time delivery SLAs, fleet airspace utilization, corridor flight hours, and revenue metrics across SkyHub Kurumbapalayam.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 text-xs">
          {['Today', '7 Days', '30 Days', '90 Days'].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`rounded-lg px-3 py-1 font-semibold transition-all ${
                dateRange === r
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Total Deliveries
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {overview?.totalDeliveries ?? 128}
          </p>
          <span className="text-[10px] text-emerald-500 font-medium">99.2% Successful Handover</span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cyan-500" /> Avg. SLA Time
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {overview?.averageDurationSeconds ? `${(overview.averageDurationSeconds / 60).toFixed(1)} min` : '14.2 min'}
          </p>
          <span className="text-[10px] text-cyan-500 font-medium">50 km/h Cruise Velocity</span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> Active Drones
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            40 Units
          </p>
          <span className="text-[10px] text-slate-400">SkyHub Kurumbapalayam Fleet</span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" /> Revenue (INR)
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {overview?.totalRevenue ? `₹${Number(overview.totalRevenue).toLocaleString('en-IN')}` : '₹3,48,250'}
          </p>
          <span className="text-[10px] text-indigo-400 font-medium">+18.4% vs last period</span>
        </div>
      </div>

      {/* Analytics Visual Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delivery SLA Performance */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-500" /> Average Delivery Time SLA (Minutes)
            </h3>
            <span className="text-xs font-bold text-emerald-500">14.2 min Avg</span>
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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-500" /> Fleet Airspace Utilization Rate (%)
            </h3>
            <span className="text-xs font-bold text-cyan-500">78.4% Peak</span>
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
