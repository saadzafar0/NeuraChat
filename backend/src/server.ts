import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import callRoutes from './routes/callRoutes';
import aiRoutes from './routes/aiRoutes';
import notificationRoutes from './routes/notificationRoutes';
import mediaRoutes from './routes/mediaRoutes';
import encryptionRoutes from './routes/encryptionRoutes';
import groupEncryptionRoutes from './routes/groupEncryptionRoutes';

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
app.use('/api/notifications', notificationRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/encryption', encryptionRoutes);
app.use('/api/group-encryption', groupEncryptionRoutes);

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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their room
  socket.on('join', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their room`);
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
          });
        }
      }
      
    } catch (error) {
      console.error('Socket send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Call/Video functionality - Yet to be implemented
  // WebRTC signaling events will be added here

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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
