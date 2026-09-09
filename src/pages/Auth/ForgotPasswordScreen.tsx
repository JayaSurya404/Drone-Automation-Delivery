import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { Drone3DHero } from '../../components/drone/Drone3DHero';

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBackToLogin }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Email, 2: OTP Code, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

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

  useEffect(() => {
    let interval: any = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError('Please enter a valid email address format (e.g. admin@skynav.com).');
      return;
    }
    setEmailError('');
    setStep(2);
    setTimer(60);
    setCanResend(false);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join('');
    if (code.length < 6) {
      setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }
    setOtpError('');
    setStep(3);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (strengthScore < 4) {
      setPasswordError('Password must meet at least 4 security criteria.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordError('');
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Ambient Background */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO LOGIN
        </button>

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Forgot Password?</h2>
                <p className="text-xs text-slate-400">
                  Enter your registered admin email address to receive a secure password reset code.
                </p>
              </div>
            </div>

            <form onSubmit={handleSendEmail} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Admin Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="admin@skynav.com"
                  className={`w-full bg-slate-950 border ${
                    emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-800 focus:ring-cyan-500'
                  } rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2`}
                />
                {emailError && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-cyan-500/25"
              >
                Send Verification Code
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Enter 6-Digit OTP */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Enter Verification Code</h2>
                <p className="text-xs text-slate-400">
                  We sent a 6-digit verification code to <span className="text-cyan-400 font-mono">{email}</span>.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
              <div className="flex justify-between gap-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    maxLength={1}
                    value={otpCode[idx]}
                    onChange={(e) => {
                      const val = e.target.value;
                      const newOtp = [...otpCode];
                      newOtp[idx] = val;
                      setOtpCode(newOtp);
                      if (val && idx < 5) {
                        const nextInput = document.getElementById(`otp-${idx + 1}`);
                        nextInput?.focus();
                      }
                    }}
                    className="w-12 h-14 bg-slate-950 border border-slate-800 rounded-xl text-center font-mono text-xl font-bold text-cyan-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-xs text-red-400 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {otpError}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Didn't receive the code?</span>
                {canResend ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTimer(60);
                      setCanResend(false);
                    }}
                    className="text-cyan-400 font-semibold hover:underline"
                  >
                    Resend Code
                  </button>
                ) : (
                  <span className="font-mono text-slate-500">Resend in {timer}s</span>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-cyan-500/25"
              >
                Verify Code
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: Create New Password */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Set New Password</h2>
                <p className="text-xs text-slate-400">
                  Create a new secure password for your SKYNAV Admin account.
                </p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Password Strength Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Password Strength</span>
                  <span
                    className={
                      strengthScore <= 2 ? 'text-red-400' : strengthScore <= 4 ? 'text-amber-400' : 'text-emerald-400'
                    }
                  >
                    {strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Medium' : 'Strong'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex gap-1">
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

              {/* Password Criteria List */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> One uppercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> One lowercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> One number
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {passwordError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-cyan-500/25"
              >
                Reset Password
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: Success Message */}
        {step === 4 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Password Reset Successful</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
              Your SKYNAV Admin credentials have been updated securely. You can now sign in with your new password.
            </p>
            <button
              onClick={onBackToLogin}
              className="mt-6 w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-cyan-500/25"
            >
              Sign In Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
