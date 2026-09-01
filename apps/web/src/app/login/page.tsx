"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DroneIcon,
  ShieldIcon,
  RadarIcon,
  RouteIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from "@skynav/ui";
import { useAuth } from "@/features/auth/auth-context";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function LoginPage() {
  let router: any = { push: () => {}, replace: () => {} };
  let searchParams: any = { get: () => "" };
  try {
    router = useRouter();
  } catch {}
  try {
    searchParams = useSearchParams();
  } catch {}
  const redirectUrl = searchParams?.get ? (searchParams.get("redirect") || "") : "";

  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!identifier.trim()) {
      setErrorMessage("Please enter your email address or administrator username.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await login({ email: identifier.trim(), password });
      if (res.success) {
        // If there was a specific redirect intended (and not /login), use it if allowed
        if (redirectUrl && !redirectUrl.startsWith("/login")) {
          router.push(redirectUrl);
        } else {
          router.push(res.redirectTo);
        }
      } else {
        setErrorMessage(res.error || "Invalid email or password.");
      }
    } catch {
      setErrorMessage("Authentication gateway unavailable. Please verify connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setIdentifier("admin@skynav.test");
    setPassword("Password123!");
    setErrorMessage("");
  };

  const handleFillCustomer = () => {
    setIdentifier("customer@skynav.test");
    setPassword("Password123!");
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-hidden">
      {/* Background Ambience / Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-blue-500/10 dark:from-blue-900/25 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 blur-3xl pointer-events-none" />

      {/* Top Bar Navigation */}
      <header className="h-16 px-6 max-w-7xl w-full mx-auto flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <DroneIcon size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white leading-tight">SkyNav</span>
            <span className="text-[9px] text-cyan-600 dark:text-cyan-400 font-mono uppercase tracking-wider">Aviation Logistics</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/signup"
            className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline px-3 py-1.5"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Split Authentication Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex items-center justify-center z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left / Hero Branding Area */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span>SkyNav Flight Operations & Customer Access</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Autonomous aerial delivery,{" "}
              <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-300 dark:to-teal-200 bg-clip-text text-transparent">
                intelligently orchestrated.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
              Unified portal for flight operations management and recipient package delivery radar. Connects verified enterprise dispatch with live corridor telemetry and kinematic digital twin simulation.
            </p>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-w-lg">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm flex items-start gap-3 shadow-sm">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-cyan-400 shrink-0">
                  <ShieldIcon size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Strict Multi-Tenant RBAC</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Automated role verification protects operational commands.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm flex items-start gap-3 shadow-sm">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                  <RadarIcon size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Live Telemetry Radar</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Real-time geospatial state tracking at 10 Hz streaming.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right / Glass Authentication Panel */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-750/80 bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl dark:shadow-2xl shadow-slate-200/60 dark:shadow-black/70 p-7 sm:p-9 space-y-6 transition-all">
              
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome back</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sign in with your verified credentials to enter your workspace.
                </p>
              </div>

              {/* Error Alert Banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertTriangleIcon size={16} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="login-identifier"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                  >
                    Email / Username
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@company.com or admin"
                    autoComplete="username"
                    className="w-full bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className="w-full bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ChevronRightIcon size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Account Quick Fill Helpers */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Quick demo access:</span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleFillAdmin}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium text-center transition-colors"
                  >
                    Fill Admin Account (admin@skynav.test)
                  </button>
                </div>
              </div>

              {/* Footer Switch to Signup */}
              <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
                Don't have an account?{" "}
                <Link href="/signup" className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline">
                  Create SkyNav Account
                </Link>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Page Footer */}
      <footer className="h-12 px-6 max-w-7xl w-full mx-auto flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800/60 z-10">
        <span>© 2026 SkyNav Aviation Logistics. All rights reserved.</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM SECURE
        </span>
      </footer>
    </div>
  );
}
