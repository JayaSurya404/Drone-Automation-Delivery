"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DroneIcon,
  ShieldIcon,
  PackageIcon,
  RadarIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from "@skynav/ui";
import { useAuth } from "@/features/auth/auth-context";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function SignupPage() {
  let router: any = { push: () => {}, replace: () => {} };
  try {
    router = useRouter();
  } catch {}
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Password strength calculation
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "Empty", color: "bg-slate-300 dark:bg-slate-700" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      return { score: 1, label: "Weak", color: "bg-red-500", percent: "33%" };
    }
    if (score <= 3) {
      return { score: 2, label: "Moderate", color: "bg-amber-500", percent: "66%" };
    }
    return { score: 3, label: "Strong", color: "bg-emerald-500", percent: "100%" };
  }, [password]);

  const passwordsMatch = !confirmPassword || password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage("Password must contain uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim(),
        password
      });

      if (res.success) {
        router.push(res.redirectTo);
      } else {
        setErrorMessage(res.error || "Failed to create account.");
      }
    } catch {
      setErrorMessage("Registration gateway unavailable. Please verify network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-cyan-500/10 dark:from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-3xl pointer-events-none" />

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
            href="/login"
            className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline px-3 py-1.5"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex items-center justify-center z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left / Feature Overview */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Recipient & Customer Onboarding</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Join the next era of{" "}
              <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-300 dark:to-teal-200 bg-clip-text text-transparent">
                autonomous delivery.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
              Create your customer account to track incoming UAV deliveries in real time, view high-precision corridor radar, and verify drop-zone landings with cryptographic proof-of-delivery codes.
            </p>

            <div className="space-y-3 pt-2 max-w-lg">
              <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircleIcon size={16} className="text-emerald-500 shrink-0" />
                <span>Live GPS & telemetry tracking on interactive 2D geospatial maps</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircleIcon size={16} className="text-emerald-500 shrink-0" />
                <span>Kinematic dynamic ETA countdown and flight status notifications</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircleIcon size={16} className="text-emerald-500 shrink-0" />
                <span>Strictly isolated tenant workspace and order privacy</span>
              </div>
            </div>
          </div>

          {/* Right / Glass Signup Panel */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-750/80 bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl dark:shadow-2xl shadow-slate-200/60 dark:shadow-black/70 p-7 sm:p-9 space-y-6 transition-all">
              
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Create your account</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Register as a SkyNav recipient to manage drone deliveries.
                </p>
              </div>

              {/* Error Alert Banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertTriangleIcon size={16} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                  >
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className="w-full bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                  >
                    Email Address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    autoComplete="email"
                    className="w-full bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="signup-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    {password && (
                      <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
                        Strength: <strong className={strength.score >= 3 ? "text-emerald-500" : strength.score === 2 ? "text-amber-500" : "text-red-500"}>{strength.label}</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 chars, uppercase & number"
                      autoComplete="new-password"
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
                  {/* Strength Bar */}
                  {password && (
                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full ${strength.color} transition-all duration-300`}
                        style={{ width: strength.percent }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className={`w-full bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                      !passwordsMatch ? "border-red-500/80 focus:border-red-500" : "border-slate-300 dark:border-slate-700 focus:border-blue-500"
                    }`}
                  />
                  {!passwordsMatch && (
                    <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !passwordsMatch}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ChevronRightIcon size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Back to Login */}
              <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
                Already registered?{" "}
                <Link href="/login" className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline">
                  Sign In to SkyNav
                </Link>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Page Footer */}
      <footer className="h-12 px-6 max-w-7xl w-full mx-auto flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800/60 z-10">
        <span>© 2026 SkyNav Aviation Logistics. Customer access only.</span>
        <span className="font-mono text-cyan-600 dark:text-cyan-400">TENANT ISOLATED</span>
      </footer>
    </div>
  );
}
