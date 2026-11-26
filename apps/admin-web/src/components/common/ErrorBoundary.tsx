import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, LayoutDashboard } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[SkyNav Admin Web ErrorBoundary] Caught unhandled exception:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                COMMAND CENTER EXCEPTION
              </div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                Operations Console Error
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                An unexpected runtime error occurred in the administrator dashboard. Flight operations telemetry continues securely.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="bg-slate-950 border border-rose-500/20 rounded-xl p-3 text-left text-xs font-mono text-rose-400 overflow-x-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Console
              </button>

              <button
                onClick={this.handleGoHome}
                className="py-2.5 px-5 rounded-xl text-xs font-semibold tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
