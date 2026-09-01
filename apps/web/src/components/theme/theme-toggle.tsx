"use client";

import React from "react";
import { SunIcon, MoonIcon } from "@skynav/ui";
import { useTheme } from "./theme-provider";

export function ThemeToggle({
  className = "",
  showLabel = false
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <SunIcon size={18} className="text-amber-400" />
      ) : (
        <MoonIcon size={18} className="text-blue-600" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}
