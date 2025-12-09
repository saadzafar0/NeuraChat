# 🔐 NeuraChat Encryption Testing Guide

## Quick Verification Checklist

Use this guide to verify if encryption is working correctly in your NeuraChat application.

---

## 🎯 Method 1: Browser-Based Test Tool (Easiest)

### Step 1: Open the Test Tool

1. Make sure frontend is running: `cd frontend && npm run dev`
2. Open browser: `http://localhost:3000/encryption-test.html`
3. This opens a comprehensive test interface

### Step 2: Run Tests in Order

1. **Check LocalStorage Keys**
   - Click "Check Keys in Browser"
   - ✅ Should show: `neurachat_keys_{userId}` if registered
   - ❌ If empty: User hasn't registered or keys weren't generated

2. **Test Backend Connection**
   - Click "Test Connection"
   - ✅ Should show: Backend is running
   - ❌ If failed: Check if backend is running on port 5000

3. **Test Key Generation**
   - Enter a test user ID
   - Click "Generate Keys"
   - ✅ Should show: Identity key pair generated and stored

4. **Test Encryption/Decryption**
   - Enter sender and recipient IDs
   - Type a test message
   - Click "Encrypt Message"
   - Then click "Decrypt Message"
   - ✅ Should show: Original message matches decrypted message

---

## 🔍 Method 2: Browser DevTools Console

### Step 1: Open DevTools

1. Press `F12` or right-click → Inspect
2. Go to **Console** tab

### Step 2: Check for Encryption Logs

When you register or send messages, look for these console logs:

```javascript
✅ Good logs to see:
- "Encryption keys generated and uploaded successfully"
- "Encrypting message: ..."
- "Encrypted result: ..."
- "Decrypting message: ..."
- "Decrypted result: ..."

❌ Bad logs (errors):
- "Encryption not initialized"
- "Failed to encrypt message"
- "Private keys not found"
```

### Step 3: Manually Check LocalStorage

In Console, run:

```javascript
// Check if keys exist
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key.startsWith('neurachat_')) {
    console.log('Found key:', key);
    console.log('Length:', localStorage.getItem(key).length);
  }
}
```

✅ **Expected**: Should see keys like `neurachat_keys_{userId}`  
❌ **Problem**: No keys found = Encryption not initialized

---

## 💾 Method 3: Backend Database Check

### Step 1: Run Backend Test Script

```bash
cd backend
node encryption-test.js
```

This script checks:
- ✅ All 6 encryption tables exist
- ✅ Encryption keys in database
- ✅ Encryption sessions created
- ✅ Messages are encrypted
- ✅ Group encryption keys
- ✅ Key rotation logs

### Step 2: Check Supabase Dashboard

1. Go to your Supabase project
2. Click **Table Editor**
3. Check these tables:

#### `encryption_keys` table:
```
Expected columns:
- user_id (primary key)
- identity_key (public key)
- signed_prekey_id
- signed_prekey (public)
- signed_prekey_signature
- onetime_prekeys (JSON array)
- created_at
- updated_at
```

✅ **Good**: Has rows with user IDs after registration  
❌ **Problem**: Empty table = Keys not being uploaded

#### `encryption_sessions` table:
```
Expected columns:
- user_id
- recipient_id
- session_data (JSON)
- created_at
- updated_at
```

✅ **Good**: Has rows after sending encrypted messages  
❌ **Problem**: Empty = Sessions not being created

#### `messages` table:
```
Check if content looks encrypted:
- Plain text: "Hello, how are you?"
- Encrypted: "eyJpdiI6IkFCQ0RFRi4uLiIsImNpcGhlcnRleHQiOi..."
```

✅ **Good**: Messages have long base64-looking content  
❌ **Problem**: Plain text = Encryption not working

---

## 🔬 Method 4: Network Inspection

### Step 1: Open Network Tab

1. Press `F12` → **Network** tab
2. Filter by: **WS** (WebSocket) or **Fetch/XHR**

### Step 2: Send a Test Message

When you send a message, check:

#### WebSocket Frame (Real-time):
```json
// Outgoing (encrypted):
{
  "event": "send-message",
  "data": {
    "content": "eyJpdiI6IkFCQ0RFRi4uLiIsImNpcGhlcnRleHQiOi...",
    "is_encrypted": true
  }
}
```

✅ **Good**: `content` is long base64 string, `is_encrypted: true`  
❌ **Problem**: `content` is plain text, `is_encrypted: false` or missing

#### API Calls (Registration):
```
POST /api/encryption/keys
Payload:
{
  "identityKey": "...",
  "signedPreKey": { ... },
  "oneTimePreKeys": [ ... ]
}
```

✅ **Good**: This endpoint is called after registration  
❌ **Problem**: No call = Keys not being uploaded

---

## 🧪 Method 5: Step-by-Step User Flow Test

### Test Flow 1: New User Registration

1. **Register a new user**:
   - Open: `http://localhost:3000/register`
   - Fill form and submit

2. **Check Console** immediately:
   ```
   ✅ Should see: "Encryption keys generated and uploaded successfully"
   ❌ If not: Check AuthContext.tsx register() function
   ```

3. **Check LocalStorage**:
   ```javascript
   localStorage.getItem('neurachat_keys_<your-user-id>')
   ```
   ✅ Should return: JSON string with keys  
   ❌ If null: Key generation failed

4. **Check Database**:
   ```sql
   SELECT * FROM encryption_keys WHERE user_id = '<your-user-id>';
   ```
   ✅ Should have: 1 row with your user's keys  
   ❌ If empty: Keys weren't uploaded to backend

### Test Flow 2: Send Encrypted Message

1. **Login with two users** (two browser windows/incognito)

2. **User A sends message to User B**:
   - Open chat with User B
   - Type "Test encrypted message"
   - Send

3. **Check Network Tab**:
   - Look for WebSocket frame
   - Content should be encrypted (long base64 string)

4. **Check User B receives decrypted message**:
   - Message should display as "Test encrypted message"
   - NOT the encrypted string

5. **Check Database**:
   ```sql
   SELECT content FROM messages ORDER BY created_at DESC LIMIT 1;
   ```
   ✅ Good: Content is encrypted (base64)  
   ❌ Problem: Content is plain text

---

## 🚨 Common Issues & Solutions

### Issue 1: "Encryption not initialized"

**Symptoms**:
- Error in console
- Messages sent unencrypted

**Solution**:
```javascript
// In browser console
SignalProtocolManager.hasKeys('<user-id>')
// If false:
// 1. Re-register the user, OR
// 2. Manually initialize:
import { useEncryption } from '@/context/EncryptionContext';
const { initializeEncryption } = useEncryption();
await initializeEncryption();
```

### Issue 2: Keys in LocalStorage but not in Database

**Symptoms**:
- LocalStorage has `neurachat_keys_*`
- Database `encryption_keys` table is empty

**Solution**:
- Check backend logs for errors
- Verify API endpoint: `/api/encryption/keys`
- Check authentication (user must be logged in)
- Manually upload keys:
  ```javascript
  await api.uploadEncryptionKeys({ ... });
  ```

### Issue 3: Messages Not Encrypted

**Symptoms**:
- Messages appear as plain text in database
- No `is_encrypted` flag in WebSocket

**Solution**:
- Check if `encryptedSocketClient` is being used
- Verify encryption context is wrapped around app
- Check for console warnings: "Encryption not ready"

### Issue 4: Can't Decrypt Received Messages

**Symptoms**:
- Received messages show as `[Encrypted message - decryption failed]`
- Console error: "No session found for sender"

**Solution**:
- Initialize session with sender:
  ```javascript
  await initializeSessionWithUser(senderId);
  ```
- Check if recipient has encryption keys
- Verify sender's public keys are in database

---

## ✅ Success Indicators

Your encryption is working if:

1. ✅ **LocalStorage**: Has `neurachat_keys_*` entries
2. ✅ **Database**: `encryption_keys` table has user rows
3. ✅ **Console**: Shows "Encryption keys generated..." on register
4. ✅ **Network**: WebSocket frames have `is_encrypted: true`
5. ✅ **Messages**: Database content is encrypted (base64)
6. ✅ **UI**: Messages decrypt and display correctly
7. ✅ **Status**: EncryptionStatus shows "End-to-End Encrypted"

---

## 📊 Encryption Health Dashboard

Create a simple health check by running this in console:

```javascript
// Encryption Health Check
const userId = 'YOUR_USER_ID'; // Replace with actual user ID

console.log('🔐 Encryption Health Check\n');

// 1. LocalStorage
const hasKeys = localStorage.getItem(`neurachat_keys_${userId}`) !== null;
console.log(`1. LocalStorage Keys: ${hasKeys ? '✅' : '❌'}`);

// 2. Key Count
let keyCount = 0;
for (let i = 0; i < localStorage.length; i++) {
  if (localStorage.key(i).startsWith('neurachat_')) keyCount++;
}
console.log(`2. Total Keys Stored: ${keyCount}`);

// 3. Session Count
let sessionCount = 0;
for (let i = 0; i < localStorage.length; i++) {
  if (localStorage.key(i).startsWith('neurachat_session_')) sessionCount++;
}
console.log(`3. Active Sessions: ${sessionCount}`);

// 4. Backend connectivity (requires api)
try {
  await api.getPreKeyCount();
  console.log('4. Backend Connection: ✅');
} catch {
  console.log('4. Backend Connection: ❌');
}

console.log('\n' + (hasKeys ? '✅ Encryption is initialized' : '❌ Encryption not initialized'));
```

---

## 🔧 Debug Mode

Enable verbose logging:

```javascript
// Add to frontend/src/lib/encryption/SignalProtocol.ts
static DEBUG = true;

// Then every operation will log:
if (SignalProtocolManager.DEBUG) {
  console.log('[Encryption] Operation:', data);
}
```

---

## 📞 Need Help?

If encryption still not working:

1. ✅ Check all steps in this guide
2. ✅ Run backend test script: `node encryption-test.js`
3. ✅ Open browser test tool: `/encryption-test.html`
4. ✅ Check browser console for errors
5. ✅ Verify database schema matches backend types
6. ✅ Ensure both frontend and backend are running
7. ✅ Check `.env` files for correct URLs

---

## 🎯 Quick Command Reference

```bash
# Backend
cd backend
npm run dev                    # Start backend
node encryption-test.js        # Test encryption

# Frontend
cd frontend
npm run dev                    # Start frontend
# Open: http://localhost:3000/encryption-test.html

# Database
# Open Supabase Dashboard → Table Editor
# Check: encryption_keys, encryption_sessions, messages
```

---

**Last Updated**: December 9, 2025  
**Version**: 1.0
