import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { supabase } from "../../../../config/database";

// --- HELPER FUNCTIONS ---

// Resolve username to user ID
async function resolveUserId(usernameOrId: string): Promise<string | null> {
  // If it looks like a UUID, return as-is
  if (usernameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return usernameOrId;
  }
  
  const { data } = await supabase
    .from('users')
    .select('id')
    .ilike('username', usernameOrId)
    .single();
  
  return data?.id || null;
}

// Resolve chat name to chat ID
async function resolveChatId(chatNameOrId: string): Promise<string | null> {
  // If it looks like a UUID, return as-is
  if (chatNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return chatNameOrId;
  }
  
  const { data } = await supabase
    .from('chats')
    .select('id')
    .ilike('name', `%${chatNameOrId}%`)
    .single();
  
  return data?.id || null;
}

// Resolve multiple usernames to user IDs
async function resolveUserIds(usernames: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const username of usernames) {
    const id = await resolveUserId(username);
    if (id) ids.push(id);
  }
  return ids;
}

// 1. Time Tool
export const timeTool = new DynamicStructuredTool({
  name: "get_current_time",
  description: "Returns the current date and time. Use this when asked about dates.",
  schema: z.object({}),
  func: async () => new Date().toISOString(),
});

// 2. User Search Tool (NEW)
export const userSearchTool = new DynamicStructuredTool({
  name: "search_users",
  description: "Search for users in the NeuraChat database by their username or full name.",
  schema: z.object({
    query: z.string().describe("The name or username to search for"),
  }),
  func: async ({ query }) => {
    try {
      const { data, error } = await supabase
        .from('users') // Ensure this matches your table name ('users' vs 'User')
        .select('id, username, full_name, email, status_message')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      if (!data || data.length === 0) return "No users found.";
      
      return JSON.stringify(data);
    } catch (err: any) {
      return `Error searching users: ${err.message}`;
    }
  },
});

// 3. Message Content Search Tool (NEW)
// This allows the agent to recall specific details from past chats
export const messageSearchTool = new DynamicStructuredTool({
  name: "search_messages",
  description: "Search for keywords in the global message history.",
  schema: z.object({
    keyword: z.string().describe("The specific word or phrase to look for"),
  }),
  func: async ({ keyword }) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .ilike('content', `%${keyword}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!data || data.length === 0) return "No messages found with that keyword.";

      return JSON.stringify(data);
    } catch (err: any) {
      return `Error searching messages: ${err.message}`;
    }
  },
});

// 4. Chat Summary Tool
export const chatSummaryTool = new DynamicStructuredTool({
  name: "summarize_chat",
  description: "Summarize the last 10 messages in a given chat. You can use the chat name or ID.",
  schema: z.object({
    chat_name: z.string().describe("The chat name or group name to summarize"),
  }),
  func: async ({ chat_name }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find a chat named "${chat_name}".`;

      const { data, error } = await supabase
        .from('messages')
        .select('content, users!sender_id(username)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) return "No messages found for this chat.";
      
      const summary = data.map((m: any) => `${m.users?.username || 'Unknown'}: ${m.content}`).reverse().join('\n');
      return `Last 10 messages:\n${summary}`;
    } catch (err: any) {
      return `Error summarizing chat: ${err.message}`;
    }
  },
});

// 5. Notification Fetch Tool
export const notificationFetchTool = new DynamicStructuredTool({
  name: "get_notifications",
  description: "Fetch the latest notifications for a user by their username.",
  schema: z.object({
    username: z.string().describe("The username to fetch notifications for"),
  }),
  func: async ({ username }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { data, error } = await supabase
        .from('notifications')
        .select('title, content, type, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!data || data.length === 0) return "No notifications found.";
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return `Error fetching notifications: ${err.message}`;
    }
  },
});

// 6. User Status Update Tool
export const userStatusUpdateTool = new DynamicStructuredTool({
  name: "update_status_message",
  description: "Update a user's status message by their username.",
  schema: z.object({
    username: z.string().describe("The username whose status to update"),
    status_message: z.string().describe("The new status message"),
  }),
  func: async ({ username, status_message }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { error } = await supabase
        .from('users')
        .update({ status_message })
        .eq('id', userId);
      if (error) throw error;
      return `Status message for ${username} updated successfully.`;
    } catch (err: any) {
      return `Error updating status: ${err.message}`;
    }
  },
});

// 7. Create Chat Tool
export const createChatTool = new DynamicStructuredTool({
  name: "create_chat",
  description: "Create a new private or group chat with users by their usernames.",
  schema: z.object({
    type: z.enum(["private", "group"]).describe("Type of chat to create"),
    name: z.string().optional().describe("Name for group chat (required for group)"),
    participants: z.array(z.string()).describe("Array of usernames to add to the chat"),
  }),
  func: async ({ type, name, participants }) => {
    try {
      const participantIds = await resolveUserIds(participants);
      if (participantIds.length === 0) return "Could not find any of the specified users.";
      if (participantIds.length !== participants.length) {
        return `Warning: Some users were not found. Found ${participantIds.length} of ${participants.length} users.`;
      }

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({ type, name: type === 'group' ? name : null })
        .select()
        .single();
      if (chatError) throw chatError;

      const participantRecords = participantIds.map(user_id => ({
        chat_id: chat.id,
        user_id,
        role: 'member'
      }));
      const { error: participantError } = await supabase
        .from('chat_participants')
        .insert(participantRecords);
      if (participantError) throw participantError;

      return `Chat "${name || 'Private Chat'}" created successfully with ${participants.join(', ')}.`;
    } catch (err: any) {
      return `Error creating chat: ${err.message}`;
    }
  },
});

// 8. Get User's Chats Tool
export const getUserChatsTool = new DynamicStructuredTool({
  name: "get_user_chats",
  description: "Get all chats for a specific user by their username.",
  schema: z.object({
    username: z.string().describe("The username to fetch chats for"),
  }),
  func: async ({ username }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { data, error } = await supabase
        .from('chat_participants')
        .select('role, chats!inner(id, type, name, created_at)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return `${username} has no chats.`;
      
      const chats = data.map((d: any) => ({
        name: d.chats.name || 'Private Chat',
        type: d.chats.type,
        role: d.role
      }));
      return JSON.stringify(chats, null, 2);
    } catch (err: any) {
      return `Error fetching chats: ${err.message}`;
    }
  },
});

// 9. Get Chat Participants Tool
export const getChatParticipantsTool = new DynamicStructuredTool({
  name: "get_chat_participants",
  description: "Get all participants in a specific chat by the chat name.",
  schema: z.object({
    chat_name: z.string().describe("The chat or group name to get participants for"),
  }),
  func: async ({ chat_name }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const { data, error } = await supabase
        .from('chat_participants')
        .select('role, users!inner(username, full_name, status_message)')
        .eq('chat_id', chatId);
      if (error) throw error;
      if (!data || data.length === 0) return "No participants found.";
      
      const participants = data.map((d: any) => ({
        username: d.users.username,
        name: d.users.full_name,
        role: d.role,
        status: d.users.status_message
      }));
      return JSON.stringify(participants, null, 2);
    } catch (err: any) {
      return `Error fetching participants: ${err.message}`;
    }
  },
});

// 10. Get AI Session History Tool
export const getAISessionsTool = new DynamicStructuredTool({
  name: "get_ai_sessions",
  description: "Get all AI agent sessions for a user by their username.",
  schema: z.object({
    username: z.string().describe("The username to fetch AI sessions for"),
  }),
  func: async ({ username }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { data, error } = await supabase
        .from('ai_agent_sessions')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) return `${username} has no AI sessions.`;
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return `Error fetching AI sessions: ${err.message}`;
    }
  },
});

// 11. Get Call History Tool
export const getCallHistoryTool = new DynamicStructuredTool({
  name: "get_call_history",
  description: "Get recent call history for a user by their username.",
  schema: z.object({
    username: z.string().describe("The username to fetch call history for"),
  }),
  func: async ({ username }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { data, error } = await supabase
        .from('call_participants')
        .select('status, joined_at, calls!inner(type, start_time, end_time)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) return `${username} has no call history.`;
      
      const calls = data.map((d: any) => ({
        type: d.calls.type,
        status: d.status,
        start: d.calls.start_time,
        end: d.calls.end_time
      }));
      return JSON.stringify(calls, null, 2);
    } catch (err: any) {
      return `Error fetching call history: ${err.message}`;
    }
  },
});

// 12. Search Chat Messages Tool
export const searchChatMessagesTool = new DynamicStructuredTool({
  name: "search_chat_messages",
  description: "Search for messages within a specific chat by the chat name.",
  schema: z.object({
    chat_name: z.string().describe("The chat or group name to search within"),
    keyword: z.string().describe("The keyword to search for"),
  }),
  func: async ({ chat_name, keyword }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const { data, error } = await supabase
        .from('messages')
        .select('content, created_at, users!sender_id(username)')
        .eq('chat_id', chatId)
        .ilike('content', `%${keyword}%`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) return `No messages found with "${keyword}" in "${chat_name}".`;
      
      const messages = data.map((m: any) => ({
        from: m.users?.username || 'Unknown',
        content: m.content,
        time: m.created_at
      }));
      return JSON.stringify(messages, null, 2);
    } catch (err: any) {
      return `Error searching chat messages: ${err.message}`;
    }
  },
});

// 13. Get User Profile Tool
export const getUserProfileTool = new DynamicStructuredTool({
  name: "get_user_profile",
  description: "Get detailed profile information for a user by their username.",
  schema: z.object({
    username: z.string().describe("The username to get profile for"),
  }),
  func: async ({ username }) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, full_name, email, status_message, avatar_url, last_seen, created_at')
        .ilike('username', username)
        .single();
      if (error) throw error;
      if (!data) return `User "${username}" not found.`;
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return `Error fetching user profile: ${err.message}`;
    }
  },
});

// --- EXPORT LISTS ---
export const tools = [
  timeTool,
  userSearchTool,
  messageSearchTool,
  chatSummaryTool,
  notificationFetchTool,
  userStatusUpdateTool,
  createChatTool,
  getUserChatsTool,
  getChatParticipantsTool,
  getAISessionsTool,
  getCallHistoryTool,
  searchChatMessagesTool,
  getUserProfileTool,
];

export const toolsByName: Record<string, DynamicStructuredTool> = {
  get_current_time: timeTool,
  search_users: userSearchTool,
  search_messages: messageSearchTool,
  summarize_chat: chatSummaryTool,
  get_notifications: notificationFetchTool,
  update_status_message: userStatusUpdateTool,
  create_chat: createChatTool,
  get_user_chats: getUserChatsTool,
  get_chat_participants: getChatParticipantsTool,
  get_ai_sessions: getAISessionsTool,
  get_call_history: getCallHistoryTool,
  search_chat_messages: searchChatMessagesTool,
  get_user_profile: getUserProfileTool,
};