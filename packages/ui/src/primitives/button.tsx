import React from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "outline" | "glass";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "px-2.5 py-1 text-xs rounded-md gap-1.5",
      md: "px-4 py-2 text-sm rounded-lg gap-2",
      lg: "px-6 py-2.5 text-base rounded-xl gap-2.5"
    }[size];

    const variantClasses = {
      primary:
        "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm shadow-blue-500/20 border border-blue-400/30",
      secondary:
        "bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 border border-slate-700/60 shadow-sm",
      destructive:
        "bg-red-600/90 hover:bg-red-600 active:bg-red-700 text-white shadow-sm shadow-red-500/20 border border-red-500/30",
      ghost:
        "bg-transparent hover:bg-slate-800/60 active:bg-slate-800 text-slate-300 hover:text-slate-100",
      outline:
        "bg-transparent hover:bg-slate-800/40 text-slate-200 border border-slate-700 hover:border-slate-600",
      glass:
        "bg-slate-900/60 hover:bg-slate-800/80 text-cyan-300 border border-cyan-500/30 shadow-sm backdrop-blur-md hover:border-cyan-400/50"
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
