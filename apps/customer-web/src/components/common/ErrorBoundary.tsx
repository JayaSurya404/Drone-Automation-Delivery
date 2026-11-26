import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
    console.error('[SkyNav Customer Web ErrorBoundary] Caught unhandled exception:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const isApiDown =
        (this.state.error as any)?.isApiDown ||
        this.state.error?.message?.includes('502') ||
        this.state.error?.message?.includes('503') ||
        this.state.error?.message?.includes('504') ||
        this.state.error?.message?.includes('temporarily unavailable') ||
        this.state.error?.message?.includes('Failed to fetch') ||
        this.state.error?.message?.includes('NetworkError');

      const title = isApiDown ? 'SkyNav Service Temporarily Unavailable' : 'Something went wrong';
      const description = isApiDown
        ? 'The autonomous delivery API gateway is currently offline (502 / network). Please verify the backend service or click Retry to reconnect.'
        : 'An unexpected error occurred while rendering the customer portal. Our autonomous flight platform logged the issue.';

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#090d16',
          color: '#f1f5f9',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: isApiDown ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(51, 65, 85, 0.6)',
            borderRadius: '24px',
            padding: '36px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: isApiDown ? 'rgba(14, 165, 233, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: isApiDown ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: isApiDown ? '#38bdf8' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <AlertTriangle style={{ width: 32, height: 32 }} />
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 10px', color: '#f8fafc' }}>
              {title}
            </h1>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              {description}
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px',
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                <RefreshCw style={{ width: 16, height: 16 }} />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(71, 85, 105, 0.6)',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <Home style={{ width: 16, height: 16 }} />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
