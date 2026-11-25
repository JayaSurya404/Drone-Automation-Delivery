import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '@skynav/api-client';
import { AdminUser, AdminRole } from '../types/skynav';
import { mockStore } from '../services/mockDataStore';

export const adminApiClient = new ApiClient({
  baseUrl: '',
  clientType: 'admin',
});

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

const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard.read',
  '/simulation': 'simulation.read',
  '/operations': 'missions.read',
  '/orders': 'orders.read',
  '/products': 'catalog.read',
  '/missions': 'missions.read',
  '/packages': 'orders.read',
  '/routes': 'missions.read',
  '/fleet': 'drones.read',
  '/battery-health': 'drones.read',
  '/maintenance': 'drones.read',
  '/customers': 'users.read',
  '/merchants': 'catalog.read',
  '/geofencing': 'geofencing.read',
  '/emergency': 'incidents.read',
  '/payments': 'orders.read',
  '/analytics': 'analytics.read',
  '/reports': 'analytics.read',
  '/notifications': 'notifications.read',
  '/support': 'support.read',
  '/audit-logs': 'audit.read',
  '/admins': 'users.read',
  '/settings': 'system.manage',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  });

  // Silent session refresh on mount via httpOnly admin refresh cookie (in-memory access token)
  useEffect(() => {
    let isMounted = true;

    adminApiClient.refresh()
      .then(async (authRes) => {
        if (authRes && isMounted) {
          const u = authRes.user;
          const role: AdminRole = (u.roles?.find((r) => r !== 'customer' && r !== 'guest') as AdminRole) || 'super_admin';
          const fullUser: AdminUser = {
            id: u.id,
            name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Admin User',
            email: u.email,
            role,
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
            status: 'Active',
            lastLogin: 'Active Session',
            permissions: u.roles?.includes('super_admin') ? ['*'] : (u.roles || ['*']),
          };
          setUser(fullUser);
          mockStore.refreshSession();
        } else if (isMounted) {
          // If silent refresh failed and no active token in memory, clear stale user cache
          if (!adminApiClient.getAccessToken()) {
            setUser(null);
            localStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(STORAGE_KEY);
          }
        }
      })
      .catch(() => {
        if (isMounted && !adminApiClient.getAccessToken()) {
          setUser(null);
        }
      });

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
    _rememberMe = true,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const authRes = await adminApiClient.login({
        email: cleanEmail,
        password: password || '',
      });

      const u = authRes.user;
      const primaryRole: AdminRole = (u.roles?.find((r) => r !== 'customer' && r !== 'guest') as AdminRole) || role || 'super_admin';
      const authenticatedUser: AdminUser = {
        id: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Admin User',
        email: u.email,
        role: primaryRole,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        status: 'Active',
        lastLogin: 'Active Session',
        permissions: u.roles?.includes('super_admin') ? ['*'] : (u.roles || ['*']),
      };

      setUser(authenticatedUser);
      // Persist profile metadata (non-sensitive; token is kept strictly in-memory in adminApiClient)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
      mockStore.refreshSession();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unable to connect to authentication server.' };
    }
  };

  const logout = () => {
    adminApiClient.logout().catch(() => {});
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    mockStore.clearSession();
  };

  const switchRole = (_role: AdminRole) => {
    // Role comes from backend RBAC claims
  };

  const hasPermission = (pathOrRoles: string | AdminRole[]): boolean => {
    if (!user) return false;
    // Super admin with wildcard has authoritative access across all routes and operations
    if (user.role === 'super_admin' || user.permissions?.includes('*')) return true;

    if (typeof pathOrRoles === 'string') {
      const requiredPerm = ROUTE_PERMISSION_MAP[pathOrRoles];
      if (!requiredPerm) return true;
      return user.permissions?.includes(requiredPerm) ?? false;
    }

    return pathOrRoles.includes(user.role);
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
