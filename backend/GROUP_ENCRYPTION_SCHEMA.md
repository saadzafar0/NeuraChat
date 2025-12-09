# Group Encryption Database Schema

This file contains the SQL schema for group encryption using Sender Keys protocol.

## Tables Overview

1. **group_sender_keys** - Stores each sender's encryption key for each group
2. **sender_key_distributions** - Tracks which keys have been distributed to which recipients

---

## Schema SQL

```sql
-- Table: group_sender_keys
-- Purpose: Store sender keys for group encryption
-- Each user in a group has their own sender key
create table public.group_sender_keys (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.chats(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  key_id integer not null,
  chain_key text not null,        -- Base64 encoded chain key
  signature_key text not null,    -- Base64 encoded signature key
  created_at timestamptz default now(),
  unique(group_id, sender_id, key_id)
);

-- Indexes for fast lookups
create index idx_group_sender_keys_group on public.group_sender_keys(group_id);
create index idx_group_sender_keys_sender on public.group_sender_keys(sender_id);
create index idx_group_sender_keys_created on public.group_sender_keys(created_at desc);

-- Table: sender_key_distributions
-- Purpose: Track which sender keys have been distributed to which recipients
-- Used for key distribution and member management
create table public.sender_key_distributions (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.chats(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  recipient_id uuid references public.users(id) on delete cascade not null,
  key_id integer not null,
  chain_key text not null,
  signature_key text not null,
  distributed_at timestamptz default now(),
  unique(group_id, sender_id, recipient_id, key_id)
);

-- Indexes for fast lookups
create index idx_sender_key_dist_group on public.sender_key_distributions(group_id);
create index idx_sender_key_dist_sender on public.sender_key_distributions(sender_id);
create index idx_sender_key_dist_recipient on public.sender_key_distributions(recipient_id);
create index idx_sender_key_dist_distributed on public.sender_key_distributions(distributed_at desc);

-- Note: RLS (Row Level Security) should be enabled in production
-- For development, RLS is disabled for easier testing
```

---

## Table Relationships

```
chats (groups)
  ↓
  ├─> group_sender_keys (one per sender per group)
  └─> sender_key_distributions (tracks key sharing)

users
  ↓
  ├─> group_sender_keys (sender_id)
  └─> sender_key_distributions (sender_id, recipient_id)
```

---

## How It Works

### 1. Group Creation
When a group is created:
- Each member generates a sender key
- Each sender key is distributed to all other members

### 2. Sending Messages
When Alice sends a message to a group:
- Alice uses HER sender key to encrypt the message
- The encrypted message is broadcast to all members
- Each member decrypts using Alice's sender key (which they received during distribution)

### 3. Adding Members
When Bob joins the group:
- All existing sender keys are distributed to Bob
- Bob generates his own sender key
- Bob's sender key is distributed to all existing members

### 4. Removing Members
When Carol leaves the group:
- Carol's sender key is deleted
- All distributions to Carol are deleted
- All remaining members rotate their sender keys (forward secrecy)
- New keys are distributed to all remaining members

---

## Key Rotation Flow

```
Member Removed
    ↓
Delete member's sender key
    ↓
Delete distributions to member
    ↓
All other members rotate sender keys
    ↓
Distribute new keys to remaining members
    ↓
Forward secrecy achieved
```

---

## Example Data

### group_sender_keys
```
id                  | group_id  | sender_id | key_id | chain_key | signature_key | created_at
--------------------|-----------|-----------|--------|-----------|---------------|------------
abc-123...          | group-1   | alice-id  | 1001   | AABBCC... | DDEEFF...     | 2025-12-09
def-456...          | group-1   | bob-id    | 1002   | GGHHII... | JJKKLL...     | 2025-12-09
ghi-789...          | group-1   | carol-id  | 1003   | MMNNOO... | PPQQRR...     | 2025-12-09
```

### sender_key_distributions
```
id                  | group_id  | sender_id | recipient_id | key_id | distributed_at
--------------------|-----------|-----------|--------------|--------|---------------
xyz-001...          | group-1   | alice-id  | bob-id       | 1001   | 2025-12-09
xyz-002...          | group-1   | alice-id  | carol-id     | 1001   | 2025-12-09
xyz-003...          | group-1   | bob-id    | alice-id     | 1002   | 2025-12-09
xyz-004...          | group-1   | bob-id    | carol-id     | 1002   | 2025-12-09
```

---

## Security Considerations

### ✅ What's Secure
- Each sender has their own key (sender keys protocol)
- Keys are rotated when members leave (forward secrecy)
- Messages encrypted once, not per-recipient (efficient)
- Signature keys prevent impersonation

### ⚠️ Production Requirements
- Enable Row Level Security (RLS)
- Encrypt keys at rest (database encryption)
- Add rate limiting on key operations
- Implement key rotation schedule (e.g., every 30 days)
- Monitor for suspicious key access patterns

---

## API Endpoints

### Initialize Group Encryption
```
POST /api/group-encryption/initialize
Body: { groupId, memberIds: [] }
```

### Get Encryption Status
```
GET /api/group-encryption/status/:groupId
Response: { enabled, senderKeyCount, memberCount, lastRotation }
```

### Rotate Sender Key
```
POST /api/group-encryption/rotate-sender-key/:groupId
```

### Handle Member Added
```
POST /api/group-encryption/member-added
Body: { groupId, newMemberId }
```

### Handle Member Removed
```
POST /api/group-encryption/member-removed
Body: { groupId, removedMemberId }
```

### Rotate All Keys (Admin)
```
POST /api/group-encryption/rotate-all/:groupId
```

---

## Performance Considerations

### Optimizations
- **Batched Distribution**: Keys distributed in bulk when possible
- **Indexed Queries**: Fast lookups by group, sender, recipient
- **Lazy Key Generation**: Keys generated on first message, not immediately

### Scalability
- **Large Groups (100+ members)**: Consider key caching
- **Frequent Rotations**: Use background workers
- **High Message Volume**: Implement message queuing

---

## Testing

Run the test suite:
```bash
npx ts-node src/services/encryption/test-encryption.ts
```

The test includes:
- Sender key generation
- Group message encryption/decryption
- Member add/remove scenarios
- Key rotation

---

## Next Steps

1. ✅ Run SQL in Supabase SQL Editor
2. ✅ Test group encryption endpoints
3. ⏳ Integrate with frontend
4. ⏳ Add key rotation automation
5. ⏳ Implement UI for encryption status

---

**Last Updated:** December 9, 2025  
**Status:** ✅ Ready for Production (after RLS enabled)
