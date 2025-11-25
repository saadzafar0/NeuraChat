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

// Load environment variables
dotenv.config();

// Initialize database
let dbInitialized = false;
try {
  initializeDatabase();
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
app.use('/api/ai', aiRoutes); // Yet to be implemented
app.use('/api/notifications', notificationRoutes); // Yet to be implemented

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

  // Handle new message
  socket.on('send-message', (message) => {
    socket.to(`chat:${message.chat_id}`).emit('new-message', message);
  });

  // Call/Video functionality - Yet to be implemented
  // WebRTC signaling events will be added here

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
║     NeuraChat Backend API Server      ║
                                  
  Port: ${PORT}                        
  Environment: ${process.env.NODE_ENV || 'development'}        
  Database: ${dbInitialized ? 'Connected ✓' : 'Not Connected ✗'}           
  `);
});

export { app, io };
export default httpServer;
