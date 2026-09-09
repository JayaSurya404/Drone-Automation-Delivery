import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser, AdminRole } from '../types/skynav';

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (email: string, role?: AdminRole, rememberMe?: boolean, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: AdminRole) => void;
  hasPermission: (pathOrRoles: string | AdminRole[]) => boolean;
  getDefaultRouteForRole: (role?: AdminRole) => string;
}

const STORAGE_KEY = 'skynav_auth_user';
const TOKEN_KEY = 'skynav_admin_token';

// Role-to-Route Permission Matrix (Single Full-Access Admin Account)
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  admin: ['*'],
  super_admin: ['*'],
  ops_admin: ['*'],
  fleet_manager: ['*'],
  dispatch_manager: ['*'],
  support_admin: ['*'],
  analytics_admin: ['*'],
  analyst: ['*'],
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
    return null;
  });

  // Verify session on mount with backend /api/admin/auth/me
  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

    if (token) {
      fetch('/api/admin/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.user) {
              const fullUser: AdminUser = {
                ...data.user,
                lastLogin: 'Active Session',
                permissions: ['*'],
              };
              setUser(fullUser);
              const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
              storage.setItem(STORAGE_KEY, JSON.stringify(fullUser));
            }
          } else {
            // Token expired or invalid
            if (isMounted) {
              setUser(null);
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(STORAGE_KEY);
              sessionStorage.removeItem(TOKEN_KEY);
              sessionStorage.removeItem(STORAGE_KEY);
            }
          }
        })
        .catch(() => {
          // Network error - retain cached user if present
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const getDefaultRouteForRole = (_role?: AdminRole): string => {
    return '/dashboard';
  };

  const login = async (
    email: string,
    role: AdminRole = 'admin',
    rememberMe = true,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: password || '',
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid administrator credentials.' };
      }

      const authenticatedUser: AdminUser = {
        ...data.user,
        lastLogin: 'Active Session',
        permissions: ['*'],
      };

      setUser(authenticatedUser);

      const storage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;

      storage.setItem(TOKEN_KEY, data.token);
      storage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
      otherStorage.removeItem(TOKEN_KEY);
      otherStorage.removeItem(STORAGE_KEY);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unable to connect to authentication server.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  };

  const switchRole = (_role: AdminRole) => {
    // Single full-access admin account mode active - no role switching needed
  };

  const hasPermission = (_pathOrRoles: string | AdminRole[]): boolean => {
    if (!user) return false;
    // Single admin account has authoritative full access across all operations
    return true;
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
