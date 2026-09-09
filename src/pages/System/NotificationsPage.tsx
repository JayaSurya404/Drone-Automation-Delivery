import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { SystemNotification } from '../../types/skynav';
import { Bell, CheckCheck, AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState(mockStore.getNotifications());
  const [filterCat, setFilterCat] = useState<string>('all');

  useEffect(() => {
    return mockStore.subscribe(() => {
      setNotifications([...mockStore.getNotifications()]);
    });
  }, []);

  const filteredNotifs = notifications.filter((n) => {
    if (filterCat === 'all') return true;
    return n.category === filterCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bell className="h-5 w-5 text-cyan-400" /> System Notification Broadcast Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time critical telemetry alerts, hardware battery warnings, and order fulfillment events
          </p>
        </div>

        <button
          onClick={() => mockStore.markAllNotificationsRead()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          <CheckCheck className="h-4 w-4 text-cyan-400" /> Mark All Read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        {['all', 'critical', 'warning', 'info', 'success'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`rounded-xl px-3 py-1.5 font-semibold capitalize transition-all ${
              filterCat === cat
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredNotifs.map((n) => {
          const getIcon = () => {
            switch (n.category) {
              case 'critical': return <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0" />;
              case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />;
              case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
              default: return <Info className="h-5 w-5 text-cyan-400 shrink-0" />;
            }
          };

          return (
            <div
              key={n.id}
              onClick={() => mockStore.markNotificationRead(n.id)}
              className={`rounded-xl border p-4 backdrop-blur-md flex items-center justify-between cursor-pointer transition-all ${
                n.read
                  ? 'border-slate-800/80 bg-slate-950/40 opacity-70'
                  : 'border-slate-700 bg-slate-900 shadow-lg'
              }`}
            >
              <div className="flex items-center gap-3">
                {getIcon()}
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{n.title}</h4>
                  <p className="text-xs text-slate-300 mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">{n.timestamp}</span>
                </div>
              </div>

              {!n.read && <span className="h-2 w-2 rounded-full bg-cyan-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
