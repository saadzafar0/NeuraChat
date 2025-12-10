import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import jwt from 'jsonwebtoken';

// --- Register ---
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { email, password, username, full_name } = req.body;

    console.log('Registering user:', email);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name },
        emailRedirectTo: undefined
      }
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'User creation failed' });
      return;
    }

    // 2. Fetch profile (created by trigger)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      res.status(400).json({ error: 'Failed to create user profile' });
      return;
    }

    // 3. Generate Token
    const token = jwt.sign(
      { userId: authData.user.id },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    // 4. Set Cookie with Path '/' (CRITICAL FIX)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, 
      path: '/' 
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: userData,
      token 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Login ---
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { email, password } = req.body;

    // 1. Authenticate
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // 2. Get Profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // 3. Update Last Seen
    await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', data.user.id);

    // 4. Generate Token
    const token = jwt.sign(
      { userId: data.user.id },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    // 5. Set Cookie with Path '/' (CRITICAL FIX)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/' 
    });

    res.json({
      message: 'Login successful',
      user: userData,
      token 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Logout ---
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/' 
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Get Current User ---
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
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

// --- Forgot Password ---
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Use Supabase's built-in password reset
    const resetUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${resetUrl}/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not for security
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      return;
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Reset Password ---
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { accessToken, newPassword } = req.body;

    if (!accessToken || !newPassword) {
      res.status(400).json({ error: 'Access token and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // Set the session using the access token from the URL
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken, // Supabase requires both, but we only have access token
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      res.status(400).json({ error: 'Failed to update password. The link may have expired.' });
      return;
    }

    res.json({ message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};