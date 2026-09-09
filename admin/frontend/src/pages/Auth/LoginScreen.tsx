import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  PlaneTakeoff,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { AdminRole } from '../../types/skynav';
import { RealDroneGallery } from '../../components/drone/RealDroneGallery';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { EmailVerificationScreen } from './EmailVerificationScreen';

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login, getDefaultRouteForRole } = useAuth();

  const [view, setView] = useState<'login' | 'forgot' | 'verify'>('login');
  const [email, setEmail] = useState('admin@skynav.com');
  const [password, setPassword] = useState('Admin@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedRole, setSelectedRole] = useState<AdminRole>('super_admin');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Quick Demo Roles for easy inspection during review
  const DEMO_ROLES: { role: AdminRole; label: string; email: string; name: string }[] = [
    { role: 'super_admin', label: 'Super Admin', email: 'admin@skynav.com', name: 'Rajesh Sharma' },
    { role: 'ops_admin', label: 'Operations Admin', email: 'operations@skynav.com', name: 'Arjun Kumar' },
    { role: 'fleet_manager', label: 'Fleet Manager', email: 'fleet@skynav.com', name: 'Ananya Menon' },
    { role: 'dispatch_manager', label: 'Dispatch Manager', email: 'dispatch@skynav.com', name: 'Vikram Iyer' },
    { role: 'support_admin', label: 'Support Admin', email: 'support@skynav.com', name: 'Deepa Krishnan' },
    { role: 'analytics_admin', label: 'Analytics Admin', email: 'analytics@skynav.com', name: 'Meera Patel' },
  ];

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const getStrengthScore = () => {
    let score = 0;
    if (hasMinLength) score++;
    if (hasUppercase) score++;
    if (hasLowercase) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    return score;
  };

  const strengthScore = getStrengthScore();

  const handleSelectDemoRole = (roleObj: (typeof DEMO_ROLES)[0]) => {
    setSelectedRole(roleObj.role);
    setEmail(roleObj.email);
    setPassword('Admin@2026!');
    setEmailError('');
    setPasswordError('');
    setGeneralError('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError('Please enter a valid email format (e.g. admin@skynav.com).');
      return;
    }
    setEmailError('');

    if (password.length < 6) {
      setPasswordError('Password must contain at least 6 characters.');
      return;
    }
    setPasswordError('');
    setGeneralError('');

    setIsLoading(true);

    try {
      const res = await login(cleanEmail, selectedRole, rememberMe, password);
      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          const targetPath = getDefaultRouteForRole(selectedRole);
          navigate(targetPath);
        }, 500);
      } else {
        setGeneralError(res.error || 'Authentication failed. Please verify credentials.');
        setIsLoading(false);
      }
    } catch {
      setGeneralError('Unable to connect to SKYNAV services. Please try again.');
      setIsLoading(false);
    }
  };

  if (view === 'forgot') {
    return <ForgotPasswordScreen onBackToLogin={() => setView('login')} />;
  }

  if (view === 'verify') {
    return <EmailVerificationScreen email={email} onBackToLogin={() => setView('login')} />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 lg:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 relative overflow-hidden">
      {/* Background Animated Flight Path Ambient Lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Split-Screen Card */}
      <div className="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Brand & Realistic 3D Drone Hero Visualizer */}
        <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 relative">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 text-white flex items-center justify-center">
                <PlaneTakeoff className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-wider uppercase text-slate-100">
                  SKY<span className="text-cyan-400">NAV</span>
                </h1>
                <p className="text-[11px] text-cyan-400 font-mono tracking-wider uppercase">
                  Autonomous Drone Delivery
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Commercial Operations Command Center. Manage autonomous delivery routes, monitor live flight corridors, evaluate smart drone assignments, and ensure DGCA airspace compliance.
            </p>
          </div>

          {/* Local Photorealistic Commercial Drone Showcase */}
          <div className="my-5">
            <RealDroneGallery onDroneTouch={() => handleSubmit()} />
          </div>

          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Coimbatore Hub • v3.4.0</span>
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              AIRSPACE ACTIVE
            </span>
          </div>
        </div>

        {/* Right Side: Role-Aware Sign In Form */}
        <div className="lg:col-span-6 p-8 lg:p-10 flex flex-col justify-center space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">
              <ShieldCheck className="w-3.5 h-3.5" /> SECURE OPERATIONS PORTAL
            </div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Sign In To SkyNav</h2>
            <p className="text-xs text-slate-400">
              Select an operational role or enter authorized credentials.
            </p>
          </div>

          {/* Quick Demo Role Selector Pills */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Quick Role Demo Access (Click to test role experience)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {DEMO_ROLES.map((r) => {
                const isSelected = selectedRole === r.role;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => handleSelectDemoRole(r)}
                    className={`p-2 rounded-xl text-left transition-all border ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500/80 text-cyan-300 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[10px] font-bold truncate">{r.label}</p>
                    <p className="text-[9px] text-slate-500 font-mono truncate">{r.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {generalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                    setGeneralError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="admin@skynav.com"
                  className={`w-full bg-slate-950 border ${
                    emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:ring-cyan-500'
                  } rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2`}
                />
              </div>
              {emailError && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {emailError}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                    setGeneralError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••••••"
                  className={`w-full bg-slate-950 border ${
                    passwordError ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:ring-cyan-500'
                  } rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {passwordError}
                </p>
              )}

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>SECURITY RATING</span>
                    <span
                      className={
                        strengthScore <= 2 ? 'text-red-400' : strengthScore <= 4 ? 'text-amber-400' : 'text-emerald-400'
                      }
                    >
                      {strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Moderate' : 'Enterprise Strong'}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-950 rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full flex-1 transition-all ${
                        strengthScore >= 1 ? (strengthScore <= 2 ? 'bg-red-500' : 'bg-amber-400') : 'bg-slate-800'
                      }`}
                    />
                    <div
                      className={`h-full flex-1 transition-all ${
                        strengthScore >= 3 ? (strengthScore <= 4 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-800'
                      }`}
                    />
                    <div
                      className={`h-full flex-1 transition-all ${
                        strengthScore >= 5 ? 'bg-emerald-400' : 'bg-slate-800'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Remember Me & Verification / Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0"
                />
                <span>Remember session</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView('verify')}
                  className="text-slate-400 hover:text-cyan-400 text-[11px]"
                >
                  Verify Email
                </button>
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-cyan-400 hover:underline font-semibold text-[11px]"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* Dynamic Sign In Button with Working States */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                isSuccess
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                  : isLoading
                  ? 'bg-cyan-600 text-white cursor-wait opacity-80'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating Role Access...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Access Granted — Launching Command Center...</span>
                </>
              ) : (
                <>
                  <span>Sign In as {DEMO_ROLES.find((d) => d.role === selectedRole)?.label || 'Super Admin'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-1 text-center text-[10px] text-slate-500 flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Encrypted 256-bit TLS Session • Restrict Access to Authorized Personnel</span>
          </div>
        </div>
      </div>
    </div>
  );
};
