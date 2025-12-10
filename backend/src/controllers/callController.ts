import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { generateRtcToken } from '../utils/agoraToken';

type AuthRequest = Request & {
  userId?: string;
};

/**
 * Initiate a new call
 * POST /api/calls
 */
export const initiateCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId, type = 'audio' } = req.body;

    if (!chatId) {
      res.status(400).json({ error: 'chatId is required' });
      return;
    }

    if (type !== 'audio' && type !== 'video') {
      res.status(400).json({ error: 'type must be "audio" or "video"' });
      return;
    }

    const supabase = getSupabaseClient();

    // Verify user is a participant of the chat
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'You are not a participant of this chat' });
      return;
    }

    // Create call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        chat_id: chatId,
        initiator_id: userId,
        type,
        status: 'active',
      })
      .select('*')
      .single();

    if (callError || !call) {
      console.error('Error creating call:', callError);
      res.status(500).json({ error: 'Failed to create call' });
      return;
    }

    // Add initiator as participant
    const { error: participantInsertError } = await supabase
      .from('call_participants')
      .insert({
        call_id: call.id,
        user_id: userId,
        status: 'connected',
      });

    if (participantInsertError) {
      console.error('Error adding call participant:', participantInsertError);
      // Continue anyway - call is created
    }

    res.status(201).json({
      call: {
        id: call.id,
        chat_id: call.chat_id,
        initiator_id: call.initiator_id,
        type: call.type,
        status: call.status,
        start_time: call.start_time,
      },
    });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Join an existing call (get Agora token)
 * POST /api/calls/:callId/join
 */
export const joinCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { callId } = req.params;

    const supabase = getSupabaseClient();

    // Get call details
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*, chats(id)')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    if (call.status !== 'active') {
      res.status(400).json({ error: 'Call is not active' });
      return;
    }

    // Verify user is a participant of the chat
    const { data: chatParticipant, error: chatParticipantError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', call.chat_id)
      .eq('user_id', userId)
      .single();

    if (chatParticipantError || !chatParticipant) {
      res.status(403).json({ error: 'You are not a participant of this chat' });
      return;
    }

    // Generate Agora token
    const channelName = `chat_${call.chat_id}`;
    const uid = Math.floor(Math.random() * 1000000) + 1; // Random UID
    const token = generateRtcToken(channelName, uid);

    // Add or update participant status
    const { error: participantError } = await supabase
      .from('call_participants')
      .upsert({
        call_id: callId,
        user_id: userId,
        status: 'connected',
        joined_at: new Date().toISOString(),
      }, {
        onConflict: 'call_id,user_id',
      });

    if (participantError) {
      console.error('Error updating call participant:', participantError);
      // Continue anyway - token is generated
    }

    res.json({
      token,
      channelName,
      uid,
      callId: call.id,
    });
  } catch (error) {
    console.error('Join call error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Leave a call
 * POST /api/calls/:callId/leave
 */
export const leaveCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { callId } = req.params;

    const supabase = getSupabaseClient();

    // Update participant status
    const { error: updateError } = await supabase
      .from('call_participants')
      .update({ status: 'left' })
      .eq('call_id', callId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating participant status:', updateError);
      res.status(500).json({ error: 'Failed to leave call' });
      return;
    }

    // Check if call should be ended (no active participants)
    const { data: activeParticipants } = await supabase
      .from('call_participants')
      .select('user_id')
      .eq('call_id', callId)
      .eq('status', 'connected');

    if (!activeParticipants || activeParticipants.length === 0) {
      // End the call
      await supabase
        .from('calls')
        .update({
          status: 'ended',
          end_time: new Date().toISOString(),
        })
        .eq('id', callId);
    }

    res.json({ message: 'Left call successfully' });
  } catch (error) {
    console.error('Leave call error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * End a call
 * POST /api/calls/:callId/end
 */
export const endCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { callId } = req.params;

    const supabase = getSupabaseClient();

    // Verify user is the initiator or a participant
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('initiator_id')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Only initiator can end the call
    if (call.initiator_id !== userId) {
      res.status(403).json({ error: 'Only the call initiator can end the call' });
      return;
    }

    // Update all participants to 'left'
    await supabase
      .from('call_participants')
      .update({ status: 'left' })
      .eq('call_id', callId)
      .neq('status', 'left');

    // End the call
    const { data: endedCall, error: endError } = await supabase
      .from('calls')
      .update({
        status: 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('id', callId)
      .select('*')
      .single();

    if (endError || !endedCall) {
      res.status(500).json({ error: 'Failed to end call' });
      return;
    }

    res.json({
      message: 'Call ended successfully',
      call: endedCall,
    });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get call participants
 * GET /api/calls/:callId/participants
 */
export const getCallParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { callId } = req.params;

    const supabase = getSupabaseClient();

    // Verify user has access to this call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('chat_id')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Verify user is a participant of the chat
    const { data: chatParticipant, error: chatParticipantError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', call.chat_id)
      .eq('user_id', userId)
      .single();

    if (chatParticipantError || !chatParticipant) {
      res.status(403).json({ error: 'You do not have access to this call' });
      return;
    }

    // Get participants
    const { data: participants, error: participantsError } = await supabase
      .from('call_participants')
      .select(`
        *,
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('call_id', callId)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      res.status(500).json({ error: 'Failed to fetch participants' });
      return;
    }

    res.json({ participants: participants || [] });
  } catch (error) {
    console.error('Get call participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get call history for a chat
 * GET /api/calls/history/:chatId
 */
export const getCallHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId } = req.params;

    const supabase = getSupabaseClient();

    // Verify user is a participant of the chat
    const { data: chatParticipant, error: chatParticipantError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatParticipantError || !chatParticipant) {
      res.status(403).json({ error: 'You are not a participant of this chat' });
      return;
    }

    // Get call history
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        *,
        initiator:users!calls_initiator_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        ),
        call_participants (
          user_id,
          status,
          joined_at,
          users (
            id,
            username,
            full_name,
            avatar_url
          )
        ),
        call_logs (
          quality_rating,
          duration_seconds
        )
      `)
      .eq('chat_id', chatId)
      .order('start_time', { ascending: false })
      .limit(50);

    if (callsError) {
      res.status(500).json({ error: 'Failed to fetch call history' });
      return;
    }

    res.json({ calls: calls || [] });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get call logs for the authenticated user
 * GET /api/calls/logs
 * Returns all calls the user was involved in (as initiator or receiver)
 */
export const getUserCallLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { limit = 50, offset = 0 } = req.query;

    const supabase = getSupabaseClient();

    // Get all calls where user was a participant
    const { data: callParticipations, error: participationsError } = await supabase
      .from('call_participants')
      .select('call_id')
      .eq('user_id', userId);

    if (participationsError) {
      console.error('Error fetching call participations:', participationsError);
      res.status(500).json({ error: 'Failed to fetch call logs' });
      return;
    }

    const callIds = callParticipations?.map(p => p.call_id) || [];

    if (callIds.length === 0) {
      res.json({ calls: [], total: 0 });
      return;
    }

    // Get call details with logs
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        id,
        chat_id,
        initiator_id,
        type,
        status,
        start_time,
        end_time,
        chats (
          id,
          type,
          name
        ),
        call_logs (
          id,
          quality_rating,
          duration_seconds,
          created_at
        ),
        call_participants (
          user_id,
          status,
          joined_at,
          users (
            id,
            username,
            full_name,
            avatar_url
          )
        )
      `)
      .in('id', callIds)
      .order('start_time', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (callsError) {
      console.error('Error fetching calls:', callsError);
      res.status(500).json({ error: 'Failed to fetch call logs' });
      return;
    }

    // Transform data to include role (initiator/receiver)
    const callLogs = calls?.map(call => {
      const isInitiator = call.initiator_id === userId;
      
      // Get other participants (excluding current user)
      const otherParticipants = call.call_participants
        ?.filter((p: any) => p.user_id !== userId)
        .map((p: any) => ({
          userId: p.user_id,
          status: p.status,
          joinedAt: p.joined_at,
          user: p.users
        })) || [];

      return {
        id: call.id,
        chatId: call.chat_id,
        initiatorId: call.initiator_id,
        type: call.type,
        status: call.status,
        startTime: call.start_time,
        endTime: call.end_time,
        role: isInitiator ? 'initiator' : 'receiver',
        chat: call.chats,
        participants: otherParticipants,
        log: call.call_logs?.[0] || null
      };
    }) || [];

    res.json({
      calls: callLogs,
      total: callIds.length
    });
  } catch (error) {
    console.error('Get user call logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a call log entry
 * POST /api/calls/:callId/log
 */
export const createCallLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { callId } = req.params;
    const { qualityRating, durationSeconds } = req.body;

    const supabase = getSupabaseClient();

    // Verify call exists and user was a participant
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, chat_id')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Verify user was a participant
    const { data: participant, error: participantError } = await supabase
      .from('call_participants')
      .select('user_id')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'You were not a participant of this call' });
      return;
    }

    // Create or update call log
    const { data: log, error: logError } = await supabase
      .from('call_logs')
      .upsert({
        call_id: callId,
        quality_rating: qualityRating || null,
        duration_seconds: durationSeconds || null,
      }, {
        onConflict: 'call_id',
      })
      .select('*')
      .single();

    if (logError) {
      console.error('Error creating call log:', logError);
      res.status(500).json({ error: 'Failed to create call log' });
      return;
    }

    res.status(201).json({ log });
  } catch (error) {
    console.error('Create call log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
