# NeuraChat Frontend Encryption

## Signal Protocol Implementation

This module provides end-to-end encryption (E2EE) for NeuraChat using concepts from the Signal Protocol, implemented with the Web Crypto API for browser compatibility.

## Features

- **Identity Key Pair Generation**: ECDH P-256 key pairs for user identity
- **Signed Pre-Keys**: Medium-term keys signed by identity key
- **One-Time Pre-Keys**: Ephemeral keys for forward secrecy
- **Session Management**: Encrypted sessions between users
- **AES-GCM Encryption**: 256-bit symmetric encryption for messages

## Architecture

```
frontend/src/lib/encryption/
├── SignalService.ts    # Core encryption service
├── hooks.ts            # React hooks for components
└── index.ts            # Module exports
```

## Usage

### Automatic Key Generation

Keys are automatically generated when a user registers or logs in:

```typescript
// In AuthContext.tsx - happens automatically
await initializeEncryption();
```

### Encrypting Messages

```typescript
import { useMessageEncryption } from '@/lib/encryption/hooks';

function ChatComponent() {
  const { encryptMessage, decryptMessage, isEncrypted } = useMessageEncryption();
  
  // Encrypt before sending
  const encrypted = await encryptMessage(plaintext, recipientId);
  
  // Decrypt received messages
  const decrypted = await decryptMessage(encrypted, senderId);
  
  // Check if message is encrypted
  const encrypted = isEncrypted(messageContent);
}
```

### Manual Key Management

```typescript
import signalService from '@/lib/encryption/SignalService';

// Generate keys
const identityKey = await signalService.generateIdentityKeyPair();
const signedPreKey = await signalService.generateSignedPreKey(identityKey.privateKey, 1);
const oneTimePreKeys = await signalService.generateOneTimePreKeys(1, 100);

// Store keys locally
signalService.storeIdentityKey(identityKey);
signalService.storeSignedPreKey(signedPreKey);
signalService.storeOneTimePreKeys(oneTimePreKeys);

// Check for existing keys
const hasKeys = signalService.hasKeys();
const preKeyCount = signalService.getPreKeyCount();
```

## Encryption Flow

### 1. Key Upload (Registration/Login)
```
User registers/logs in
    ↓
Generate identity key pair (ECDH P-256)
    ↓
Generate signed pre-key (signed with identity key)
    ↓
Generate 100 one-time pre-keys
    ↓
Upload public keys to server
    ↓
Store private keys in localStorage
```

### 2. Session Establishment
```
Alice wants to message Bob
    ↓
Fetch Bob's pre-key bundle from server
    ↓
Perform ECDH key agreement
    ↓
Derive shared secret
    ↓
Store session locally
```

### 3. Message Encryption
```
Alice types message
    ↓
Get session with Bob
    ↓
Derive AES-256 key from shared secret (HKDF)
    ↓
Encrypt with AES-GCM (random IV)
    ↓
Send encrypted message to server
```

### 4. Message Decryption
```
Bob receives encrypted message
    ↓
Get session with Alice
    ↓
Derive AES-256 key from shared secret
    ↓
Decrypt with AES-GCM
    ↓
Display plaintext
```

## API Endpoints

The frontend communicates with these backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/encryption/keys` | POST | Upload public keys |
| `/api/encryption/keys/:userId` | GET | Get user's pre-key bundle |
| `/api/encryption/rotate-prekey` | POST | Rotate signed pre-key |
| `/api/encryption/replenish-prekeys` | POST | Add more one-time pre-keys |
| `/api/encryption/status` | GET | Check encryption status |
| `/api/encryption/session/:contactId` | POST | Initialize session |
| `/api/encryption/session/:contactId` | DELETE | Delete session |
| `/api/encryption/sessions` | GET | Get active sessions |

## Security Considerations

### Key Storage
- Private keys are stored in localStorage
- In production, consider using IndexedDB with encryption
- Keys are cleared on logout

### Forward Secrecy
- One-time pre-keys provide forward secrecy
- Pre-keys are replenished when count falls below 20

### Limitations
- This is a simplified implementation for MVP
- Full Signal Protocol would include:
  - Double Ratchet Algorithm
  - X3DH key agreement
  - Message keys per message
  - Out-of-order message handling

## Testing

Open `encryption-test.html` in a browser to run the test suite:

```bash
cd frontend
open encryption-test.html  # macOS
xdg-open encryption-test.html  # Linux
```

Tests include:
- Identity key generation
- Signed pre-key generation
- One-time pre-key generation
- AES-GCM encryption/decryption
- Shared secret derivation
- Local storage operations
- Simulated chat between two users

## Troubleshooting

### "Keys not initialized"
User hasn't logged in or registration failed to generate keys.

### "Session not found"
No encrypted session with the contact. Try:
1. Ensure contact has uploaded their keys
2. Re-establish session

### Decryption failures
- Session state may be out of sync
- Delete session and re-establish
- Check if message format is valid JSON

## Dependencies

- Web Crypto API (built into browsers)
- No external encryption libraries needed

## Browser Support

Requires browsers with Web Crypto API support:
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 12+
