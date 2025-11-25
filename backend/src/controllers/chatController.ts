import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';


type AuthRequest = Request & {
  userId?: string;
};

// Create a new chat
export const createChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { type, name, participants } = req.body;
    const userId = req.userId;

    // Validate request
    if (!type || !participants || !Array.isArray(participants)) {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    // For group chats, name is required
    if (type === 'group' && !name) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    // Create chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert({ type, name: type === 'group' ? name : null })
      .select()
      .single();

    if (chatError) {
      res.status(400).json({ error: chatError.message });
      return;
    }

    // Add participants (including creator)
    const allParticipants = [...new Set([userId, ...participants])];
    const participantsData = allParticipants.map((participantId, index) => ({
      chat_id: chatData.id,
      user_id: participantId,
      role: index === 0 ? 'admin' : 'member', // Creator is admin
    }));

    const { error: participantsError } = await supabase
      .from('chat_participants')
      .insert(participantsData);

    if (participantsError) {
      // Rollback chat creation
      await supabase.from('chats').delete().eq('id', chatData.id);
      res.status(400).json({ error: participantsError.message });
      return;
    }

    res.status(201).json({ message: 'Chat created successfully', chat: chatData });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's chats
export const getUserChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.userId;

    const { data, error } = await supabase
      .from('chat_participants')
      .select(`
        chat_id,
        role,
        joined_at,
        chats (
          id,
          type,
          name,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Get last message for each chat
    const chatsWithDetails = await Promise.all(
      data.map(async (item: any) => {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, type')
          .eq('chat_id', item.chats.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get participants for the chat
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('user_id, users(id, username, full_name, avatar_url)')
          .eq('chat_id', item.chats.id);

        return {
          ...item.chats,
          role: item.role,
          last_message: lastMessage,
          participants: participants?.map((p: any) => p.users) || [],
        };
      })
    );

    res.json({ chats: chatsWithDetails });
  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get chat details
export const getChatDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const userId = req.userId;

    // Check if user is participant
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get chat details
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Get participants
    const { data: participants, error: participantsError } = await supabase
      .from('chat_participants')
      .select('role, joined_at, users(id, username, full_name, avatar_url, status_message, last_seen)')
      .eq('chat_id', chatId);

    if (participantsError) {
      res.status(400).json({ error: participantsError.message });
      return;
    }

    res.json({
      chat: {
        ...chatData,
        participants: participants.map((p: any) => ({
          ...p.users,
          role: p.role,
          joined_at: p.joined_at,
        })),
        user_role: participant.role,
      },
    });
  } catch (error) {
    console.error('Get chat details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update chat (name, etc.)
export const updateChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const { name } = req.body;
    const userId = req.userId;

    // Check if user is admin
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can update chat details' });
      return;
    }

    const { data, error } = await supabase
      .from('chats')
      .update({ name })
      .eq('id', chatId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Chat updated successfully', chat: data });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add participant to chat
export const addParticipant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const { userId: newUserId } = req.body;
    const userId = req.userId;

    // Check if requester is admin
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can add participants' });
      return;
    }

    // Add new participant
    const { data, error } = await supabase
      .from('chat_participants')
      .insert({
        chat_id: chatId,
        user_id: newUserId,
        role: 'member',
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: 'Participant added successfully', participant: data });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove participant from chat
export const removeParticipant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId, userId: targetUserId } = req.params;
    const userId = req.userId;

    // Check if requester is admin
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can remove participants' });
      return;
    }

    const { error } = await supabase
      .from('chat_participants')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', targetUserId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Leave chat
export const leaveChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const userId = req.userId;

    const { error } = await supabase
      .from('chat_participants')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Left chat successfully' });
  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
