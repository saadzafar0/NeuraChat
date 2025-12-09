export type User = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status_message?: string;
  last_seen: Date;
  created_at: Date;
};

export type Chat = {
  id: string;
  type: 'private' | 'group';
  name?: string;
  created_at: Date;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string; // With E2EE enabled: stores encrypted ciphertext (base64)
  type: 'text' | 'media' | 'system';
  status: 'sent' | 'delivered' | 'read';
  created_at: Date;
  updated_at: Date;
};

export type Call = {
  id: string;
  chat_id: string;
  initiator_id: string;
  status: 'active' | 'ended';
  type: 'audio' | 'video';
  start_time: Date;
  end_time?: Date;
};

export type ai_agent_sessions = {
  id: string;
  user_id: string;
  title?: string;
  created_at: Date;
  updated_at: Date;
};

export type ai_interactions = {
  id: string;
  session_id: string;
  user_query: string;
  ai_response: string;
  intent?: 'info' | 'writing' | 'productivity';
  created_at: Date;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  type: 'message' | 'call' | 'system';
  is_read: boolean;
  created_at: Date;
};

export type EncryptionKeys = {
  id: string;
  user_id: string;
  identity_key: string;
  signed_pre_key: string;
  one_time_pre_keys: any;
  updated_at: Date;
};

export type EncryptionSession = {
  id: string;
  user_id: string;
  contact_id: string;
  session_state: any;
  created_at: Date;
  updated_at: Date;
};

export type UsedPreKey = {
  id: string;
  user_id: string;
  prekey_id: string;
  used_by: string;
  used_at: Date;
};

export type KeyRotationLog = {
  id: string;
  user_id: string;
  key_type: 'identity' | 'signed_pre_key' | 'one_time_pre_keys';
  rotated_at: Date;
  reason?: string;
};

// Group Encryption Types
export type GroupSenderKey = {
  id: string;
  group_id: string;
  sender_id: string;
  key_id: number;
  chain_key: string;
  signature_key: string;
  created_at: Date;
};

export type SenderKeyDistribution = {
  id: string;
  group_id: string;
  sender_id: string;
  recipient_id: string;
  key_id: number;
  chain_key: string;
  signature_key: string;
  distributed_at: Date;
};

export type AuthRequest = Request & {
  userId?: string;
};
