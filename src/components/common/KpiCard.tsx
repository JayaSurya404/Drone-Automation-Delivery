import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  subtitle?: string;
  accentColor?: string;
  statusBadge?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  subtitle,
  accentColor = 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  statusBadge,
}) => {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-slate-900/80 p-4 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-cyan-500/40 hover:shadow-cyan-500/10 ${accentColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-100 tracking-tight">{value}</h3>
        </div>
        <div className="rounded-lg bg-slate-800/80 p-2.5 text-cyan-400 border border-slate-700/50">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
        {change && (
          <span className={`inline-flex items-center gap-1 font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {change}
          </span>
        )}

        {subtitle && <span className="text-slate-400">{subtitle}</span>}
        {statusBadge && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-slate-700">
            {statusBadge}
          </span>
        )}
      </div>
    </div>
  );
};
