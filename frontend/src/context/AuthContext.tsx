'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import socketClient from '@/lib/socket';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  status_message?: string | null;
  last_seen?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  username: string;
  full_name: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  // Fetch current user on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response: any = await api.getCurrentUser();
        setUser(response.user);
      } catch (error) {
        // Not authenticated or token expired
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response: any = await api.login({ email, password });
      setUser(response.user);
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response: any = await api.register(data);
      setUser(response.user);
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      router.push('/login');
    } catch (error) {
      // Even if logout fails, clear local state
      setUser(null);
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    try {
      const response: any = await api.getCurrentUser();
      setUser(response.user);
    } catch (error) {
      setUser(null);
    }
  };

  // Maintain a single socket connection per authenticated user
  useEffect(() => {
    if (loading) return;
    if (!user) {
      socketClient.disconnect();
      return;
    }

    socketClient.connect('');
    const socket = socketClient.getSocket();
    if (socket) {
      if (socket.connected) {
        socketClient.joinUser(user.id);
      } else {
        const onConnect = () => {
          socketClient.joinUser(user.id);
          socket.off('connect', onConnect);
        };
        socket.on('connect', onConnect);
        return () => {
          socket.off('connect', onConnect);
        };
      }
    }
    return undefined;
  }, [user, loading]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}