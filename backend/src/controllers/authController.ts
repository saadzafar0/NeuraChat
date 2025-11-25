import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import jwt, { SignOptions } from 'jsonwebtoken';
import { compareSync } from 'bcrypt';

// Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { email, password, username, full_name } = req.body;

    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name,
        }
      }
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    if (!authData.user) {
      res.status(400).json({ error: 'User creation failed' });
      return;
    }

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        username,
        full_name,
      })
      .select()
      .single();

    if (userError) {
      res.status(400).json({ error: userError.message });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: authData.user.id },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    // Set token in httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: userData,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { email, password } = req.body;
    console.log('Login attempt:', email);
    
    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase Auth Error:', error.message, error);
      res.status(401).json({ error: 'Invalid credentials', details: error.message });
      return;
    }

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Update last seen
    await supabase
      .from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', data.user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: data.user.id },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    // Set token in httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      user: userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout user
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    // Get token from cookie
    const token = req.cookies?.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { userId: string };
      
      // Update last seen
      await supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', decoded.userId);
    }

    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    // Get token from cookie
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { userId: string };

    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: userData });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
