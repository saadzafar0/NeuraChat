/**
 * NeuraChat Encryption Module
 * 
 * This module provides Signal Protocol-inspired end-to-end encryption
 * for secure messaging in NeuraChat.
 * 
 * @module encryption
 */

export { default as signalService, SignalService } from './SignalService';
export type { 
  KeyPair, 
  SignedPreKey, 
  OneTimePreKey, 
  PreKeyBundle, 
  EncryptedMessage, 
  SessionState 
} from './SignalService';

export { 
  useMessageEncryption, 
  useEncryptionStatus, 
  useSessions 
} from './hooks';
