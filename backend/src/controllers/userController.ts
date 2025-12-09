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

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { current_password, new_password } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const supabase = getSupabaseClient();

    // Get user's email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Create a new Supabase client with service role for admin operations
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    });

    if (signInError) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: new_password }
    );

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
