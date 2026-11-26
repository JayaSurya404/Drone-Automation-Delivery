import React, { createContext, useContext, useState, useEffect } from 'react';
import { decodeJwtPayload } from '@skynav/api-client';
import { adminApiClient } from '../services/adminApiClient';
import { AdminUser, AdminRole } from '../types/skynav';
import { mockStore } from '../services/mockDataStore';

export { adminApiClient };

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role?: AdminRole, rememberMe?: boolean, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: AdminRole) => void;
  hasPermission: (pathOrRoles: string | AdminRole[]) => boolean;
  getDefaultRouteForRole: (role?: AdminRole) => string;
}

const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard.read',
  '/simulation': 'simulation.read',
  '/intelligence': 'vision.read',
  '/swarm': 'swarm.read',
  '/digital-twin': 'simulation.read',
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
  // In-memory user state only — never persisted to localStorage
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Silent session refresh on mount via httpOnly admin refresh cookie (in-memory access token)
  useEffect(() => {
    let isMounted = true;

    adminApiClient.refresh()
      .then(async (authRes) => {
        if (authRes && isMounted) {
          const u = authRes.user;
          const staffRole = u.roles?.find((r) => r !== 'customer' && r !== 'guest') as AdminRole | undefined;
          if (!staffRole) {
            setUser(null);
            adminApiClient.logout().catch(() => {});
            return;
          }
          const decoded = decodeJwtPayload<{ permissions?: string[]; roles?: string[] }>(authRes.accessToken);
          const permissions = decoded?.permissions || [];
          const fullUser: AdminUser = {
            id: u.id,
            name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Admin User',
            email: u.email,
            role: staffRole,
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
            status: 'Active',
            lastLogin: 'Active Session',
            permissions: u.roles?.includes('super_admin') ? ['*'] : permissions,
          };
          setUser(fullUser);
          mockStore.refreshSession();
        } else if (isMounted) {
          if (!adminApiClient.getAccessToken()) {
            setUser(null);
          }
        }
      })
      .catch(() => {
        if (isMounted && !adminApiClient.getAccessToken()) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
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
      const staffRole = u.roles?.find((r) => r !== 'customer' && r !== 'guest') as AdminRole | undefined;
      if (!staffRole) {
        adminApiClient.logout().catch(() => {});
        return {
          success: false,
          error: 'Access denied: account does not have administrator privileges.',
        };
      }
      const decoded = decodeJwtPayload<{ permissions?: string[]; roles?: string[] }>(authRes.accessToken);
      const permissions = decoded?.permissions || [];
      const authenticatedUser: AdminUser = {
        id: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Admin User',
        email: u.email,
        role: staffRole,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        status: 'Active',
        lastLogin: 'Active Session',
        permissions: u.roles?.includes('super_admin') ? ['*'] : permissions,
      };

      setUser(authenticatedUser);
      mockStore.refreshSession();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unable to connect to authentication server.' };
    }
  };

  const logout = () => {
    adminApiClient.logout().catch(() => { });
    setUser(null);
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
        isLoading,
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
