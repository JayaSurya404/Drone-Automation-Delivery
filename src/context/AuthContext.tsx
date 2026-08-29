import React, { createContext, useContext, useEffect, useState } from 'react';
import { CustomerUser, LoginPayload, RegisterPayload, ResetPasswordPayload, PendingAction } from '../types/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { storage } from '../services/storage';
import { api } from '../services/api';

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
  register: (payload: RegisterPayload) => Promise<{ user: CustomerUser | null; token?: string; requiresVerification: boolean; email?: string; message: string }>;
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

  // Helper to fetch profile from public.profiles
  const fetchUserProfile = async (supabaseUser: any): Promise<CustomerUser> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .single();

      return {
        id: supabaseUser.id,
        name: profile?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Customer',
        email: supabaseUser.email || '',
        phone: profile?.phone || supabaseUser.user_metadata?.phone || '+1 (555) 000-0000',
        avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        accountStatus: 'active',
        isVerified: Boolean(supabaseUser.email_confirmed_at || supabaseUser.confirmed_at),
        createdAt: supabaseUser.created_at || new Date().toISOString(),
        updatedAt: profile?.updated_at || new Date().toISOString(),
        notificationPreferences: {
          emailUpdates: prefs?.email_updates ?? true,
          smsAlerts: prefs?.sms_alerts ?? true,
          droneProximitySound: prefs?.drone_proximity_sound ?? true,
        },
      };
    } catch {
      return {
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Customer',
        email: supabaseUser.email || '',
        phone: '+1 (555) 000-0000',
        accountStatus: 'active',
        isVerified: Boolean(supabaseUser.email_confirmed_at || supabaseUser.confirmed_at),
        createdAt: supabaseUser.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationPreferences: { emailUpdates: true, smsAlerts: true, droneProximitySound: true },
      };
    }
  };

  // Initialize Supabase Auth & Listen to State Changes
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (!isSupabaseConfigured()) {
        const storedUser = storage.get<CustomerUser | null>(storage.keys.AUTH_USER, null);
        const storedToken = storage.get<string | null>(storage.keys.AUTH_TOKEN, null);
        if (storedUser && storedToken && mounted) {
          setUser(storedUser);
          setToken(storedToken);
        }
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const profile = await fetchUserProfile(session.user);
          setUser(profile);
          setToken(session.access_token);
        } else if (mounted) {
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error('Error initializing Supabase session:', err);
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    // Supabase Auth State Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
        setToken(session.access_token);
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email.trim(),
          password: payload.password,
        });

        if (error) {
          throw new Error(error.message || 'Invalid email or password.');
        }

        if (!data.user || !data.session) {
          throw new Error('Authentication failed. Please try again.');
        }

        const profile = await fetchUserProfile(data.user);
        setUser(profile);
        setToken(data.session.access_token);
        return { user: profile, token: data.session.access_token };
      } else {
        const res = await api.auth.login(payload);
        setUser(res.user);
        setToken(res.token);
        return res;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
          options: {
            data: {
              full_name: payload.name.trim(),
              phone: payload.phone.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          throw new Error(error.message || 'Registration failed.');
        }

        const isConfirmed = Boolean(data.user?.email_confirmed_at || data.user?.confirmed_at);
        let profile: CustomerUser | null = null;

        if (data.user && isConfirmed) {
          profile = await fetchUserProfile(data.user);
          setUser(profile);
          if (data.session) {
            setToken(data.session.access_token);
          }
        }

        return {
          user: profile,
          token: data.session?.access_token,
          requiresVerification: !isConfirmed,
          email: payload.email.trim(),
          message: isConfirmed
            ? 'Account created successfully!'
            : 'Registration successful! Please check your email inbox to verify your account.',
        };
      } else {
        return await api.auth.register(payload);
      }
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
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      return 'Password reset link has been dispatched to your email.';
    } else {
      const res = await api.auth.forgotPassword(email);
      return res.message;
    }
  };

  const resetPassword = async (payload: ResetPasswordPayload) => {
    if (isSupabaseConfigured()) {
      const password = payload.newPassword || payload.password;
      if (!password) throw new Error('Password is required.');
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw new Error(error.message);
      return 'Password updated successfully.';
    } else {
      const res = await api.auth.resetPassword({
        email: payload.email || '',
        code: payload.code || '',
        password: payload.newPassword || payload.password || '',
        confirmPassword: payload.confirmPassword || '',
      });
      return res.message;
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    } else {
      await api.auth.logout();
    }
    setUser(null);
    setToken(null);
    clearPendingAction();
  };

  const updateProfile = async (updates: Partial<CustomerUser>) => {
    if (!user) throw new Error('Not authenticated');

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          phone: updates.phone,
          avatar_url: updates.avatar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw new Error(error.message);
    } else {
      await api.customer.updateProfile(updates);
    }

    const updated = { ...user, ...updates };
    setUser(updated);
    return updated;
  };

  const isAuthenticated = Boolean(user && user.isVerified && token);

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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
