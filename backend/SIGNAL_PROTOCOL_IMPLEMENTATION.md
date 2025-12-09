# Signal Protocol Implementation for NeuraChat Backend

## Table of Contents
1. [Overview](#overview)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Signal Protocol Fundamentals](#signal-protocol-fundamentals)
4. [Implementation Strategy](#implementation-strategy)
5. [Required Changes](#required-changes)
6. [Database Schema Updates](#database-schema-updates)
7. [New Services & Components](#new-services--components)
8. [API Endpoints](#api-endpoints)
9. [Integration Points](#integration-points)
10. [Security Considerations](#security-considerations)
11. [Implementation Roadmap](#implementation-roadmap)

---

## Overview

### What is Signal Protocol?
The Signal Protocol (formerly TextSecure Protocol) is an end-to-end encryption protocol that combines the Double Ratchet Algorithm, prekeys, and a triple Diffie-Hellman (3-DH) handshake to provide:

- **End-to-End Encryption (E2EE)**: Only sender and recipient can read messages
- **Forward Secrecy**: Compromised keys don't affect past messages
- **Post-Compromise Security**: Self-healing after key compromise
- **Asynchronous Messaging**: Works without both parties being online

### Why Signal Protocol for NeuraChat?
- ✅ Industry-standard encryption (used by WhatsApp, Signal, Facebook Messenger)
- ✅ Strong security guarantees
- ✅ Works with your existing Socket.IO real-time architecture
- ✅ Transparent to users (encryption happens automatically)

---

## Current Architecture Analysis

### Existing Components

**Backend Structure:**
```
backend/src/
├── config/
│   ├── database.ts         # Supabase client
│   └── multer.ts           # File upload config
├── controllers/
│   ├── messageController.ts    # REST message operations
│   ├── chatController.ts       # Chat management
│   └── ...
├── middleware/
│   └── auth.ts             # JWT authentication
├── services/
│   ├── ai/                 # AI agent services
│   └── Notifications/      # Notification service
└── server.ts               # Express + Socket.IO server
```

**Current Message Flow:**
1. Client emits `send-message` via Socket.IO
2. Server validates chat participation
3. Message saved to `messages` table (plaintext `content`)
4. Message broadcast to all chat participants
5. Notifications sent to offline users

**Database (Supabase):**
- ✅ `encryption_keys` table already exists in schema
- ✅ Users, chats, messages, and participants tables set up
- ⚠️ Messages currently stored in **plaintext**

---

## Signal Protocol Fundamentals

### Key Components

#### 1. **Identity Keys (Long-term)**
- One per user (Ed25519 key pair)
- Represents user's cryptographic identity
- Public key shared with all contacts
- Private key never leaves device (stored securely)

#### 2. **Signed Pre Key**
- Medium-term key (rotated periodically)
- Signed by identity key
- Used for initial key agreement

#### 3. **One-Time Pre Keys (OTP Keys)**
- Short-term keys (single-use)
- Large batch uploaded to server
- Consumed during session initialization
- Provides forward secrecy

#### 4. **Session Keys**
- Ephemeral keys derived from Double Ratchet
- Change with every message
- Provide forward secrecy

### The Double Ratchet Algorithm

```
Alice                                    Bob
  |                                       |
  |------- Initial Key Exchange --------->|
  |       (Identity + PreKeys)            |
  |                                       |
  |------- Encrypted Message 1 --------->|
  |       (Ratchet Forward)               |
  |                                       |
  |<------ Encrypted Response 1 ---------|
  |       (Ratchet Forward)               |
  |                                       |
  |------- Encrypted Message 2 --------->|
  |       (New Keys Generated)            |
```

**Key Features:**
- **Symmetric-key Ratchet**: Hashes keys after each message
- **DH Ratchet**: Generates new DH keys when sender/receiver switch
- **Message Keys**: Unique key for every single message

---

## Implementation Strategy

### Phase 1: Backend Infrastructure (Current Focus)
1. Install Signal Protocol library
2. Create encryption service layer
3. Update database schema (already exists!)
4. Implement key management endpoints
5. Modify message handling to encrypt/decrypt

### Phase 2: Frontend Integration (Future)
1. Generate client-side keys
2. Key exchange during user registration
3. Encrypt messages before sending
4. Decrypt messages after receiving

### Phase 3: Advanced Features (Future)
1. Group chat encryption (Sender Keys)
2. Key rotation and management
3. Safety number verification
4. Session management UI

---

## Required Changes

### 1. **Dependencies**

Install Signal Protocol library:

```bash
npm install @signalapp/libsignal-client
```

Alternative lightweight option:
```bash
npm install libsignal-protocol-typescript
```

### 2. **New Environment Variables**

Add to `.env`:

```env
# Signal Protocol Configuration
SIGNAL_IDENTITY_SEED=<random-32-byte-hex-string>
SIGNAL_KEY_ROTATION_DAYS=30
SIGNAL_ONETIME_PREKEY_BATCH_SIZE=100
```

---

## Database Schema Updates

### ✅ Good News: Schema Already Ready!

Your `schema.txt` already includes the `encryption_keys` table:

```sql
create table public.encryption_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  identity_key text not null,      -- Public Identity Key
  signed_pre_key text not null,    -- Signed Pre Key
  one_time_pre_keys jsonb,         -- Batch of One-Time Pre Keys
  updated_at timestamptz default now()
);
```

### Additional Recommended Tables

#### 1. **Session State Storage**

```sql
-- Stores active encryption sessions between users
create table public.encryption_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  contact_id uuid references public.users(id) on delete cascade not null,
  session_state jsonb not null, -- Serialized Double Ratchet state
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, contact_id)
);

create index idx_encryption_sessions_user on public.encryption_sessions(user_id);
create index idx_encryption_sessions_contact on public.encryption_sessions(contact_id);
```

#### 2. **Pre-Key Management**

```sql
-- Track which one-time pre-keys have been used
create table public.used_prekeys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  prekey_id text not null,
  used_by uuid references public.users(id) not null,
  used_at timestamptz default now(),
  unique(user_id, prekey_id)
);

create index idx_used_prekeys_user on public.used_prekeys(user_id);
```

#### 3. **Key Rotation Audit**

```sql
-- Track key rotation for security auditing
create table public.key_rotation_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  key_type text check (key_type in ('identity', 'signed_pre_key', 'one_time_pre_keys')),
  rotated_at timestamptz default now(),
  reason text -- 'scheduled', 'manual', 'compromised'
);
```

---

## New Services & Components

### 1. **SignalService** (`src/services/encryption/SignalService.ts`)

**Purpose:** Core encryption logic

**Methods:**
```typescript
class SignalService {
  // Key Generation
  static generateIdentityKeyPair(): KeyPair;
  static generateSignedPreKey(identityKey: PrivateKey): SignedPreKey;
  static generateOneTimePreKeys(count: number): OneTimePreKey[];
  
  // Session Management
  static initializeSession(userId: string, contactId: string, preKeyBundle: PreKeyBundle): Session;
  static loadSession(userId: string, contactId: string): Session | null;
  static saveSession(userId: string, contactId: string, session: Session): Promise<void>;
  
  // Encryption/Decryption
  static encryptMessage(session: Session, plaintext: string): CiphertextMessage;
  static decryptMessage(session: Session, ciphertext: CiphertextMessage): string;
  
  // Key Management
  static uploadPreKeys(userId: string, keys: PreKeyBundle): Promise<void>;
  static getPreKeyBundle(userId: string): Promise<PreKeyBundle>;
  static rotateSignedPreKey(userId: string): Promise<void>;
  static replenishOneTimePreKeys(userId: string): Promise<void>;
}
```

### 2. **KeyManager** (`src/services/encryption/KeyManager.ts`)

**Purpose:** Key storage and retrieval

**Methods:**
```typescript
class KeyManager {
  static storeIdentityKey(userId: string, publicKey: string): Promise<void>;
  static getIdentityKey(userId: string): Promise<string>;
  
  static storeSignedPreKey(userId: string, signedPreKey: SignedPreKey): Promise<void>;
  static getSignedPreKey(userId: string): Promise<SignedPreKey>;
  
  static storeOneTimePreKeys(userId: string, preKeys: OneTimePreKey[]): Promise<void>;
  static consumeOneTimePreKey(userId: string): Promise<OneTimePreKey | null>;
  
  static rotateKeys(userId: string, keyType: 'identity' | 'signed_pre_key'): Promise<void>;
}
```

### 3. **SessionManager** (`src/services/encryption/SessionManager.ts`)

**Purpose:** Manage encryption sessions between users

**Methods:**
```typescript
class SessionManager {
  static createSession(userId: string, contactId: string): Promise<Session>;
  static getSession(userId: string, contactId: string): Promise<Session | null>;
  static updateSession(userId: string, contactId: string, state: SessionState): Promise<void>;
  static deleteSession(userId: string, contactId: string): Promise<void>;
  
  static hasActiveSession(userId: string, contactId: string): Promise<boolean>;
  static getActiveSessions(userId: string): Promise<Session[]>;
}
```

### 4. **EncryptionController** (`src/controllers/encryptionController.ts`)

**Purpose:** Handle encryption-related HTTP endpoints

**Endpoints:**
```typescript
// Upload user's public keys (after registration)
POST /api/encryption/keys
Body: { identityKey, signedPreKey, oneTimePreKeys[] }

// Get contact's public key bundle
GET /api/encryption/keys/:userId
Response: { identityKey, signedPreKey, oneTimePreKey }

// Rotate signed pre key
POST /api/encryption/rotate-prekey

// Replenish one-time pre keys
POST /api/encryption/replenish-prekeys
Body: { oneTimePreKeys[] }

// Get encryption status
GET /api/encryption/status
Response: { hasKeys, prekeyCount, lastRotation }
```

---

## API Endpoints

### New Encryption Routes (`src/routes/encryptionRoutes.ts`)

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as encryptionController from '../controllers/encryptionController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Key management
router.post('/keys', encryptionController.uploadKeys);
router.get('/keys/:userId', encryptionController.getPreKeyBundle);
router.post('/rotate-prekey', encryptionController.rotateSignedPreKey);
router.post('/replenish-prekeys', encryptionController.replenishOneTimePreKeys);
router.get('/status', encryptionController.getEncryptionStatus);

// Session management
router.post('/session/:contactId', encryptionController.initializeSession);
router.delete('/session/:contactId', encryptionController.deleteSession);

export default router;
```

**Add to `server.ts`:**
```typescript
import encryptionRoutes from './routes/encryptionRoutes';
app.use('/api/encryption', encryptionRoutes);
```

---

## Integration Points

### 1. **User Registration Flow**

**Current:**
```
POST /api/auth/register → Create user → Return JWT
```

**With Signal Protocol:**
```
POST /api/auth/register → Create user → Return JWT
↓
Frontend generates keys
↓
POST /api/encryption/keys → Store public keys on server
```

**Backend Changes:**
- No changes to registration endpoint
- Add post-registration key upload endpoint
- Store keys in `encryption_keys` table

### 2. **Message Sending (Socket.IO)**

**Current Flow:**
```typescript
socket.on('send-message', async (messageData) => {
  // 1. Verify participant
  // 2. Save plaintext message to DB
  // 3. Broadcast to chat room
});
```

**With Encryption:**
```typescript
socket.on('send-message', async (messageData) => {
  // 1. Verify participant
  // 2. Message content is ALREADY ENCRYPTED by client
  // 3. Save ciphertext to DB (no server-side decryption)
  // 4. Broadcast encrypted message to chat room
  // 5. Clients decrypt locally
});
```

**Key Change:** 
- Server **never decrypts** messages (E2EE principle)
- `content` field stores **ciphertext**, not plaintext
- Encryption/decryption happens **client-side only**

### 3. **Message Retrieval (REST API)**

**Current:**
```typescript
GET /api/messages/:chatId
→ Returns plaintext messages
```

**With Encryption:**
```typescript
GET /api/messages/:chatId
→ Returns encrypted messages (ciphertext)
→ Client decrypts locally
```

### 4. **Group Chat Encryption**

**Challenge:** Signal Protocol is designed for 1-on-1 chats.

**Solution:** Use **Sender Keys** protocol (advanced feature):
1. Group admin generates sender key
2. Sender key shared with all participants (encrypted with pairwise sessions)
3. Messages encrypted once with sender key
4. More efficient than encrypting separately for each participant

**Implementation Note:** Start with 1-on-1 encryption, add group support later.

---

## Security Considerations

### 1. **Server-Side Security**

✅ **DO:**
- Store only **public keys** and encrypted session state
- Validate all key uploads
- Rate-limit key generation endpoints
- Log key rotation events
- Use secure random number generation

❌ **DON'T:**
- Never store user's private identity keys
- Never decrypt messages server-side
- Never log plaintext message content
- Never share keys between users without authorization

### 2. **Key Storage**

**Public Keys:** Store in `encryption_keys` table (Supabase)

**Private Keys:** 
- **Client-side only** (browser LocalStorage/IndexedDB with encryption)
- **Never send to server**
- **User responsibility** (lost keys = lost messages)

### 3. **Metadata Leakage**

**What Server Knows:**
- ✅ Who is messaging whom (sender_id, chat_id)
- ✅ Message timestamps
- ✅ Message count and size
- ❌ Message content (encrypted)
- ❌ File contents (encrypted)

**Mitigation:**
- Implement message padding (fixed size)
- Use timing obfuscation (random delays)
- Consider decoy traffic

### 4. **Authentication**

- Keep existing JWT authentication
- Add endpoint authentication for key operations
- Verify user owns keys before modification

---

## Implementation Roadmap

### ✅ Phase 1: Backend Foundation (1-2 weeks)

**Week 1:**
- [ ] Install Signal Protocol library (`@signalapp/libsignal-client`)
- [ ] Create `services/encryption/` directory structure
- [ ] Implement `SignalService` core logic
- [ ] Add database tables (`encryption_sessions`, `used_prekeys`)
- [ ] Write unit tests for encryption/decryption

**Week 2:**
- [ ] Implement `KeyManager` service
- [ ] Create `encryptionController.ts`
- [ ] Add encryption routes to server
- [ ] Update message handling (store ciphertext)
- [ ] Test key upload/retrieval endpoints

### ⏳ Phase 2: Private Chat E2EE (2 weeks)

**Week 3:**
- [ ] Session initialization logic
- [ ] Integrate with message sending (Socket.IO)
- [ ] Update message retrieval (return ciphertext)
- [ ] Implement key rotation endpoints
- [ ] Add pre-key replenishment cron job

**Week 4:**
- [ ] Frontend key generation (registration)
- [ ] Frontend session establishment
- [ ] Frontend message encryption/decryption
- [ ] End-to-end testing (Alice → Bob)
- [ ] Fix bugs and edge cases

### 🔮 Phase 3: Group Chat & Advanced (3+ weeks)

**Week 5-6:**
- [ ] Implement Sender Keys protocol
- [ ] Group key distribution logic
- [ ] Group member add/remove handling
- [ ] Admin key rotation

**Week 7+:**
- [ ] Safety number verification UI
- [ ] Key fingerprint display
- [ ] Session reset functionality
- [ ] Backup/restore key mechanism
- [ ] Security audit

---

## Code Examples

### Example: SignalService Core (Simplified)

```typescript
// src/services/encryption/SignalService.ts
import * as SignalClient from '@signalapp/libsignal-client';
import { getSupabaseClient } from '../../config/database';

export class SignalService {
  /**
   * Generate a new identity key pair for a user
   */
  static async generateIdentityKeyPair() {
    const keyPair = SignalClient.PrivateKey.generate();
    return {
      privateKey: keyPair.serialize(),
      publicKey: keyPair.getPublicKey().serialize()
    };
  }

  /**
   * Generate signed pre-key
   */
  static async generateSignedPreKey(identityPrivateKey: Buffer, signedPreKeyId: number) {
    const privateKey = SignalClient.PrivateKey.deserialize(identityPrivateKey);
    const keyPair = SignalClient.PrivateKey.generate();
    
    const signature = privateKey.sign(keyPair.getPublicKey().serialize());
    
    return {
      keyId: signedPreKeyId,
      publicKey: keyPair.getPublicKey().serialize(),
      privateKey: keyPair.serialize(),
      signature: signature
    };
  }

  /**
   * Generate batch of one-time pre-keys
   */
  static async generateOneTimePreKeys(startId: number, count: number) {
    const preKeys = [];
    for (let i = 0; i < count; i++) {
      const keyPair = SignalClient.PrivateKey.generate();
      preKeys.push({
        keyId: startId + i,
        publicKey: keyPair.getPublicKey().serialize(),
        privateKey: keyPair.serialize()
      });
    }
    return preKeys;
  }

  /**
   * Upload user's public keys to server
   */
  static async uploadPublicKeys(userId: string, keys: {
    identityKey: Buffer;
    signedPreKey: { keyId: number; publicKey: Buffer; signature: Buffer };
    oneTimePreKeys: { keyId: number; publicKey: Buffer }[];
  }) {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('encryption_keys')
      .upsert({
        user_id: userId,
        identity_key: keys.identityKey.toString('base64'),
        signed_pre_key: JSON.stringify({
          id: keys.signedPreKey.keyId,
          public: keys.signedPreKey.publicKey.toString('base64'),
          signature: keys.signedPreKey.signature.toString('base64')
        }),
        one_time_pre_keys: keys.oneTimePreKeys.map(k => ({
          id: k.keyId,
          public: k.publicKey.toString('base64')
        })),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw new Error(`Failed to upload keys: ${error.message}`);
  }

  /**
   * Get pre-key bundle for establishing session
   */
  static async getPreKeyBundle(userId: string) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) throw new Error('User keys not found');
    
    // Pop one one-time pre-key (FIFO)
    const oneTimePreKeys = data.one_time_pre_keys as any[];
    const oneTimePreKey = oneTimePreKeys.shift();
    
    // Update remaining keys
    await supabase
      .from('encryption_keys')
      .update({ one_time_pre_keys: oneTimePreKeys })
      .eq('user_id', userId);
    
    return {
      identityKey: Buffer.from(data.identity_key, 'base64'),
      signedPreKey: JSON.parse(data.signed_pre_key),
      oneTimePreKey: oneTimePreKey
    };
  }

  /**
   * Encrypt a message
   */
  static async encryptMessage(
    senderIdentityKey: SignalClient.PrivateKey,
    recipientPublicKey: SignalClient.PublicKey,
    message: string
  ): Promise<Buffer> {
    // This is simplified - actual implementation uses session state
    const sessionCipher = SignalClient.SessionCipher.new(
      senderIdentityKey,
      recipientPublicKey
    );
    
    const ciphertext = await sessionCipher.encrypt(Buffer.from(message, 'utf8'));
    return ciphertext.serialize();
  }

  /**
   * Decrypt a message
   */
  static async decryptMessage(
    recipientIdentityKey: SignalClient.PrivateKey,
    senderPublicKey: SignalClient.PublicKey,
    ciphertext: Buffer
  ): Promise<string> {
    const sessionCipher = SignalClient.SessionCipher.new(
      recipientIdentityKey,
      senderPublicKey
    );
    
    const plaintext = await sessionCipher.decrypt(
      SignalClient.CiphertextMessage.deserialize(ciphertext)
    );
    
    return plaintext.toString('utf8');
  }
}
```

### Example: Encryption Controller

```typescript
// src/controllers/encryptionController.ts
import { Request, Response } from 'express';
import { SignalService } from '../services/encryption/SignalService';

type AuthRequest = Request & {
  userId?: string;
};

/**
 * Upload user's public keys
 */
export const uploadKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { identityKey, signedPreKey, oneTimePreKeys } = req.body;

    if (!identityKey || !signedPreKey || !oneTimePreKeys) {
      res.status(400).json({ error: 'Missing required keys' });
      return;
    }

    await SignalService.uploadPublicKeys(userId, {
      identityKey: Buffer.from(identityKey, 'base64'),
      signedPreKey: {
        keyId: signedPreKey.id,
        publicKey: Buffer.from(signedPreKey.public, 'base64'),
        signature: Buffer.from(signedPreKey.signature, 'base64')
      },
      oneTimePreKeys: oneTimePreKeys.map((k: any) => ({
        keyId: k.id,
        publicKey: Buffer.from(k.public, 'base64')
      }))
    });

    res.json({ message: 'Keys uploaded successfully' });
  } catch (error) {
    console.error('Upload keys error:', error);
    res.status(500).json({ error: 'Failed to upload keys' });
  }
};

/**
 * Get pre-key bundle for a user
 */
export const getPreKeyBundle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const bundle = await SignalService.getPreKeyBundle(userId);

    res.json({
      identityKey: bundle.identityKey.toString('base64'),
      signedPreKey: {
        id: bundle.signedPreKey.id,
        public: bundle.signedPreKey.public,
        signature: bundle.signedPreKey.signature
      },
      oneTimePreKey: bundle.oneTimePreKey ? {
        id: bundle.oneTimePreKey.id,
        public: bundle.oneTimePreKey.public
      } : null
    });
  } catch (error) {
    console.error('Get prekey bundle error:', error);
    res.status(500).json({ error: 'Failed to get key bundle' });
  }
};

/**
 * Rotate signed pre-key
 */
export const rotateSignedPreKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    // Implementation here
    res.json({ message: 'Signed pre-key rotated successfully' });
  } catch (error) {
    console.error('Rotate prekey error:', error);
    res.status(500).json({ error: 'Failed to rotate key' });
  }
};
```

### Example: Updated Message Handler (Socket.IO)

```typescript
// In server.ts, update send-message handler
socket.on('send-message', async (messageData) => {
  try {
    const { getSupabaseClient } = await import('./config/database');
    const supabase = getSupabaseClient();
    
    const { chat_id, sender_id, content, type = 'text' } = messageData;
    // NOTE: 'content' is now ENCRYPTED (ciphertext) from client

    // Verify user is a participant
    const { data: participant } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', chat_id)
      .eq('user_id', sender_id)
      .single();

    if (!participant) {
      socket.emit('error', { message: 'You are not a participant of this chat' });
      return;
    }

    // Save ENCRYPTED message to database (no server-side decryption)
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id,
        sender_id,
        content, // ← CIPHERTEXT stored here
        type,
        status: 'sent',
      })
      .select('*, users(id, username, full_name, avatar_url)')
      .single();

    if (error) {
      socket.emit('error', { message: error.message });
      return;
    }

    // Broadcast encrypted message to all users in the chat room
    io.to(`chat:${chat_id}`).emit('new-message', data);
    // Clients will decrypt locally using their private keys

    // Send notifications (content preview will be encrypted too)
    const { NotificationService } = await import('./services/Notifications/NotificationService');
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chat_id)
      .neq('user_id', sender_id);

    if (participants) {
      for (const participant of participants) {
        await NotificationService.createNotification({
          userId: participant.user_id,
          type: 'message',
          title: 'New Message',
          content: '[Encrypted]', // Can't preview encrypted content
        });
      }
    }
    
  } catch (error) {
    console.error('Socket send message error:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
});
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/SignalService.test.ts
import { SignalService } from '../src/services/encryption/SignalService';

describe('SignalService', () => {
  it('should generate identity key pair', async () => {
    const keyPair = await SignalService.generateIdentityKeyPair();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
  });

  it('should encrypt and decrypt message', async () => {
    const aliceKeys = await SignalService.generateIdentityKeyPair();
    const bobKeys = await SignalService.generateIdentityKeyPair();
    
    const message = 'Hello, Bob!';
    const ciphertext = await SignalService.encryptMessage(
      aliceKeys.privateKey,
      bobKeys.publicKey,
      message
    );
    
    const plaintext = await SignalService.decryptMessage(
      bobKeys.privateKey,
      aliceKeys.publicKey,
      ciphertext
    );
    
    expect(plaintext).toBe(message);
  });
});
```

### Integration Tests

```typescript
// Test full E2EE message flow
describe('E2EE Message Flow', () => {
  it('should send encrypted message between users', async () => {
    // 1. Register two users
    // 2. Generate and upload keys
    // 3. Send encrypted message
    // 4. Verify ciphertext in database
    // 5. Decrypt and verify plaintext
  });
});
```

---

## Performance Considerations

### Optimization Strategies

1. **Pre-Key Batching**
   - Generate 100 one-time pre-keys at once
   - Replenish when count drops below 20

2. **Session Caching**
   - Cache active sessions in memory (Redis)
   - Reduce database lookups

3. **Async Key Generation**
   - Generate keys in background worker
   - Don't block user registration

4. **Message Padding**
   - Pad messages to fixed sizes (e.g., 256B, 512B, 1KB)
   - Prevents size-based analysis

---

## Troubleshooting

### Common Issues

**Issue:** "User keys not found"
- **Cause:** Keys not uploaded after registration
- **Fix:** Ensure frontend calls `/api/encryption/keys` post-registration

**Issue:** "Session initialization failed"
- **Cause:** Missing one-time pre-key
- **Fix:** Replenish pre-keys via `/api/encryption/replenish-prekeys`

**Issue:** "Decryption failed"
- **Cause:** Session out of sync or corrupted
- **Fix:** Reset session and re-initialize

---

## References

- [Signal Protocol Specification](https://signal.org/docs/)
- [libsignal-client Documentation](https://github.com/signalapp/libsignal)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)

---

## Next Steps

1. **Review this document** and ask questions
2. **Install dependencies** (`@signalapp/libsignal-client`)
3. **Create database tables** (encryption_sessions, etc.)
4. **Start with SignalService** (key generation first)
5. **Test key upload/retrieval** endpoints
6. **Gradually integrate** into message flow

**Questions to Consider:**
- Do you want to start with 1-on-1 chats only or include group chats?
- Should we implement key rotation immediately or in Phase 2?
- Do you want to store encrypted message backups?
- Should we add a "safety number" verification feature?

Let me know which phase you'd like to tackle first! 🚀
