import React, { createContext, useContext, useEffect, useState } from 'react';
import { CustomerUser, LoginPayload, RegisterPayload } from '../types/auth';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { INITIAL_USER } from '../services/mockData';

interface AuthContextType {
  user: CustomerUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ requiresVerification: boolean }>;
  verifyAccount: (otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (password: string, confirm: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<CustomerUser>) => Promise<CustomerUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(() => {
    return storage.get<CustomerUser | null>(storage.keys.AUTH_USER, INITIAL_USER);
  });
  const [token, setToken] = useState<string | null>(() => {
    return storage.get<string | null>(storage.keys.AUTH_TOKEN, 'jwt_skylink_demo_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial sync
    const savedUser = storage.get<CustomerUser | null>(storage.keys.AUTH_USER, INITIAL_USER);
    const savedToken = storage.get<string | null>(storage.keys.AUTH_TOKEN, 'jwt_skylink_demo_token');
    setUser(savedUser);
    setToken(savedToken);
    setIsLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(payload);
      setUser(res.user);
      setToken(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await api.auth.register(payload);
      setUser(res.user);
      return { requiresVerification: res.requiresVerification };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAccount = async (otp: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.verifyAccount(otp);
      setUser(res.user);
      setToken(`jwt_verified_${Date.now()}`);
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    const res = await api.auth.forgotPassword(email);
    return res.message;
  };

  const resetPassword = async (password: string, confirm: string) => {
    await api.auth.resetPassword(password, confirm);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (updates: Partial<CustomerUser>) => {
    const updated = await api.customer.updateProfile(updates);
    setUser(updated);
    return updated;
  };

  const isAuthenticated = !!user && user.isVerified && !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        verifyAccount,
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
