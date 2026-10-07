'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { UserRole, UserSession } from '@/types';

interface AuthContextType {
  user: UserSession | null;
  userRole: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: UserSession; error?: string }>;
  register: (data: any) => Promise<{ success: boolean; user?: UserSession; error?: string }>;
  logout: () => Promise<void>;
  quickDemoLogin: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserAvatar: (avatarUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data?.user) {
        setUser(res.data.user);
        setUserRole(res.data.user.role as UserRole);
      } else {
        setUser(null);
        setUserRole(null);
      }
    } catch (err) {
      setUser(null);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data?.user) {
        const fullUser = {
          ...res.data.user,
          driverProfile: res.data.driverProfile || res.data.user.driverProfile,
          commuterProfile: res.data.commuterProfile || res.data.user.commuterProfile,
        };
        setUser(fullUser);
        setUserRole(fullUser.role as UserRole);
        return { success: true, user: fullUser };
      }
      return { success: false, error: 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Invalid credentials' };
    }
  };

  const register = async (data: any) => {
    try {
      const res = await axios.post('/api/auth/register', data);
      if (res.data?.user) {
        const fullUser = {
          ...res.data.user,
          driverProfile: res.data.driverProfile || res.data.user.driverProfile,
          commuterProfile: res.data.commuterProfile || res.data.user.commuterProfile,
        };
        setUser(fullUser);
        setUserRole(fullUser.role as UserRole);
        return { success: true, user: fullUser };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.warn('Primary logout attempt noticed error, trying fallback:', error);
      try {
        await axios.post('/api/auth/me');
      } catch {}
    } finally {
      setUser(null);
      setUserRole(null);
      router.replace('/');
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const quickDemoLogin = async (role: UserRole) => {
    // Admin accounts must always authenticate with explicit credentials; demo shortcut prohibited
    if (role === 'ADMIN') {
      router.push('/login?role=admin');
      return;
    }

    try {
      const res = await axios.post('/api/auth/demo', { role });
      if (res.data?.user) {
        const fullUser = {
          ...res.data.user,
          driverProfile: res.data.driverProfile || res.data.user.driverProfile,
          commuterProfile: res.data.commuterProfile || res.data.user.commuterProfile,
        };
        setUser(fullUser);
        setUserRole(fullUser.role as UserRole);
        const targetPath = role === 'DRIVER' ? '/driver/dashboard' : '/commuter/dashboard';
        router.push(targetPath);
      }
    } catch (err: any) {
      console.warn('Demo login notice:', err?.response?.data?.error || err.message);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const updateUserAvatar = (avatarUrl: string | null) => {
    setUser((prev) => (prev ? { ...prev, avatar: avatarUrl } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        loading,
        login,
        register,
        logout,
        quickDemoLogin,
        refreshUser,
        updateUserAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
