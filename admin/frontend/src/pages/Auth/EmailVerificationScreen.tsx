import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';

interface EmailVerificationScreenProps {
  email?: string;
  onBackToLogin: () => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  email = 'admin@skynav.com',
  onBackToLogin,
}) => {
  const [cooldown, setCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resendStatus, setResendStatus] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = () => {
    setCooldown(60);
    setCanResend(false);
    setResendStatus(true);
    setTimeout(() => setResendStatus(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-6">
        <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
          <Mail className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-100">Verify Your Admin Email</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            We sent a secure activation verification link to <span className="text-cyan-400 font-mono font-semibold">{email}</span>. Please check your inbox.
          </p>
        </div>

        {resendStatus && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Verification link re-sent successfully!
          </div>
        )}

        <div className="pt-2 space-y-3">
          <button
            onClick={handleResend}
            disabled={!canResend}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              canResend
                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700'
                : 'bg-slate-950 text-slate-500 border border-slate-900 cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!canResend ? 'animate-spin' : ''}`} />
            {canResend ? 'Resend Verification Email' : `Resend in ${cooldown}s`}
          </button>

          <button
            onClick={onBackToLogin}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/25"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </button>
        </div>

        <p className="text-[10px] text-slate-500 font-mono">
          SKYNAV Identity Protection • Verification Code Expires in 24 Hours
        </p>
      </div>
    </div>
  );
};
