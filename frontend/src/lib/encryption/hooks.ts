/**
 * Encryption Hooks for NeuraChat
 * 
 * This file provides React hooks for easily integrating
 * Signal Protocol encryption into chat components.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import signalService, { 
  SessionState, 
  EncryptedMessage,
  PreKeyBundle 
} from '@/lib/encryption/SignalService';
import api from '@/lib/api';

interface UseMessageEncryptionReturn {
  encryptMessage: (plaintext: string, recipientId: string) => Promise<string>;
  decryptMessage: (encryptedContent: string, senderId: string) => Promise<string>;
  isEncrypted: (content: string) => boolean;
  establishSession: (contactId: string) => Promise<void>;
  hasSession: (contactId: string) => boolean;
}

/**
 * Hook for message encryption/decryption
 */
export function useMessageEncryption(): UseMessageEncryptionReturn {
  /**
   * Check if content is encrypted
   */
  const isEncrypted = useCallback((content: string): boolean => {
    if (!content) return false;
    try {
      const parsed = JSON.parse(content);
      return !!(parsed.ciphertext && parsed.iv);
    } catch {
      return false;
    }
  }, []);

  /**
   * Establish session with a contact
   */
  const establishSession = useCallback(async (contactId: string): Promise<void> => {
    // Check if session already exists
    const existingSession = signalService.getSession(contactId);
    if (existingSession) {
      return;
    }

    // Get my identity key
    const myIdentityKey = signalService.getIdentityKey();
    if (!myIdentityKey) {
      throw new Error('Encryption keys not initialized');
    }

    try {
      // Get contact's pre-key bundle from server
      const preKeyBundle = await api.getPreKeyBundle(contactId) as PreKeyBundle;

      // Establish session
      const session = await signalService.establishSession(
        myIdentityKey.privateKey,
        myIdentityKey.publicKey,
        preKeyBundle
      );

      session.contactId = contactId;

      // Store session
      signalService.storeSession(contactId, session);

      // Notify server
      try {
        await api.initializeSession(contactId);
      } catch (e) {
        // Non-critical error
        console.warn('Failed to notify server about session:', e);
      }

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
   * Encrypt a message for a recipient
   */
  const encryptMessage = useCallback(async (
    plaintext: string,
    recipientId: string
  ): Promise<string> => {
    // Ensure session exists
    if (!hasSession(recipientId)) {
      await establishSession(recipientId);
    }

    const session = signalService.getSession(recipientId);
    if (!session) {
      console.warn('No session available, sending unencrypted');
      return plaintext;
    }

    try {
      // Encrypt using shared secret
      const encrypted = await signalService.encryptWithSharedSecret(
        plaintext,
        session.sharedSecret
      );

      // Update session message counter
      session.messageNumber++;
      signalService.storeSession(recipientId, session);

      return JSON.stringify(encrypted);
    } catch (error) {
      console.error('Encryption failed:', error);
      // Fallback to unencrypted on failure
      return plaintext;
    }
  }, [hasSession, establishSession]);

  /**
   * Decrypt a message from a sender
   */
  const decryptMessage = useCallback(async (
    encryptedContent: string,
    senderId: string
  ): Promise<string> => {
    // Check if content is actually encrypted
    if (!isEncrypted(encryptedContent)) {
      return encryptedContent;
    }

    const session = signalService.getSession(senderId);
    if (!session) {
      console.warn(`No session for ${senderId}, cannot decrypt`);
      return '[Encrypted message - session not found]';
    }

    try {
      const encryptedMessage: EncryptedMessage = JSON.parse(encryptedContent);

      const plaintext = await signalService.decryptWithSharedSecret(
        encryptedMessage,
        session.sharedSecret
      );

      return plaintext;
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - decryption failed]';
    }
  }, [isEncrypted]);

  return {
    encryptMessage,
    decryptMessage,
    isEncrypted,
    establishSession,
    hasSession,
  };
}

interface UseEncryptionStatusReturn {
  hasLocalKeys: boolean;
  preKeyCount: number;
  needsReplenishment: boolean;
  serverStatus: {
    hasKeys: boolean;
    prekeyCount: number;
    needsReplenishment: boolean;
  } | null;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook for monitoring encryption status
 */
export function useEncryptionStatus(): UseEncryptionStatusReturn {
  const [hasLocalKeys, setHasLocalKeys] = useState(false);
  const [preKeyCount, setPreKeyCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<{
    hasKeys: boolean;
    prekeyCount: number;
    needsReplenishment: boolean;
  } | null>(null);

  const PREKEY_THRESHOLD = 20;

  const refreshStatus = useCallback(async () => {
    // Check local keys
    const hasKeys = signalService.hasKeys();
    setHasLocalKeys(hasKeys);
    
    const count = signalService.getPreKeyCount();
    setPreKeyCount(count);

    // Check server status
    try {
      const status = await api.getEncryptionStatus();
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to get server encryption status:', error);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    hasLocalKeys,
    preKeyCount,
    needsReplenishment: preKeyCount < PREKEY_THRESHOLD,
    serverStatus,
    refreshStatus,
  };
}

/**
 * Hook for managing sessions
 */
export function useSessions() {
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});

  useEffect(() => {
    setSessions(signalService.getSessions());
  }, []);

  const refreshSessions = useCallback(() => {
    setSessions(signalService.getSessions());
  }, []);

  const deleteSession = useCallback((contactId: string) => {
    signalService.deleteSession(contactId);
    refreshSessions();
  }, [refreshSessions]);

  return {
    sessions,
    refreshSessions,
    deleteSession,
    sessionCount: Object.keys(sessions).length,
  };
}
