import React from "react";
import { AlertTriangleIcon, CheckCircleIcon, ShieldIcon, CloseIcon } from "../icons/index.js";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({
  variant = "info",
  title,
  children,
  onClose,
  className = ""
}: AlertProps) {
  const styles = {
    info: {
      container: "bg-blue-950/40 border-blue-500/30 text-blue-200",
      icon: <ShieldIcon className="text-blue-400 shrink-0 mt-0.5" size={18} />
    },
    success: {
      container: "bg-emerald-950/40 border-emerald-500/30 text-emerald-200",
      icon: <CheckCircleIcon className="text-emerald-400 shrink-0 mt-0.5" size={18} />
    },
    warning: {
      container: "bg-amber-950/40 border-amber-500/30 text-amber-200",
      icon: <AlertTriangleIcon className="text-amber-400 shrink-0 mt-0.5" size={18} />
    },
    error: {
      container: "bg-red-950/40 border-red-500/30 text-red-200",
      icon: <AlertTriangleIcon className="text-red-400 shrink-0 mt-0.5" size={18} />
    }
  }[variant];

  return (
    <div
      role="alert"
      className={`p-4 rounded-xl border flex items-start gap-3 backdrop-blur-md text-xs shadow-lg ${styles.container} ${className}`}
    >
      {styles.icon}
      <div className="flex-1 flex flex-col gap-0.5">
        {title && <span className="font-semibold text-sm text-slate-100">{title}</span>}
        <div className="text-slate-300 leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          aria-label="Dismiss alert"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}
