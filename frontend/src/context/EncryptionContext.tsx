'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import signalService, { 
  KeyPair, 
  SignedPreKey, 
  OneTimePreKey, 
  PreKeyBundle, 
  SessionState,
  EncryptedMessage 
} from '@/lib/encryption/SignalService';
import api from '@/lib/api';
import { useAuth } from './AuthContext';

interface EncryptionContextType {
  // State
  isInitialized: boolean;
  hasKeys: boolean;
  preKeyCount: number;
  sessions: Record<string, SessionState>;
  
  // Key Management
  initializeKeys: () => Promise<void>;
  uploadKeysToServer: () => Promise<void>;
  replenishPreKeys: () => Promise<void>;
  
  // Session Management
  establishSession: (contactId: string) => Promise<void>;
  hasSession: (contactId: string) => boolean;
  
  // Encryption/Decryption
  encryptMessage: (plaintext: string, contactId: string) => Promise<string>;
  decryptMessage: (encryptedContent: string, contactId: string) => Promise<string>;
  
  // Utils
  clearKeys: () => void;
  getEncryptionStatus: () => Promise<{ hasKeys: boolean; prekeyCount: number; needsReplenishment: boolean } | null>;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

const PREKEY_THRESHOLD = 20;
const PREKEY_BATCH_SIZE = 100;

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [preKeyCount, setPreKeyCount] = useState(0);
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});

  // Check for existing keys on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      const existingKeys = signalService.hasKeys();
      setHasKeys(existingKeys);
      setPreKeyCount(signalService.getPreKeyCount());
      setSessions(signalService.getSessions());
      setIsInitialized(existingKeys);
    }
  }, [isAuthenticated, user]);

  // Auto-replenish pre-keys when low
  useEffect(() => {
    if (isInitialized && preKeyCount < PREKEY_THRESHOLD) {
      replenishPreKeys();
    }
  }, [isInitialized, preKeyCount]);

  /**
   * Initialize encryption keys for a new user
   */
  const initializeKeys = useCallback(async (): Promise<void> => {
    try {
      console.log('🔐 Initializing encryption keys...');

      // Generate identity key pair
      const identityKeyPair = await signalService.generateIdentityKeyPair();
      signalService.storeIdentityKey(identityKeyPair);
      console.log('✅ Identity key pair generated');

      // Generate signed pre-key
      const signedPreKeyId = Date.now();
      const signedPreKey = await signalService.generateSignedPreKey(
        identityKeyPair.privateKey,
        signedPreKeyId
      );
      signalService.storeSignedPreKey(signedPreKey);
      console.log('✅ Signed pre-key generated');

      // Generate one-time pre-keys
      const oneTimePreKeys = await signalService.generateOneTimePreKeys(1, PREKEY_BATCH_SIZE);
      signalService.storeOneTimePreKeys(oneTimePreKeys);
      console.log(`✅ Generated ${oneTimePreKeys.length} one-time pre-keys`);

      setHasKeys(true);
      setPreKeyCount(oneTimePreKeys.length);
      setIsInitialized(true);

      console.log('🔐 Encryption keys initialized successfully');
    } catch (error) {
      console.error('Failed to initialize encryption keys:', error);
      throw error;
    }
  }, []);

  /**
   * Upload public keys to the server
   */
  const uploadKeysToServer = useCallback(async (): Promise<void> => {
    try {
      const identityKey = signalService.getIdentityKey();
      const signedPreKey = signalService.getSignedPreKey();
      const oneTimePreKeys = signalService.getOneTimePreKeys();

      if (!identityKey || !signedPreKey) {
        throw new Error('Keys not initialized');
      }

      await api.uploadEncryptionKeys({
        identityKey: identityKey.publicKey,
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

      console.log('✅ Keys uploaded to server');
    } catch (error) {
      console.error('Failed to upload keys:', error);
      throw error;
    }
  }, []);

  /**
   * Replenish one-time pre-keys when running low
   */
  const replenishPreKeys = useCallback(async (): Promise<void> => {
    try {
      const existingKeys = signalService.getOneTimePreKeys();
      const highestId = existingKeys.length > 0 
        ? Math.max(...existingKeys.map(k => k.id)) 
        : 0;

      const newPreKeys = await signalService.generateOneTimePreKeys(
        highestId + 1,
        PREKEY_BATCH_SIZE
      );

      // Store locally
      signalService.storeOneTimePreKeys([...existingKeys, ...newPreKeys]);

      // Upload to server
      await api.replenishPreKeys(
        newPreKeys.map(k => ({
          id: k.id,
          public: k.publicKey,
        }))
      );

      setPreKeyCount(signalService.getPreKeyCount());
      console.log(`✅ Replenished ${newPreKeys.length} one-time pre-keys`);
    } catch (error) {
      console.error('Failed to replenish pre-keys:', error);
      throw error;
    }
  }, []);

  /**
   * Establish encrypted session with a contact
   */
  const establishSession = useCallback(async (contactId: string): Promise<void> => {
    try {
      // Check if session already exists
      const existingSession = signalService.getSession(contactId);
      if (existingSession) {
        console.log(`Session already exists with ${contactId}`);
        return;
      }

      // Get contact's pre-key bundle from server
      const preKeyBundle = await api.getPreKeyBundle(contactId) as PreKeyBundle;

      // Get my identity key
      const myIdentityKey = signalService.getIdentityKey();
      if (!myIdentityKey) {
        throw new Error('Identity key not found');
      }

      // Establish session
      const session = await signalService.establishSession(
        myIdentityKey.privateKey,
        myIdentityKey.publicKey,
        preKeyBundle
      );

      session.contactId = contactId;

      // Store session
      signalService.storeSession(contactId, session);
      setSessions(prev => ({ ...prev, [contactId]: session }));

      // Notify server about session initialization
      await api.initializeSession(contactId);

      console.log(`✅ Session established with ${contactId}`);
    } catch (error) {
      console.error(`Failed to establish session with ${contactId}:`, error);
      throw error;
    }
  }, []);

  /**
   * Check if a session exists with a contact
   */
  const hasSession = useCallback((contactId: string): boolean => {
    return !!signalService.getSession(contactId);
  }, []);

  /**
   * Encrypt a message for a contact
   */
  const encryptMessage = useCallback(async (plaintext: string, contactId: string): Promise<string> => {
    try {
      // Ensure session exists
      let session = signalService.getSession(contactId);
      if (!session) {
        await establishSession(contactId);
        session = signalService.getSession(contactId);
      }

      if (!session) {
        throw new Error('Failed to establish session');
      }

      // Encrypt using shared secret (simplified E2EE)
      const encrypted = await signalService.encryptWithSharedSecret(
        plaintext,
        session.sharedSecret
      );

      // Update session message counter
      session.messageNumber++;
      signalService.storeSession(contactId, session);

      // Return as JSON string for storage
      return JSON.stringify(encrypted);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }, [establishSession]);

  /**
   * Decrypt a message from a contact
   */
  const decryptMessage = useCallback(async (encryptedContent: string, contactId: string): Promise<string> => {
    try {
      const session = signalService.getSession(contactId);
      if (!session) {
        console.warn(`No session found for ${contactId}, returning encrypted content`);
        return encryptedContent;
      }

      // Parse encrypted message
      let encryptedMessage: EncryptedMessage;
      try {
        encryptedMessage = JSON.parse(encryptedContent);
      } catch {
        // Not encrypted or invalid format, return as-is
        return encryptedContent;
      }

      // Check if it's a valid encrypted message
      if (!encryptedMessage.ciphertext || !encryptedMessage.iv) {
        return encryptedContent;
      }

      // Decrypt using shared secret
      const plaintext = await signalService.decryptWithSharedSecret(
        encryptedMessage,
        session.sharedSecret
      );

      return plaintext;
    } catch (error) {
      console.error('Decryption failed:', error);
      // Return encrypted content on failure (graceful degradation)
      return encryptedContent;
    }
  }, []);

  /**
   * Clear all encryption keys (on logout)
   */
  const clearKeys = useCallback((): void => {
    signalService.clearAllKeys();
    setHasKeys(false);
    setPreKeyCount(0);
    setSessions({});
    setIsInitialized(false);
    console.log('🔐 Encryption keys cleared');
  }, []);

  /**
   * Get encryption status from server
   */
  const getEncryptionStatus = useCallback(async (): Promise<{
    hasKeys: boolean;
    prekeyCount: number;
    needsReplenishment: boolean;
  } | null> => {
    try {
      return await api.getEncryptionStatus();
    } catch (error) {
      console.error('Failed to get encryption status:', error);
      return null;
    }
  }, []);

  return (
    <EncryptionContext.Provider
      value={{
        isInitialized,
        hasKeys,
        preKeyCount,
        sessions,
        initializeKeys,
        uploadKeysToServer,
        replenishPreKeys,
        establishSession,
        hasSession,
        encryptMessage,
        decryptMessage,
        clearKeys,
        getEncryptionStatus,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}
