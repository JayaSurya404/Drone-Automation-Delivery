"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { UserRole } from "@skynav/contracts";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; redirectTo: string; error?: string }>;
  register: (data: { name: string; email: string; password: string; organizationName?: string }) => Promise<{ success: boolean; redirectTo: string; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session from localStorage/cookies on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("skynav_token");
      const savedUserStr = localStorage.getItem("skynav_user");

      if (savedToken && savedUserStr) {
        const savedUser: AuthUser = JSON.parse(savedUserStr);
        setToken(savedToken);
        setUser(savedUser);
        setCookie("skynav_token", savedToken);
        setCookie("skynav_role", savedUser.role);
      }
    } catch {
      // Invalid cached session
      localStorage.removeItem("skynav_token");
      localStorage.removeItem("skynav_user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials)
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          redirectTo: "/login",
          error: data.detail || data.message || "Invalid email or password."
        };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.organization.role,
        organizationId: data.organization.id,
        organizationName: data.organization.name
      };

      setToken(data.accessToken);
      setUser(authUser);

      localStorage.setItem("skynav_token", data.accessToken);
      localStorage.setItem("skynav_user", JSON.stringify(authUser));

      setCookie("skynav_token", data.accessToken);
      setCookie("skynav_role", authUser.role);

      const targetRoute = authUser.role === "ADMIN" ? "/admin" : "/customer";
      return { success: true, redirectTo: targetRoute };
    } catch (err: any) {
      return {
        success: false,
        redirectTo: "/login",
        error: err.message || "Failed to reach authentication gateway."
      };
    }
  }, []);

  const register = useCallback(async (formData: { name: string; email: string; password: string; organizationName?: string }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          redirectTo: "/signup",
          error: data.detail || data.message || "Registration could not be completed."
        };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: "CUSTOMER", // Customer signup strictly yields CUSTOMER
        organizationId: data.organization.id,
        organizationName: data.organization.name
      };

      setToken(data.accessToken);
      setUser(authUser);

      localStorage.setItem("skynav_token", data.accessToken);
      localStorage.setItem("skynav_user", JSON.stringify(authUser));

      setCookie("skynav_token", data.accessToken);
      setCookie("skynav_role", "CUSTOMER");

      return { success: true, redirectTo: "/customer" };
    } catch (err: any) {
      return {
        success: false,
        redirectTo: "/signup",
        error: err.message || "Failed to reach registration gateway."
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        }).catch(() => {});
      }
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("skynav_token");
      localStorage.removeItem("skynav_user");
      deleteCookie("skynav_token");
      deleteCookie("skynav_role");
      router.push("/login");
    }
  }, [token, router]);

  const isAuthenticated = Boolean(user && token);
  const isAdmin = user?.role === "ADMIN";
  const isCustomer = user?.role === "CUSTOMER";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        isCustomer,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      isCustomer: false,
      login: async () => ({ success: false, redirectTo: "/login", error: undefined }),
      register: async () => ({ success: false, redirectTo: "/signup", error: undefined }),
      logout: async () => {}
    };
  }
  return context;
}
