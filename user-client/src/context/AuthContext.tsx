'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { User } from '@/lib/types';

interface ProfileUpdatePayload {
  fullName: string;
  phone?: string;
  bio?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const data = await apiRequest<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error on logout
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const data = await apiRequest<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiRequest('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
