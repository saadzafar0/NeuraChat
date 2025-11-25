import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';

type AuthRequest = Request & {
  userId?: string;
};

// Get user profile by ID
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, full_name, avatar_url, status_message, last_seen, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: data });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user profile
export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { username, full_name, avatar_url, status_message } = req.body;
    const userId = req.userId;

    const updateData: any = {};
    if (username) updateData.username = username;
    if (full_name) updateData.full_name = full_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (status_message !== undefined) updateData.status_message = status_message;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Profile updated successfully', user: data });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Search users
export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { query } = req.query;

    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, status_message')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ users: data });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user contacts
export const getUserContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.userId;

    // Get all chats the user is part of
    const { data: chatParticipants, error: cpError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId);

    if (cpError) {
      res.status(400).json({ error: cpError.message });
      return;
    }

    const chatIds = chatParticipants.map(cp => cp.chat_id);

    if (chatIds.length === 0) {
      res.json({ contacts: [] });
      return;
    }

    // Get all other participants in those chats
    const { data: contacts, error: contactsError } = await supabase
      .from('chat_participants')
      .select('user_id, users(id, username, full_name, avatar_url, status_message, last_seen)')
      .in('chat_id', chatIds)
      .neq('user_id', userId);

    if (contactsError) {
      res.status(400).json({ error: contactsError.message });
      return;
    }

    // Remove duplicates
    const uniqueContacts = Array.from(
      new Map(contacts.map((c: any) => [c.users.id, c.users])).values()
    );

    res.json({ contacts: uniqueContacts });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update last seen
export const updateLastSeen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.userId;

    const { error } = await supabase
      .from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Last seen updated' });
  } catch (error) {
    console.error('Update last seen error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
