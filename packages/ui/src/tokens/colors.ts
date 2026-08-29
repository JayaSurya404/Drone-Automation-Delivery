/**
 * Design tokens for the SkyNav Aviation & Logistics interface.
 * Implements a high-density, dark operational theme with support for light mode.
 */

export const colors = {
  // Brand / Aviation Identity
  brand: {
    50: "#f0f7ff",
    100: "#e0effe",
    200: "#bae0fd",
    300: "#7cc7fb",
    400: "#38a8f8",
    500: "#0e8ce9",
    600: "#026fc7",
    700: "#0358a1",
    800: "#074b83",
    900: "#0c3f6d",
    950: "#082847"
  },
  // Operational Surface Neutrals (Dark Slate / Deep Navy)
  slate: {
    950: "#090d16", // Deepest background
    900: "#0f172a", // Panel background
    850: "#131e36", // Card background
    800: "#1e293b", // Elevated surface
    750: "#27354d", // Border subtle
    700: "#334155", // Border prominent
    600: "#475569", // Text muted
    500: "#64748b", // Text secondary
    400: "#94a3b8", // Text standard
    300: "#cbd5e1", // Text bright
    200: "#e2e8f0", // Text white-soft
    100: "#f1f5f9",
    50: "#f8fafc"
  },
  // Radar / Cyan HUD Accents
  radar: {
    glow: "#00f0ff",
    beam: "rgba(0, 240, 255, 0.15)",
    grid: "rgba(0, 240, 255, 0.08)"
  },
  // Semantic Status Color Palettes
  status: {
    success: {
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.3)",
      text: "#10b981",
      glow: "#059669"
    },
    warning: {
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.3)",
      text: "#f59e0b",
      glow: "#d97706"
    },
    danger: {
      bg: "rgba(239, 68, 68, 0.12)",
      border: "rgba(239, 68, 68, 0.35)",
      text: "#ef4444",
      glow: "#dc2626"
    },
    info: {
      bg: "rgba(56, 168, 248, 0.12)",
      border: "rgba(56, 168, 248, 0.3)",
      text: "#38a8f8",
      glow: "#0284c7"
    },
    purple: {
      bg: "rgba(168, 85, 247, 0.12)",
      border: "rgba(168, 85, 247, 0.3)",
      text: "#a855f7",
      glow: "#9333ea"
    },
    neutral: {
      bg: "rgba(148, 163, 184, 0.12)",
      border: "rgba(148, 163, 184, 0.25)",
      text: "#94a3b8",
      glow: "#64748b"
    }
  }
} as const;

export const shadows = {
  glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
  glassSubtle: "0 4px 16px 0 rgba(0, 0, 0, 0.25)",
  glowBrand: "0 0 20px rgba(14, 140, 233, 0.25)",
  glowCyan: "0 0 20px rgba(0, 240, 255, 0.2)",
  glowDanger: "0 0 20px rgba(239, 68, 68, 0.25)"
} as const;
