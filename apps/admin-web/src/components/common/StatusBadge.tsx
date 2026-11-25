import React from 'react';
import { DroneStatus, OrderStatus, MissionStatus } from '../../types/skynav';

interface StatusBadgeProps {
  status: DroneStatus | OrderStatus | MissionStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getColors = (st: string) => {
    const norm = st.toLowerCase().replace(/_/g, ' ');
    if (['available', 'delivered', 'operational', 'successful', 'active', 'approved', 'repaired', 'healthy'].includes(norm)) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 dot-emerald-400';
    }
    if (['in flight', 'in transit', 'assigned', 'drone assigned', 'pickup in progress', 'preparing', 'under maintenance', 'in progress'].includes(norm)) {
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 dot-cyan-400';
    }
    if (['warning', 'caution', 'degraded', 'pending', 'waiting', 'scheduled', 'overdue'].includes(norm)) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30 dot-amber-400';
    }
    if (['emergency', 'critical', 'failed', 'suspended', 'rejected', 'nofly', 'restricted'].includes(norm)) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30 dot-rose-400 animate-pulse';
    }
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30 dot-slate-400';
  };

  const colorStyle = getColors(status);
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3 py-1.5 text-sm font-semibold' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${padding} ${colorStyle}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
    </span>
  );
};
