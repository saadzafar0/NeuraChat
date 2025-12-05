import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { io } from '../server';


type AuthRequest = Request & {
  userId?: string;
};

// Note: Send message functionality moved to Socket.IO only (see server.ts)
// Messages are sent via socket.emit('send-message') for real-time communication

// Get chat messages
export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.userId;

    // Verifyundefined user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get messages
    const { data, error, count } = await supabase
      .from('messages')
      .select('*, users(id, username, full_name, avatar_url)', { count: 'exact' })
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      messages: data.reverse(), // Reverse to show oldest first
      total: count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update message status
export const updateMessageStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { messageId } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    if (!['sent', 'delivered', 'read'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    // Get message to verify chat participation
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('chat_id, sender_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Verify user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', message.chat_id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update message status
    const { data, error } = await supabase
      .from('messages')
      .update({ status })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Message status updated', data });
  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete message
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { messageId } = req.params;
    const userId = req.userId;

    // Get message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Only sender can delete their message
    if (message.sender_id !== userId) {
      res.status(403).json({ error: 'You can only delete your own messages' });
      return;
    }

    // Get chat_id before deleting
    const { data: messageDetails } = await supabase
      .from('messages')
      .select('chat_id')
      .eq('id', messageId)
      .single();

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Emit delete event to all users in the chat room via Socket.IO
    if (messageDetails) {
      io.to(`chat:${messageDetails.chat_id}`).emit('message-deleted', { messageId });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Edit message
export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    // Get message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Only sender can edit their message
    if (message.sender_id !== userId) {
      res.status(403).json({ error: 'You can only edit your own messages' });
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select('*, users(id, username, full_name, avatar_url)')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Emit update to all users in the chat room via Socket.IO
    if (data) {
      const { data: messageDetails } = await supabase
        .from('messages')
        .select('chat_id')
        .eq('id', messageId)
        .single();
      
      if (messageDetails) {
        io.to(`chat:${messageDetails.chat_id}`).emit('message-updated', data);
      }
    }

    res.json({ message: 'Message updated successfully', data });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload media
export const uploadMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { messageId } = req.params;
    const { file_url, file_type, file_size } = req.body;

    const { data, error } = await supabase
      .from('media_files')
      .insert({
        message_id: messageId,
        file_url,
        file_type,
        file_size,
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: 'Media uploaded successfully', data });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
