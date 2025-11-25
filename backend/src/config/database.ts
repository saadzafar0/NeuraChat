import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;

// Initialize Supabase client
export const initializeDatabase = (): SupabaseClient => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration. Please check your .env file.');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✓ Supabase client initialized successfully');
  
  return supabaseInstance;
};

// Get the Supabase client instance
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return supabaseInstance;
};

// Export for backward compatibility (will be initialized in server.ts)
export let supabase: SupabaseClient;
