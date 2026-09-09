import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser, AdminRole } from '../types/skynav';
import { INITIAL_ADMINS } from '../data/mockData';

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (email: string, role?: AdminRole, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: AdminRole) => void;
  hasPermission: (pathOrRoles: string | AdminRole[]) => boolean;
  getDefaultRouteForRole: (role?: AdminRole) => string;
}

const STORAGE_KEY = 'skynav_auth_user';

// Role-to-Route Permission Matrix
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['*'],
  ops_admin: [
    '/dashboard',
    '/simulation',
    '/operations',
    '/orders',
    '/missions',
    '/packages',
    '/routes',
    '/fleet',
    '/customers',
    '/reports',
    '/support',
    '/notifications',
  ],
  fleet_manager: [
    '/dashboard',
    '/simulation',
    '/fleet',
    '/battery-health',
    '/maintenance',
    '/operations',
    '/emergency',
    '/notifications',
  ],
  dispatch_manager: [
    '/dashboard',
    '/simulation',
    '/orders',
    '/missions',
    '/packages',
    '/routes',
    '/operations',
    '/emergency',
    '/notifications',
  ],
  support_admin: [
    '/simulation',
    '/customers',
    '/orders',
    '/support',
    '/notifications',
  ],
  analytics_admin: [
    '/dashboard',
    '/simulation',
    '/analytics',
    '/reports',
    '/payments',
    '/notifications',
  ],
  analyst: [
    '/dashboard',
    '/simulation',
    '/analytics',
    '/reports',
    '/payments',
    '/notifications',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to restore saved user from localStorage or sessionStorage
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse error
    }
    // Default to Super Admin for initial seamless demo if nothing saved
    return INITIAL_ADMINS[0];
  });

  const getDefaultRouteForRole = (role?: AdminRole): string => {
    const activeRole = role || user?.role || 'super_admin';
    switch (activeRole) {
      case 'fleet_manager':
        return '/fleet';
      case 'dispatch_manager':
        return '/orders';
      case 'support_admin':
        return '/customers';
      case 'analytics_admin':
      case 'analyst':
        return '/analytics';
      case 'super_admin':
      case 'ops_admin':
      default:
        return '/dashboard';
    }
  };

  const login = async (
    email: string,
    role: AdminRole = 'super_admin',
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    // Artificial latency for authentic enterprise feel
    await new Promise((resolve) => setTimeout(resolve, 600));

    const cleanEmail = email.trim().toLowerCase();

    // Check against predefined enterprise profiles
    let matchedUser = INITIAL_ADMINS.find(
      (a) => a.email.toLowerCase() === cleanEmail || a.role === role
    );

    if (!matchedUser) {
      const nameFromEmail = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      matchedUser = {
        id: `ADM-${Math.floor(100 + Math.random() * 900)}`,
        name: nameFromEmail.replace(/\b\w/g, (c) => c.toUpperCase()),
        email: cleanEmail,
        phone: '+91 98400 ' + Math.floor(10000 + Math.random() * 90000),
        role,
        status: 'Active',
        lastLogin: 'Just now (New Session)',
        permissions: ROLE_PERMISSIONS[role] || ['*'],
      };
    } else if (role && matchedUser.role !== role) {
      // If user explicitly picked a demo role on the login UI, update role profile
      const roleProfile = INITIAL_ADMINS.find((a) => a.role === role) || matchedUser;
      matchedUser = {
        ...roleProfile,
        email: cleanEmail,
      };
    }

    setUser(matchedUser);

    try {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(matchedUser));
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(matchedUser));
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage unavailable fallback
    }

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage cleanup fallback
    }
  };

  const switchRole = (role: AdminRole) => {
    const roleProfile = INITIAL_ADMINS.find((a) => a.role === role);
    if (roleProfile) {
      setUser(roleProfile);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(roleProfile));
      } catch {}
    }
  };

  const hasPermission = (pathOrRoles: string | AdminRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    if (Array.isArray(pathOrRoles)) {
      return pathOrRoles.includes(user.role);
    }

    const path = pathOrRoles.toLowerCase();
    const allowed = ROLE_PERMISSIONS[user.role] || [];
    if (allowed.includes('*')) return true;
    return allowed.some((allowedPath) => path.startsWith(allowedPath));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
        hasPermission,
        getDefaultRouteForRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
