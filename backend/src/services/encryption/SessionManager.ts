import { getSupabaseClient } from '../../config/database';

export interface SessionState {
  state: any; // Serialized session state
}

export class SessionManager {
  /**
   * Save encryption session state
   */
  static async saveSession(userId: string, contactId: string, sessionState: any): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('encryption_sessions')
      .upsert({
        user_id: userId,
        contact_id: contactId,
        session_state: sessionState,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw new Error(`Failed to save session: ${error.message}`);
  }

  /**
   * Load encryption session state
   */
  static async loadSession(userId: string, contactId: string): Promise<any | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_sessions')
      .select('session_state')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .single();
    
    if (error || !data) return null;
    
    return data.session_state;
  }

  /**
   * Delete encryption session
   */
  static async deleteSession(userId: string, contactId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('encryption_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('contact_id', contactId);
    
    if (error) throw new Error(`Failed to delete session: ${error.message}`);
  }

  /**
   * Check if session exists
   */
  static async hasSession(userId: string, contactId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .single();
    
    return !error && !!data;
  }

  /**
   * Get all active sessions for a user
   */
  static async getActiveSessions(userId: string): Promise<Array<{ contactId: string; updatedAt: string }>> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_sessions')
      .select('contact_id, updated_at')
      .eq('user_id', userId);
    
    if (error || !data) return [];
    
    return data.map(session => ({
      contactId: session.contact_id,
      updatedAt: session.updated_at
    }));
  }

  /**
   * Update session timestamp
   */
  static async touchSession(userId: string, contactId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('encryption_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('contact_id', contactId);
  }
}
