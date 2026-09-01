import React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, id, className = "", ...props }, ref) => {
    const checkboxId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <label htmlFor={checkboxId} className={`inline-flex items-start gap-3 cursor-pointer select-none ${className}`}>
        <div className="relative flex items-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className="peer sr-only"
            {...props}
          />
          <div className="w-4 h-4 rounded border border-slate-700 bg-slate-900 peer-checked:bg-blue-600 peer-checked:border-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/40 transition-colors flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
            {description && <span className="text-xs text-slate-400 mt-0.5">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, id, className = "", ...props }, ref) => {
    const switchId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <label htmlFor={switchId} className={`inline-flex items-center justify-between gap-4 cursor-pointer select-none ${className}`}>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
            {description && <span className="text-xs text-slate-400 mt-0.5">{description}</span>}
          </div>
        )}
        <div className="relative inline-flex items-center">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            className="peer sr-only"
            {...props}
          />
          <div className="w-10 h-5 bg-slate-800 border border-slate-700 peer-checked:bg-blue-600 peer-checked:border-blue-500 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-blue-500/40 relative">
            <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 peer-checked:translate-x-5 transition-transform shadow-sm" />
          </div>
        </div>
      </label>
    );
  }
);

Switch.displayName = "Switch";
