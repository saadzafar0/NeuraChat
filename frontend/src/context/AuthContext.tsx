'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import signalService from '@/lib/encryption/SignalService';

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
  encryptionReady: boolean;
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

const PREKEY_BATCH_SIZE = 100;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const router = useRouter();

  const isAuthenticated = !!user;

  /**
   * Initialize encryption keys for a user
   */
  const initializeEncryption = async (): Promise<void> => {
    try {
      // Check if keys already exist locally
      if (signalService.hasKeys()) {
        console.log('🔐 Encryption keys already exist locally');
        setEncryptionReady(true);
        return;
      }

      console.log('🔐 Generating new encryption keys...');

      // Generate identity key pair
      const identityKeyPair = await signalService.generateIdentityKeyPair();
      signalService.storeIdentityKey(identityKeyPair);

      // Generate signed pre-key
      const signedPreKeyId = Date.now();
      const signedPreKey = await signalService.generateSignedPreKey(
        identityKeyPair.privateKey,
        signedPreKeyId
      );
      signalService.storeSignedPreKey(signedPreKey);

      // Generate one-time pre-keys
      const oneTimePreKeys = await signalService.generateOneTimePreKeys(1, PREKEY_BATCH_SIZE);
      signalService.storeOneTimePreKeys(oneTimePreKeys);

      // Upload public keys to server
      await api.uploadEncryptionKeys({
        identityKey: identityKeyPair.publicKey,
        signedPreKey: {
          id: signedPreKey.id,
          public: signedPreKey.publicKey,
          signature: signedPreKey.signature,
        },
        oneTimePreKeys: oneTimePreKeys.map(k => ({
          id: k.id,
          public: k.publicKey,
        })),
      });

      console.log('✅ Encryption keys generated and uploaded');
      setEncryptionReady(true);
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      // Don't block auth flow on encryption failure
      setEncryptionReady(false);
    }
  };

  // Fetch current user on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response: any = await api.getCurrentUser();
        setUser(response.user);
        
        // Initialize encryption for existing user
        if (response.user) {
          await initializeEncryption();
        }
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
      
      // Initialize encryption after login
      await initializeEncryption();
      
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response: any = await api.register(data);
      setUser(response.user);
      
      // Initialize encryption after registration (fresh keys)
      signalService.clearAllKeys(); // Clear any existing keys
      await initializeEncryption();
      
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      // Clear encryption keys on logout
      signalService.clearAllKeys();
      setEncryptionReady(false);
      setUser(null);
      router.push('/login');
    } catch (error) {
      // Even if logout fails, clear local state
      signalService.clearAllKeys();
      setEncryptionReady(false);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        encryptionReady,
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