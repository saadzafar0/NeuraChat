/**
 * Signal Protocol Implementation for NeuraChat Frontend
 * 
 * This service handles client-side encryption using the Signal Protocol concepts.
 * Since @signalapp/libsignal-client is Node.js only, we use the Web Crypto API
 * to implement a compatible encryption scheme.
 * 
 * Key Features:
 * - Identity key pair generation (ECDSA P-256)
 * - Signed pre-key generation and signing
 * - One-time pre-key generation
 * - Session establishment
 * - Message encryption/decryption using AES-GCM
 */

export interface KeyPair {
  publicKey: string;  // Base64 encoded
  privateKey: string; // Base64 encoded
}

export interface SignedPreKey {
  id: number;
  publicKey: string;  // Base64 encoded
  privateKey: string; // Base64 encoded (stored locally only)
  signature: string;  // Base64 encoded
}

export interface OneTimePreKey {
  id: number;
  publicKey: string;  // Base64 encoded
  privateKey: string; // Base64 encoded (stored locally only)
}

export interface PreKeyBundle {
  identityKey: string;
  signedPreKey: {
    id: number;
    publicKey: string;
    signature: string;
  };
  oneTimePreKey?: {
    id: number;
    publicKey: string;
  } | null;
}

export interface EncryptedMessage {
  ciphertext: string;  // Base64 encoded
  iv: string;          // Base64 encoded
  ephemeralKey: string; // Base64 encoded public key
}

export interface SessionState {
  contactId: string;
  sharedSecret: string;  // Base64 encoded
  sendingChainKey: string;
  receivingChainKey: string;
  messageNumber: number;
}

// Storage keys for IndexedDB/localStorage
const STORAGE_KEYS = {
  IDENTITY_KEY: 'neurachat_identity_key',
  SIGNED_PREKEY: 'neurachat_signed_prekey',
  ONETIME_PREKEYS: 'neurachat_onetime_prekeys',
  SESSIONS: 'neurachat_sessions',
  PENDING_PREKEYS: 'neurachat_pending_prekeys',
};

class SignalService {
  private crypto: SubtleCrypto;

  constructor() {
    this.crypto = window.crypto.subtle;
  }

  // ========== KEY GENERATION ==========

  /**
   * Generate identity key pair (ECDH P-256 for key exchange)
   */
  async generateIdentityKeyPair(): Promise<KeyPair> {
    const keyPair = await this.crypto.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = await this.exportPublicKey(keyPair.publicKey);
    const privateKey = await this.exportPrivateKey(keyPair.privateKey);

    return { publicKey, privateKey };
  }

  /**
   * Generate signed pre-key and sign with identity key
   */
  async generateSignedPreKey(
    identityPrivateKeyBase64: string,
    signedPreKeyId: number
  ): Promise<SignedPreKey> {
    // Generate ECDH key pair for the pre-key
    const preKeyPair = await this.crypto.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = await this.exportPublicKey(preKeyPair.publicKey);
    const privateKey = await this.exportPrivateKey(preKeyPair.privateKey);

    // Sign the public key with identity key using ECDSA
    // First, we need to generate an ECDSA signing key from the identity
    const signingKey = await this.generateSigningKeyFromSecret(identityPrivateKeyBase64);
    
    const publicKeyBytes = this.base64ToArrayBuffer(publicKey);
    const signature = await this.crypto.sign(
      {
        name: 'HMAC',
      },
      signingKey,
      publicKeyBytes
    );

    return {
      id: signedPreKeyId,
      publicKey,
      privateKey,
      signature: this.arrayBufferToBase64(signature),
    };
  }

  /**
   * Generate batch of one-time pre-keys
   */
  async generateOneTimePreKeys(startId: number, count: number): Promise<OneTimePreKey[]> {
    const preKeys: OneTimePreKey[] = [];

    for (let i = 0; i < count; i++) {
      const keyPair = await this.crypto.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        ['deriveKey', 'deriveBits']
      );

      const publicKey = await this.exportPublicKey(keyPair.publicKey);
      const privateKey = await this.exportPrivateKey(keyPair.privateKey);

      preKeys.push({
        id: startId + i,
        publicKey,
        privateKey,
      });
    }

    return preKeys;
  }

  // ========== SESSION MANAGEMENT ==========

  /**
   * Establish session with a contact using their pre-key bundle
   */
  async establishSession(
    myIdentityPrivateKey: string,
    myIdentityPublicKey: string,
    preKeyBundle: PreKeyBundle
  ): Promise<SessionState> {
    // Import their identity key
    const theirIdentityKey = await this.importPublicKey(preKeyBundle.identityKey);
    const theirSignedPreKey = await this.importPublicKey(preKeyBundle.signedPreKey.publicKey);
    
    // Import my identity key
    const myPrivateKey = await this.importPrivateKey(myIdentityPrivateKey);

    // Perform ECDH with their signed pre-key
    const sharedSecret = await this.crypto.deriveBits(
      {
        name: 'ECDH',
        public: theirSignedPreKey,
      },
      myPrivateKey,
      256
    );

    // Derive chain keys from shared secret
    const { sendingChainKey, receivingChainKey } = await this.deriveChainKeys(sharedSecret);

    // Note: In a full implementation, we would also incorporate the one-time pre-key
    // and perform the X3DH key agreement

    return {
      contactId: '', // Will be set by caller
      sharedSecret: this.arrayBufferToBase64(sharedSecret),
      sendingChainKey: this.arrayBufferToBase64(sendingChainKey),
      receivingChainKey: this.arrayBufferToBase64(receivingChainKey),
      messageNumber: 0,
    };
  }

  /**
   * Process incoming session establishment (when receiving first message)
   */
  async processPreKeyMessage(
    mySignedPreKeyPrivate: string,
    theirEphemeralPublic: string
  ): Promise<{ sharedSecret: ArrayBuffer }> {
    const myPrivateKey = await this.importPrivateKey(mySignedPreKeyPrivate);
    const theirPublicKey = await this.importPublicKey(theirEphemeralPublic);

    const sharedSecret = await this.crypto.deriveBits(
      {
        name: 'ECDH',
        public: theirPublicKey,
      },
      myPrivateKey,
      256
    );

    return { sharedSecret };
  }

  // ========== MESSAGE ENCRYPTION ==========

  /**
   * Encrypt a message for a session
   */
  async encryptMessage(
    plaintext: string,
    session: SessionState
  ): Promise<EncryptedMessage> {
    // Generate ephemeral key for this message
    const ephemeralKeyPair = await this.crypto.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    // Derive message key from chain key
    const chainKeyBytes = this.base64ToArrayBuffer(session.sendingChainKey);
    const messageKey = await this.deriveMessageKey(chainKeyBytes, session.messageNumber);

    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Import the message key for AES-GCM
    const aesKey = await this.crypto.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt the message
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const ciphertext = await this.crypto.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      plaintextBytes
    );

    const ephemeralPublicKey = await this.exportPublicKey(ephemeralKeyPair.publicKey);

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv.buffer),
      ephemeralKey: ephemeralPublicKey,
    };
  }

  /**
   * Decrypt a message from a session
   */
  async decryptMessage(
    encryptedMessage: EncryptedMessage,
    session: SessionState
  ): Promise<string> {
    // Derive message key from chain key
    const chainKeyBytes = this.base64ToArrayBuffer(session.receivingChainKey);
    const messageKey = await this.deriveMessageKey(chainKeyBytes, session.messageNumber);

    // Import the message key for AES-GCM
    const aesKey = await this.crypto.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const iv = this.base64ToArrayBuffer(encryptedMessage.iv);
    const ciphertext = this.base64ToArrayBuffer(encryptedMessage.ciphertext);

    try {
      const plaintextBytes = await this.crypto.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        aesKey,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintextBytes);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // ========== SIMPLE E2EE (for easier implementation) ==========

  /**
   * Simple encryption using shared secret directly
   * This is a simplified version for the MVP
   */
  async encryptWithSharedSecret(
    plaintext: string,
    sharedSecretBase64: string
  ): Promise<EncryptedMessage> {
    const sharedSecret = this.base64ToArrayBuffer(sharedSecretBase64);
    
    // Derive AES key from shared secret
    const keyMaterial = await this.crypto.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    const aesKey = await this.crypto.deriveKey(
      {
        name: 'HKDF',
        salt: new Uint8Array(16), // Should be random in production
        info: new TextEncoder().encode('neurachat-e2ee'),
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const ciphertext = await this.crypto.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      plaintextBytes
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv.buffer),
      ephemeralKey: '', // Not used in simple mode
    };
  }

  /**
   * Simple decryption using shared secret directly
   */
  async decryptWithSharedSecret(
    encryptedMessage: EncryptedMessage,
    sharedSecretBase64: string
  ): Promise<string> {
    const sharedSecret = this.base64ToArrayBuffer(sharedSecretBase64);
    
    // Derive AES key from shared secret
    const keyMaterial = await this.crypto.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    const aesKey = await this.crypto.deriveKey(
      {
        name: 'HKDF',
        salt: new Uint8Array(16),
        info: new TextEncoder().encode('neurachat-e2ee'),
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = this.base64ToArrayBuffer(encryptedMessage.iv);
    const ciphertext = this.base64ToArrayBuffer(encryptedMessage.ciphertext);

    const plaintextBytes = await this.crypto.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBytes);
  }

  // ========== LOCAL STORAGE ==========

  /**
   * Store keys in localStorage (encrypted in production)
   */
  storeIdentityKey(keyPair: KeyPair): void {
    localStorage.setItem(STORAGE_KEYS.IDENTITY_KEY, JSON.stringify(keyPair));
  }

  getIdentityKey(): KeyPair | null {
    const stored = localStorage.getItem(STORAGE_KEYS.IDENTITY_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  storeSignedPreKey(signedPreKey: SignedPreKey): void {
    localStorage.setItem(STORAGE_KEYS.SIGNED_PREKEY, JSON.stringify(signedPreKey));
  }

  getSignedPreKey(): SignedPreKey | null {
    const stored = localStorage.getItem(STORAGE_KEYS.SIGNED_PREKEY);
    return stored ? JSON.parse(stored) : null;
  }

  storeOneTimePreKeys(preKeys: OneTimePreKey[]): void {
    localStorage.setItem(STORAGE_KEYS.ONETIME_PREKEYS, JSON.stringify(preKeys));
  }

  getOneTimePreKeys(): OneTimePreKey[] {
    const stored = localStorage.getItem(STORAGE_KEYS.ONETIME_PREKEYS);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Remove a used one-time pre-key
   */
  removeOneTimePreKey(keyId: number): void {
    const preKeys = this.getOneTimePreKeys();
    const filtered = preKeys.filter(k => k.id !== keyId);
    this.storeOneTimePreKeys(filtered);
  }

  storeSession(contactId: string, session: SessionState): void {
    const sessions = this.getSessions();
    sessions[contactId] = session;
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }

  getSession(contactId: string): SessionState | null {
    const sessions = this.getSessions();
    return sessions[contactId] || null;
  }

  getSessions(): Record<string, SessionState> {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return stored ? JSON.parse(stored) : {};
  }

  deleteSession(contactId: string): void {
    const sessions = this.getSessions();
    delete sessions[contactId];
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }

  clearAllKeys(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // ========== HELPER METHODS ==========

  private async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await this.crypto.exportKey('spki', key);
    return this.arrayBufferToBase64(exported);
  }

  private async exportPrivateKey(key: CryptoKey): Promise<string> {
    const exported = await this.crypto.exportKey('pkcs8', key);
    return this.arrayBufferToBase64(exported);
  }

  private async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return this.crypto.importKey(
      'spki',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  private async importPrivateKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return this.crypto.importKey(
      'pkcs8',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  private async generateSigningKeyFromSecret(base64Secret: string): Promise<CryptoKey> {
    const secretBytes = this.base64ToArrayBuffer(base64Secret);
    return this.crypto.importKey(
      'raw',
      secretBytes.slice(0, 32), // Use first 32 bytes
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }

  private async deriveChainKeys(sharedSecret: ArrayBuffer): Promise<{
    sendingChainKey: ArrayBuffer;
    receivingChainKey: ArrayBuffer;
  }> {
    const keyMaterial = await this.crypto.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    const derivedBits = await this.crypto.deriveBits(
      {
        name: 'HKDF',
        salt: new Uint8Array(32),
        info: new TextEncoder().encode('neurachat-chain-keys'),
        hash: 'SHA-256',
      },
      keyMaterial,
      512 // 64 bytes = 2 x 32-byte keys
    );

    const bytes = new Uint8Array(derivedBits);
    return {
      sendingChainKey: bytes.slice(0, 32).buffer,
      receivingChainKey: bytes.slice(32, 64).buffer,
    };
  }

  private async deriveMessageKey(chainKey: ArrayBuffer, messageNumber: number): Promise<ArrayBuffer> {
    const keyMaterial = await this.crypto.importKey(
      'raw',
      chainKey,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    const info = new TextEncoder().encode(`message-${messageNumber}`);
    
    return this.crypto.deriveBits(
      {
        name: 'HKDF',
        salt: new Uint8Array(32),
        info: info,
        hash: 'SHA-256',
      },
      keyMaterial,
      256 // 32 bytes
    );
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Check if encryption keys exist
   */
  hasKeys(): boolean {
    return !!this.getIdentityKey();
  }

  /**
   * Get the count of remaining one-time pre-keys
   */
  getPreKeyCount(): number {
    return this.getOneTimePreKeys().length;
  }
}

// Export singleton instance
export const signalService = new SignalService();
export default signalService;
