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

// =====================
// MESSAGING ACTIONS
// =====================

// 14. Send Message Tool
export const sendMessageTool = new DynamicStructuredTool({
  name: "send_message",
  description: "Send a text message to a specific chat on behalf of a user. Use this when the user asks to send a message like 'Tell John I'll be late'.",
  schema: z.object({
    chat_name: z.string().describe("The chat or group name to send the message to"),
    sender_username: z.string().describe("The username of the person sending the message"),
    content: z.string().describe("The message content to send"),
  }),
  func: async ({ chat_name, sender_username, content }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const senderId = await resolveUserId(sender_username);
      if (!senderId) return `Could not find user "${sender_username}".`;

      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          content,
          type: 'text',
          status: 'sent'
        });
      if (error) throw error;
      return `Message sent to "${chat_name}" successfully.`;
    } catch (err: any) {
      return `Error sending message: ${err.message}`;
    }
  },
});

// 15. Edit Message Tool
export const editMessageTool = new DynamicStructuredTool({
  name: "edit_message",
  description: "Edit the content of an existing message by its ID.",
  schema: z.object({
    message_id: z.string().describe("The UUID of the message to edit"),
    new_content: z.string().describe("The new content for the message"),
  }),
  func: async ({ message_id, new_content }) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: new_content, updated_at: new Date().toISOString() })
        .eq('id', message_id);
      if (error) throw error;
      return `Message updated successfully.`;
    } catch (err: any) {
      return `Error editing message: ${err.message}`;
    }
  },
});

// 16. Delete Message Tool
export const deleteMessageTool = new DynamicStructuredTool({
  name: "delete_message",
  description: "Delete a message by its ID (soft-delete by updating content to indicate deletion).",
  schema: z.object({
    message_id: z.string().describe("The UUID of the message to delete"),
  }),
  func: async ({ message_id }) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: '[Message deleted]', type: 'system', updated_at: new Date().toISOString() })
        .eq('id', message_id);
      if (error) throw error;
      return `Message deleted successfully.`;
    } catch (err: any) {
      return `Error deleting message: ${err.message}`;
    }
  },
});

// 17. React to Message Tool
export const reactToMessageTool = new DynamicStructuredTool({
  name: "react_to_message",
  description: "Add an emoji reaction to a specific message. Note: This stores the reaction in message metadata.",
  schema: z.object({
    message_id: z.string().describe("The UUID of the message to react to"),
    emoji: z.string().describe("The emoji reaction (e.g., '👍', '❤️', '😂')"),
    username: z.string().describe("The username of the person reacting"),
  }),
  func: async ({ message_id, emoji, username }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      // Get current message to append reaction
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('id', message_id)
        .single();
      if (fetchError || !message) return `Message not found.`;

      // For now, we'll create a system message as a reaction indicator
      // In a full implementation, you'd have a separate reactions table
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: (await supabase.from('messages').select('chat_id').eq('id', message_id).single()).data?.chat_id,
          sender_id: userId,
          content: `${emoji} reacted to a message`,
          type: 'system',
          status: 'sent'
        });
      if (error) throw error;
      return `Reaction ${emoji} added by ${username}.`;
    } catch (err: any) {
      return `Error adding reaction: ${err.message}`;
    }
  },
});

// =====================
// GROUP ADMINISTRATION
// =====================

// 18. Add Group Participant Tool
export const addGroupParticipantTool = new DynamicStructuredTool({
  name: "add_group_participant",
  description: "Add a user to an existing group chat.",
  schema: z.object({
    chat_name: z.string().describe("The group chat name to add the user to"),
    username: z.string().describe("The username of the person to add"),
    role: z.enum(["admin", "member"]).optional().describe("Role for the new participant (default: member)"),
  }),
  func: async ({ chat_name, username, role = "member" }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      // Check if already a participant
      const { data: existing } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .single();
      if (existing) return `${username} is already a participant in this chat.`;

      const { error } = await supabase
        .from('chat_participants')
        .insert({ chat_id: chatId, user_id: userId, role });
      if (error) throw error;
      return `${username} added to "${chat_name}" as ${role}.`;
    } catch (err: any) {
      return `Error adding participant: ${err.message}`;
    }
  },
});

// 19. Remove Group Participant Tool
export const removeGroupParticipantTool = new DynamicStructuredTool({
  name: "remove_group_participant",
  description: "Remove a user from a group chat.",
  schema: z.object({
    chat_name: z.string().describe("The group chat name to remove the user from"),
    username: z.string().describe("The username of the person to remove"),
  }),
  func: async ({ chat_name, username }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId);
      if (error) throw error;
      return `${username} removed from "${chat_name}".`;
    } catch (err: any) {
      return `Error removing participant: ${err.message}`;
    }
  },
});

// 20. Update Group Info Tool
export const updateGroupInfoTool = new DynamicStructuredTool({
  name: "update_group_info",
  description: "Rename a group chat or update its details.",
  schema: z.object({
    chat_name: z.string().describe("The current group chat name"),
    new_name: z.string().describe("The new name for the group chat"),
  }),
  func: async ({ chat_name, new_name }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const { error } = await supabase
        .from('chats')
        .update({ name: new_name })
        .eq('id', chatId);
      if (error) throw error;
      return `Group renamed from "${chat_name}" to "${new_name}".`;
    } catch (err: any) {
      return `Error updating group info: ${err.message}`;
    }
  },
});

// 21. Leave Chat Tool
export const leaveChatTool = new DynamicStructuredTool({
  name: "leave_chat",
  description: "Remove a user from a specific chat (leave the chat).",
  schema: z.object({
    chat_name: z.string().describe("The chat name to leave"),
    username: z.string().describe("The username of the person leaving"),
  }),
  func: async ({ chat_name, username }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId);
      if (error) throw error;
      return `${username} has left "${chat_name}".`;
    } catch (err: any) {
      return `Error leaving chat: ${err.message}`;
    }
  },
});

// =====================
// MEDIA & FILES
// =====================

// 22. Get Chat Media Tool
export const getChatMediaTool = new DynamicStructuredTool({
  name: "get_chat_media",
  description: "List all media files (images, videos, documents) shared in a specific chat.",
  schema: z.object({
    chat_name: z.string().describe("The chat name to get media from"),
  }),
  func: async ({ chat_name }) => {
    try {
      const chatId = await resolveChatId(chat_name);
      if (!chatId) return `Could not find chat "${chat_name}".`;

      const { data, error } = await supabase
        .from('media_files')
        .select('file_url, file_type, file_size, uploaded_at, messages!inner(chat_id)')
        .eq('messages.chat_id', chatId)
        .order('uploaded_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!data || data.length === 0) return `No media files found in "${chat_name}".`;

      const media = data.map((m: any) => ({
        url: m.file_url,
        type: m.file_type,
        size: m.file_size,
        uploaded: m.uploaded_at
      }));
      return JSON.stringify(media, null, 2);
    } catch (err: any) {
      return `Error fetching media: ${err.message}`;
    }
  },
});

// 23. Search Media Tool
export const searchMediaTool = new DynamicStructuredTool({
  name: "search_media",
  description: "Search for media files by type (image, video, document) across all chats.",
  schema: z.object({
    file_type: z.string().describe("The type of media to search for (e.g., 'image', 'video', 'document', 'pdf')"),
    limit: z.number().optional().describe("Maximum number of results (default: 10)"),
  }),
  func: async ({ file_type, limit = 10 }) => {
    try {
      const { data, error } = await supabase
        .from('media_files')
        .select('file_url, file_type, file_size, uploaded_at')
        .ilike('file_type', `%${file_type}%`)
        .order('uploaded_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (!data || data.length === 0) return `No ${file_type} files found.`;

      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return `Error searching media: ${err.message}`;
    }
  },
});

// =====================
// PRIVACY & SECURITY
// =====================

// Note: The EERD doesn't have a blocked_users table, so we'll use notifications
// or a simple approach. For a full implementation, you'd add a blocked_users table.

// 24. Block User Tool
export const blockUserTool = new DynamicStructuredTool({
  name: "block_user",
  description: "Block a specific user. Creates a system notification to track the block.",
  schema: z.object({
    blocker_username: z.string().describe("The username of the person blocking"),
    blocked_username: z.string().describe("The username of the person to block"),
  }),
  func: async ({ blocker_username, blocked_username }) => {
    try {
      const blockerId = await resolveUserId(blocker_username);
      if (!blockerId) return `Could not find user "${blocker_username}".`;

      const blockedId = await resolveUserId(blocked_username);
      if (!blockedId) return `Could not find user "${blocked_username}".`;

      // Create a system notification to track the block
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: blockerId,
          title: 'User Blocked',
          content: `You blocked ${blocked_username} (ID: ${blockedId})`,
          type: 'system',
          is_read: true
        });
      if (error) throw error;
      return `${blocked_username} has been blocked.`;
    } catch (err: any) {
      return `Error blocking user: ${err.message}`;
    }
  },
});

// 25. Unblock User Tool
export const unblockUserTool = new DynamicStructuredTool({
  name: "unblock_user",
  description: "Unblock a previously blocked user.",
  schema: z.object({
    blocker_username: z.string().describe("The username of the person unblocking"),
    blocked_username: z.string().describe("The username of the person to unblock"),
  }),
  func: async ({ blocker_username, blocked_username }) => {
    try {
      const blockerId = await resolveUserId(blocker_username);
      if (!blockerId) return `Could not find user "${blocker_username}".`;

      const blockedId = await resolveUserId(blocked_username);
      if (!blockedId) return `Could not find user "${blocked_username}".`;

      // Remove the block notification
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', blockerId)
        .ilike('content', `%blocked ${blocked_username}%`);
      if (error) throw error;
      return `${blocked_username} has been unblocked.`;
    } catch (err: any) {
      return `Error unblocking user: ${err.message}`;
    }
  },
});

// 26. Get Blocked Users Tool
export const getBlockedUsersTool = new DynamicStructuredTool({
  name: "get_blocked_users",
  description: "List all users currently blocked by a specific user.",
  schema: z.object({
    username: z.string().describe("The username to get blocked users for"),
  }),
  func: async ({ username }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      const { data, error } = await supabase
        .from('notifications')
        .select('content, created_at')
        .eq('user_id', userId)
        .eq('title', 'User Blocked')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return `${username} has not blocked any users.`;

      // Extract blocked usernames from notification content
      const blockedUsers = data.map((n: any) => {
        const match = n.content.match(/You blocked (\w+)/);
        return match ? match[1] : 'Unknown';
      });
      return `Blocked users: ${blockedUsers.join(', ')}`;
    } catch (err: any) {
      return `Error fetching blocked users: ${err.message}`;
    }
  },
});

// =====================
// PRODUCTIVITY EXTENSIONS
// =====================

// 27. Translate Message Tool
export const translateMessageTool = new DynamicStructuredTool({
  name: "translate_message",
  description: "Translate a specific message by its ID into a target language. Returns the translated text.",
  schema: z.object({
    message_id: z.string().describe("The UUID of the message to translate"),
    target_language: z.string().describe("The target language (e.g., 'Spanish', 'French', 'Arabic', 'Japanese')"),
  }),
  func: async ({ message_id, target_language }) => {
    try {
      const { data: message, error } = await supabase
        .from('messages')
        .select('content')
        .eq('id', message_id)
        .single();
      if (error || !message) return `Message not found.`;

      // Return the message with translation request - the LLM will handle actual translation
      return `Original message: "${message.content}"\n\nPlease translate this to ${target_language}.`;
    } catch (err: any) {
      return `Error fetching message for translation: ${err.message}`;
    }
  },
});

// 28. Set Reminder Tool
export const setReminderTool = new DynamicStructuredTool({
  name: "set_reminder",
  description: "Create a reminder notification scheduled for a specific time. Uses the notifications table per EERD.",
  schema: z.object({
    username: z.string().describe("The username to set the reminder for"),
    title: z.string().describe("The reminder title"),
    content: z.string().describe("The reminder content/description"),
    remind_at: z.string().describe("When to remind (ISO 8601 format or natural language like 'in 2 hours', 'tomorrow at 9am')"),
  }),
  func: async ({ username, title, content, remind_at }) => {
    try {
      const userId = await resolveUserId(username);
      if (!userId) return `Could not find user "${username}".`;

      // Parse the remind_at time - for now, store it in the notification content
      // A full implementation would use a scheduled jobs system
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: `⏰ Reminder: ${title}`,
          content: `${content}\n\nScheduled for: ${remind_at}`,
          type: 'system',
          is_read: false
        });
      if (error) throw error;
      return `Reminder set for ${username}: "${title}" at ${remind_at}.`;
    } catch (err: any) {
      return `Error setting reminder: ${err.message}`;
    }
  },
});

// --- EXPORT LISTS ---
export const tools = [
  // Core tools
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
  // Messaging actions
  sendMessageTool,
  editMessageTool,
  deleteMessageTool,
  reactToMessageTool,
  // Group administration
  addGroupParticipantTool,
  removeGroupParticipantTool,
  updateGroupInfoTool,
  leaveChatTool,
  // Media & files
  getChatMediaTool,
  searchMediaTool,
  // Privacy & security
  blockUserTool,
  unblockUserTool,
  getBlockedUsersTool,
  // Productivity
  translateMessageTool,
  setReminderTool,
];

export const toolsByName: Record<string, DynamicStructuredTool> = {
  // Core tools
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
  // Messaging actions
  send_message: sendMessageTool,
  edit_message: editMessageTool,
  delete_message: deleteMessageTool,
  react_to_message: reactToMessageTool,
  // Group administration
  add_group_participant: addGroupParticipantTool,
  remove_group_participant: removeGroupParticipantTool,
  update_group_info: updateGroupInfoTool,
  leave_chat: leaveChatTool,
  // Media & files
  get_chat_media: getChatMediaTool,
  search_media: searchMediaTool,
  // Privacy & security
  block_user: blockUserTool,
  unblock_user: unblockUserTool,
  get_blocked_users: getBlockedUsersTool,
  // Productivity
  translate_message: translateMessageTool,
  set_reminder: setReminderTool,
};