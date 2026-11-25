import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
            case 'error': return <XCircle className="h-5 w-5 text-rose-400 shrink-0" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />;
            default: return <Info className="h-5 w-5 text-cyan-400 shrink-0" />;
          }
        };

        const getBorder = () => {
          switch (toast.type) {
            case 'success': return 'border-emerald-500/40 bg-slate-900/95';
            case 'error': return 'border-rose-500/40 bg-slate-900/95';
            case 'warning': return 'border-amber-500/40 bg-slate-900/95';
            default: return 'border-cyan-500/40 bg-slate-900/95';
          }
        };

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md text-slate-100 transition-all transform animate-slide-up ${getBorder()}`}
          >
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold leading-snug">{toast.title}</h4>
              {toast.message && <p className="text-[11px] text-slate-300 mt-0.5 leading-normal">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
