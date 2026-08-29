import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-800/70 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

export function Spinner({
  size = 24,
  className = ""
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`inline-block border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = ""
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 ${className}`}>
      {icon && <div className="p-4 rounded-2xl bg-slate-800/50 text-slate-400 mb-4">{icon}</div>}
      <h4 className="text-base font-semibold text-slate-200 mb-1">{title}</h4>
      {description && <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Failed to load data",
  description = "An unexpected error occurred while communicating with the flight telemetry service.",
  onRetry,
  className = ""
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-red-900/30 bg-red-950/20 text-slate-200 ${className}`}>
      <div className="p-4 rounded-2xl bg-red-900/40 text-red-400 mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <h4 className="text-base font-semibold text-red-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className = "" }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 text-xs text-slate-400 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span className="text-slate-600">/</span>}
            {isLast || !item.href ? (
              <span className="font-medium text-slate-200">{item.label}</span>
            ) : (
              <a href={item.href} className="hover:text-slate-200 transition-colors">
                {item.label}
              </a>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function Avatar({
  name,
  src,
  status,
  size = "md",
  className = ""
}: {
  name: string;
  src?: string;
  status?: "online" | "offline" | "busy";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm"
  }[size];

  const statusColor = {
    online: "bg-emerald-400",
    busy: "bg-amber-400",
    offline: "bg-slate-500"
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={name} className={`${sizeClasses} rounded-full object-cover border border-slate-700`} />
      ) : (
        <div className={`${sizeClasses} rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center`}>
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${statusColor[status]}`}
        />
      )}
    </div>
  );
}
