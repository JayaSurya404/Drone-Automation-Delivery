import React from "react";

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "neutral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  pulse = false,
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-800 text-slate-300 border-slate-700/80",
    primary: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    neutral: "bg-slate-800/80 text-slate-400 border-slate-700/60"
  }[variant];

  const dotColor = {
    default: "bg-slate-400",
    primary: "bg-blue-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-red-400",
    info: "bg-cyan-400",
    purple: "bg-purple-400",
    neutral: "bg-slate-500"
  }[variant];

  const sizeStyles = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1 font-semibold uppercase tracking-wider",
    md: "text-xs px-2.5 py-1 gap-1.5 font-medium tracking-wide"
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm backdrop-blur-sm transition-all ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}
