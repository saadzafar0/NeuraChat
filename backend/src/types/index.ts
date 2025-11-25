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
  content: string;
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

export type AIAgentSession = {
  id: string;
  user_id: string;
  title?: string;
  created_at: Date;
  updated_at: Date;
};

export type AIInteraction = {
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

export type AuthRequest = Request & {
  userId?: string;
};
