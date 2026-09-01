import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "bordered" | "elevated" | "hud";
  hoverable?: boolean;
}

export function Card({
  children,
  variant = "default",
  hoverable = false,
  className = "",
  ...props
}: CardProps) {
  const variantStyles = {
    default: "bg-white/95 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-md shadow-slate-200/40 dark:shadow-none",
    glass: "bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 shadow-xl shadow-slate-200/50 dark:shadow-black/40",
    bordered: "bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100",
    elevated: "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-900 dark:text-slate-100 shadow-xl dark:shadow-2xl shadow-slate-200/60 dark:shadow-black/60",
    hud: "bg-slate-50/90 dark:bg-slate-950/90 border-cyan-500/40 dark:border-cyan-500/30 text-slate-900 dark:text-slate-100 shadow-lg shadow-cyan-900/10 dark:shadow-cyan-950/30 relative before:absolute before:top-0 before:left-0 before:w-2 before:h-2 before:border-t-2 before:border-l-2 before:border-cyan-600 dark:before:border-cyan-400 after:absolute after:bottom-0 after:right-0 after:w-2 after:h-2 after:border-b-2 after:border-r-2 after:border-cyan-600 dark:after:border-cyan-400"
  }[variant];

  const hoverStyles = hoverable
    ? "transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-600 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
    : "";

  return (
    <div
      className={`rounded-xl border ${variantStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassPanel({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-750/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-black/50 text-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pb-3 flex flex-col gap-1 border-b border-slate-200/70 dark:border-slate-800/60 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center justify-between gap-2 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-slate-600 dark:text-slate-400 font-normal ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 px-5 pt-3 border-t border-slate-200/70 dark:border-slate-800/60 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 ${className}`} {...props}>
      {children}
    </div>
  );
}
