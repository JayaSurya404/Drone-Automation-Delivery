import React, { createContext, useContext, useEffect, useState } from 'react';
import { CustomerUser, LoginPayload, RegisterPayload, ResetPasswordPayload, PendingAction } from '../types/auth';
import { storage } from '../services/storage';
import { api, customerApiClient } from '../services/api';

const PENDING_ACTION_KEY = 'drone_customer_pending_action';

interface AuthContextType {
  user: CustomerUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;
  clearPendingAction: () => void;
  login: (payload: LoginPayload) => Promise<{ user: CustomerUser; token: string }>;
  register: (payload: RegisterPayload) => Promise<{ user: CustomerUser | null; token?: string; requiresVerification: boolean; email?: string; message: string; deliveryPin?: string }>;
  verifyAccount: (payload: { code: string; email?: string }) => Promise<{ success: boolean; user: CustomerUser; token: string; message: string }>;
  resendVerification: (payload: { email?: string }) => Promise<{ success: boolean; message: string }>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<string>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<CustomerUser>) => Promise<CustomerUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(() => {
    return storage.get<PendingAction | null>(PENDING_ACTION_KEY, null);
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setPendingAction = (action: PendingAction | null) => {
    setPendingActionState(action);
    if (action) {
      storage.set(PENDING_ACTION_KEY, action);
    } else {
      storage.remove(PENDING_ACTION_KEY);
    }
  };

  const clearPendingAction = () => {
    setPendingActionState(null);
    storage.remove(PENDING_ACTION_KEY);
  };

  // Initialize Auth via unified API refresh cookie (in-memory access token)
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const authRes = await customerApiClient.refresh();
        if (authRes && mounted) {
          const u = authRes.user;
          const mappedUser: CustomerUser = {
            id: u.id,
            name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email.split('@')[0],
            email: u.email,
            phone: '+91 98765 43210',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            accountStatus: 'active',
            isVerified: u.isEmailVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notificationPreferences: { emailUpdates: true, smsAlerts: true, droneProximitySound: true },
          };
          setUser(mappedUser);
          setToken(authRes.accessToken);
        } else if (mounted) {
          setUser(null);
          setToken(null);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(payload);
      setUser(res.user);
      setToken(res.token);
      if (payload.email?.trim().toLowerCase() === 'customer@skynav') {
        storage.set('skynav_permanent_delivery_pin', '4827');
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await api.auth.register(payload);
      if (res.user && res.token) {
        setUser(res.user);
        setToken(res.token);
      }
      if (res.deliveryPin) {
        storage.set('skynav_permanent_delivery_pin', res.deliveryPin);
      }
      return {
        ...res,
        requiresVerification: false,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAccount = async (payload: { code: string; email?: string }) => {
    const res = await api.auth.verifyAccount(payload);
    if (res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
    }
    return res;
  };

  const resendVerification = async (payload: { email?: string }) => {
    return await api.auth.resendVerification(payload);
  };

  const forgotPassword = async (email: string) => {
    const res = await api.auth.forgotPassword(email);
    return res.message;
  };

  const resetPassword = async (payload: ResetPasswordPayload) => {
    const res = await api.auth.resetPassword({
      email: payload.email || '',
      code: payload.code || '',
      password: payload.newPassword || payload.password || '',
      confirmPassword: payload.confirmPassword || '',
    });
    return res.message;
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setToken(null);
    clearPendingAction();
  };

  const updateProfile = async (updates: Partial<CustomerUser>) => {
    if (!user) throw new Error('Not authenticated');
    await api.customer.updateProfile(updates);
    const updated = { ...user, ...updates };
    setUser(updated);
    return updated;
  };

  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        pendingAction,
        setPendingAction,
        clearPendingAction,
        login,
        register,
        verifyAccount,
        resendVerification,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
