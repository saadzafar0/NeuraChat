import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import callRoutes from './routes/callRoutes';
import aiRoutes from './routes/aiRoutes';
import notificationRoutes from './routes/notificationRoutes';
import mediaRoutes from './routes/mediaRoutes';
import { generateRtcToken, generateRtmToken } from './utils/agoraToken';
import { authenticateToken } from './middleware/auth';

// Load environment variables
dotenv.config();

// Initialize database

import { supabase as exportedSupabase } from './config/database';
let dbInitialized = false;
try {
  const supabaseClient = initializeDatabase();
  // Assign to exported variable for global use
  (exportedSupabase as any) = supabaseClient;
  dbInitialized = true;
} catch (error) {
  console.error('❌ Failed to initialize database:', error);
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes); // Yet to be implemented
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes); // Yet to be implemented
app.use('/api/media', mediaRoutes);

// RTM token endpoint (authenticated)
app.get('/api/agora/rtm-token', authenticateToken, (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = generateRtmToken(userId);
    res.json({ token, appId: process.env.AGORA_APP_ID });
  } catch (error: any) {
    console.error('Failed to generate RTM token:', error);
    res.status(500).json({ error: 'Failed to generate RTM token' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// In-memory call state storage
interface CallState {
  callId: string;
  callerId: string;
  recipientId: string;
  chatId: string;
  channelName: string;
  timeout?: NodeJS.Timeout;
}

const activeCalls = new Map<string, CallState>();

// Socket.IO authentication middleware
io.use((socket: Socket, next) => {
  // Try to get token from auth object first (for Socket.IO client)
  let token = socket.handshake.auth?.token;
  
  // Fallback to cookies (for web browser)
  if (!token && socket.handshake.headers.cookie) {
    const cookies = socket.handshake.headers.cookie.split('; ');
    const tokenCookie = cookies.find((row) => row.startsWith('token='));
    if (tokenCookie) {
      token = tokenCookie.split('=')[1];
    }
  }

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { userId: string };
    socket.data.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket: Socket) => {
  const userId = socket.data.userId;
  console.log('User connected:', socket.id, 'User ID:', userId);

  // Automatically join user to their room
  socket.join(`user:${userId}`);

  // Join user to their room (backward compatibility)
  socket.on('join', (joinUserId: string) => {
    if (joinUserId === userId) {
      socket.join(`user:${joinUserId}`);
      console.log(`User ${joinUserId} joined their room`);
    }
  });

  // Join chat room
  socket.on('join-chat', (chatId: string) => {
    socket.join(`chat:${chatId}`);
    console.log(`User joined chat: ${chatId}`);
  });

  // Handle typing indicators
  socket.on('typing', ({ chatId, userId }) => {
    socket.to(`chat:${chatId}`).emit('user-typing', { userId, chatId });
  });

  socket.on('stop-typing', ({ chatId, userId }) => {
    socket.to(`chat:${chatId}`).emit('user-stop-typing', { userId, chatId });
  });

  // Handle new message via Socket.IO (saves to DB + broadcasts)
  socket.on('send-message', async (messageData) => {
    try {
      const { getSupabaseClient } = await import('./config/database');
      const supabase = getSupabaseClient();
      
      const { chat_id, sender_id, content, type = 'text' } = messageData;

      // Verify user is a participant
      const { data: participant } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('chat_id', chat_id)
        .eq('user_id', sender_id)
        .single();

      if (!participant) {
        socket.emit('error', { message: 'You are not a participant of this chat' });
        return;
      }

      // Save message to database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id,
          sender_id,
          content,
          type,
          status: 'sent',
        })
        .select('*, users(id, username, full_name, avatar_url)')
        .single();

      if (error) {
        socket.emit('error', { message: error.message });
        return;
      }

      // Broadcast to all users in the chat room (including sender)
      io.to(`chat:${chat_id}`).emit('new-message', data);

      // Send notification to all participants except the sender
      const { NotificationService } = await import('./services/Notifications/NotificationService');
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat_id)
        .neq('user_id', sender_id);

      if (participants) {
        const contentPreview = content.length > 50 ? content.substring(0, 50) + '...' : content;
        for (const participant of participants) {
          await NotificationService.createNotification({
            userId: participant.user_id,
            type: 'message',
            title: 'New Message',
            content: contentPreview,
            chatId: chat_id,
          });
        }
      }
      
    } catch (error) {
      console.error('Socket send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Call signaling events
  socket.on('call-initiate', async ({ chatId, toUserId, callId }: { chatId: string; toUserId: string; callId: string }) => {
    try {
      const channelName = `chat_${chatId}`;
      
      // Create call record in database
      const { getSupabaseClient } = await import('./config/database');
      const supabase = getSupabaseClient();
      
      const { data: call, error: callError } = await supabase
        .from('calls')
        .insert({
          id: callId,
          chat_id: chatId,
          initiator_id: userId,
          type: 'audio', // Default to audio for now
          status: 'active',
        })
        .select('*')
        .single();

      if (callError) {
        console.error('Error creating call record:', callError);
        // Continue with in-memory state for backward compatibility
      } else {
        // Add initiator as participant
        await supabase
          .from('call_participants')
          .insert({
            call_id: callId,
            user_id: userId,
            status: 'connecting',
          });
      }
      
      // Store call state (in-memory for signaling)
      const callState: CallState = {
        callId,
        callerId: userId,
        recipientId: toUserId,
        chatId,
        channelName,
      };

      // Set timeout for unanswered calls (20 seconds)
      callState.timeout = setTimeout(async () => {
        if (activeCalls.has(callId)) {
          io.to(`user:${userId}`).emit('call-rejected', { callId, reason: 'timeout' });
          activeCalls.delete(callId);
          
          // Update call status in database
          const { getSupabaseClient } = await import('./config/database');
          const supabase = getSupabaseClient();
          await supabase
            .from('calls')
            .update({
              status: 'ended',
              end_time: new Date().toISOString(),
            })
            .eq('id', callId);
        }
      }, 20000);

      activeCalls.set(callId, callState);

      // Emit incoming call to recipient
      const recipientRoom = `user:${toUserId}`;
      
      // Check if recipient is in the room
      const recipientSockets = await io.in(recipientRoom).fetchSockets();
      console.log(`Recipient room ${recipientRoom} has ${recipientSockets.length} socket(s)`);
      
      if (recipientSockets.length === 0) {
        console.warn(`⚠️ Recipient ${toUserId} is not connected or not in their room!`);
      }
      
      console.log(`Emitting incoming-call to room: ${recipientRoom}`, {
        fromUserId: userId,
        chatId,
        channelName,
        callId,
      });
      
      io.to(recipientRoom).emit('incoming-call', {
        fromUserId: userId,
        chatId,
        channelName,
        callId,
      });

      // Also emit to caller to show calling state
      io.to(`user:${userId}`).emit('call-initiated', {
        callId,
        toUserId,
        chatId,
      });

      console.log(`Call initiated: ${callId} from ${userId} to ${toUserId}`);
    } catch (error) {
      console.error('Call initiate error:', error);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  socket.on('call-accepted', async ({ chatId, callerId, callId }: { chatId: string; callerId: string; callId: string }) => {
    try {
      console.log(`📞 call-accepted received from userId: ${userId}, callerId: ${callerId}, callId: ${callId}`);
      
      // CRITICAL: Only recipient can accept (verify sender is recipient)
      if (userId === callerId) {
        console.warn(`❌ Caller ${userId} tried to accept their own call`);
        socket.emit('error', { message: 'Caller cannot accept their own call' });
        return;
      }

      const callState = activeCalls.get(callId);
      if (!callState) {
        console.warn(`❌ Call state not found for callId: ${callId}`);
        socket.emit('error', { message: 'Call not found or already ended' });
        return;
      }

      if (callState.recipientId !== userId) {
        console.warn(`❌ User ${userId} is not the recipient. Expected: ${callState.recipientId}`);
        socket.emit('error', { message: 'Only the recipient can accept the call' });
        return;
      }

      console.log(`✅ User ${userId} (recipient) is accepting call ${callId}`);

        // Clear timeout
        if (callState.timeout) {
          clearTimeout(callState.timeout);
        }

        // Update database: Add recipient as participant
        const { getSupabaseClient } = await import('./config/database');
        const supabase = getSupabaseClient();
        
        await supabase
          .from('call_participants')
          .upsert({
            call_id: callId,
            user_id: userId,
            status: 'connected',
            joined_at: new Date().toISOString(),
          }, {
            onConflict: 'call_id,user_id',
          });

        // Update caller participant status to connected
        await supabase
          .from('call_participants')
          .update({ status: 'connected' })
          .eq('call_id', callId)
          .eq('user_id', callerId);

        // Generate separate tokens for caller and recipient with unique UIDs.
        // Always use the canonical channel name from server state to avoid client
        // mismatch issues.
        const channelName = callState.channelName;

        // Persist start time if missing so duration can be computed later.
        await supabase
          .from('calls')
          .update({ start_time: new Date().toISOString() })
          .eq('id', callId);

        // Generate separate tokens for caller and recipient with unique UIDs
        const callerUid = Math.floor(Math.random() * 1000000) + 1; // Random UID for caller
        const recipientUid = Math.floor(Math.random() * 1000000) + 1; // Random UID for recipient

        const tokenCaller = generateRtcToken(channelName, callerUid);
        const tokenRecipient = generateRtcToken(channelName, recipientUid);

        // Emit tokens to respective users
        io.to(`user:${callerId}`).emit('call-accepted', {
          token: tokenCaller,
          channelName,
          callId,
          uid: callerUid,
        });

        io.to(`user:${userId}`).emit('call-accepted', {
          token: tokenRecipient,
          channelName,
          callId,
          uid: recipientUid,
        });

        // Keep in active calls for signaling (will be removed when call ends)
        // Don't delete - call is now active

      console.log(`✅ Call accepted: ${callId} by ${userId}, tokens generated and sent`);
    } catch (error) {
      console.error('Call accepted error:', error);
      socket.emit('error', { message: 'Failed to accept call' });
    }
  });

  socket.on('call-rejected', async ({ callerId, callId }: { callerId: string; callId: string }) => {
    try {
      const callState = activeCalls.get(callId);
      if (callState) {
        // Clear timeout
        if (callState.timeout) {
          clearTimeout(callState.timeout);
        }

        // Update database: Mark recipient as rejected
        const { getSupabaseClient } = await import('./config/database');
        const supabase = getSupabaseClient();
        
        await supabase
          .from('call_participants')
          .upsert({
            call_id: callId,
            user_id: userId,
            status: 'rejected',
          }, {
            onConflict: 'call_id,user_id',
          });

        // End the call
        await supabase
          .from('calls')
          .update({
            status: 'ended',
            end_time: new Date().toISOString(),
          })
          .eq('id', callId);

        // Emit rejection to caller
        io.to(`user:${callerId}`).emit('call-rejected', { callId });

        // Remove from active calls
        activeCalls.delete(callId);

        console.log(`Call rejected: ${callId} by ${userId}`);
      }
    } catch (error) {
      console.error('Call rejected error:', error);
    }
  });

  socket.on('call-ended', async ({ otherUserId, callId }: { otherUserId: string; callId: string }) => {
    try {
      // Update database: Mark all participants as left and end call
      const { getSupabaseClient } = await import('./config/database');
      const supabase = getSupabaseClient();
      
      await supabase
        .from('call_participants')
        .update({ status: 'left' })
        .eq('call_id', callId)
        .neq('status', 'left');

      // Calculate call duration
      const { data: call } = await supabase
        .from('calls')
        .select('start_time')
        .eq('id', callId)
        .single();

      const endTime = new Date();
      const durationSeconds = call?.start_time 
        ? Math.floor((endTime.getTime() - new Date(call.start_time).getTime()) / 1000)
        : null;

      await supabase
        .from('calls')
        .update({
          status: 'ended',
          end_time: endTime.toISOString(),
        })
        .eq('id', callId);

      // Create call log if duration is available
      if (durationSeconds !== null && durationSeconds > 0) {
        await supabase
          .from('call_logs')
          .upsert({
            call_id: callId,
            duration_seconds: durationSeconds,
          }, {
            onConflict: 'call_id',
          });
      }

      // Emit call ended to other user
      io.to(`user:${otherUserId}`).emit('call-ended', { callId });

      // Clean up any remaining call state
      if (activeCalls.has(callId)) {
        const callState = activeCalls.get(callId);
        if (callState?.timeout) {
          clearTimeout(callState.timeout);
        }
        activeCalls.delete(callId);
      }

      console.log(`Call ended: ${callId} by ${userId}`);
    } catch (error) {
      console.error('Call ended error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id, 'User ID:', userId);
    
    // Clean up any active calls initiated by this user
    const { getSupabaseClient } = await import('./config/database');
    const supabase = getSupabaseClient();
    
    for (const [callId, callState] of activeCalls.entries()) {
      if (callState.callerId === userId || callState.recipientId === userId) {
        if (callState.timeout) {
          clearTimeout(callState.timeout);
        }
        activeCalls.delete(callId);
        
        // Update database: Mark user as left
        await supabase
          .from('call_participants')
          .update({ status: 'left' })
          .eq('call_id', callId)
          .eq('user_id', userId);
        
        // Check if call should be ended
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
        
        // Notify the other party
        const otherUserId = callState.callerId === userId ? callState.recipientId : callState.callerId;
        io.to(`user:${otherUserId}`).emit('call-ended', { callId });
      }
    }
  });

  // File sharing events
  socket.on('file-uploaded', (fileData) => {
    // Broadcast to all users in the chat (except sender)
    socket.to(`chat:${fileData.chatId}`).emit('new-file', fileData);
  });

  socket.on('file-deleted', (fileData) => {
    // Broadcast to all users in the chat
    io.to(`chat:${fileData.chatId}`).emit('file-removed', fileData);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
║     NeuraChat Backend API Server      ║
                                  
  Port: ${PORT}                        
  Environment: ${process.env.NODE_ENV || 'development'}        
  Database: ${dbInitialized ? 'Connected ✓' : 'Not Connected ✗'}    
  AI Provider: ${process.env.AI_PROVIDER || 'gemini'}       
  `);
});

export { app, io };
export default httpServer;
