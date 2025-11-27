# Socket.IO Real-Time Messaging Setup

## 📡 Overview

The NeuraChat frontend now supports real-time messaging using Socket.IO. This guide explains how the frontend integrates with your backend's Socket.IO server.

## 🔧 Frontend Setup

### 1. Install Socket.IO Client

```bash
cd frontend
npm install socket.io-client
```

### 2. File Structure

New files added:
- `src/lib/socket.ts` - Socket.IO client wrapper
- `src/components/NewChatModal.tsx` - New chat creation modal
- Updated `src/app/dashboard/page.tsx` - Real-time chat interface

### 3. Socket Client Usage

The `socketClient` in `src/lib/socket.ts` provides methods for:

```typescript
// Connection
socketClient.connect(token)
socketClient.disconnect()

// Chat rooms
socketClient.joinChat(chatId)
socketClient.leaveChat(chatId)

// Send messages
socketClient.sendMessage({ chatId, content, type })

// Listen for events
socketClient.onNewMessage(callback)
socketClient.onMessageUpdated(callback)
socketClient.onMessageDeleted(callback)

// Typing indicators
socketClient.startTyping(chatId)
socketClient.stopTyping(chatId)
```

## 🔐 Backend Socket.IO Configuration

Your backend needs Socket.IO server configured. Here's what's expected:

### Authentication

The socket client connects with authentication:

```typescript
io(SOCKET_URL, {
  auth: { token },  // JWT token
  transports: ['websocket', 'polling'],
});
```

**Backend should:**
1. Verify JWT token from `socket.handshake.auth.token` OR from cookies
2. Store `socket.userId` for the authenticated user
3. Handle authorization for chat rooms

### Expected Socket Events

#### Client → Server (Emit)

| Event | Data | Description |
|-------|------|-------------|
| `join-chat` | `chatId: string` | Join a chat room |
| `leave-chat` | `chatId: string` | Leave a chat room |
| `send-message` | `{ chatId, content, type }` | Send a message |
| `typing` | `chatId: string` | User started typing |
| `stop-typing` | `chatId: string` | User stopped typing |

#### Server → Client (Listen)

| Event | Data | Description |
|-------|------|-------------|
| `new-message` | `Message` object | New message in chat |
| `message-updated` | `Message` object | Message was edited |
| `message-deleted` | `{ messageId }` | Message was deleted |
| `user-typing` | `{ userId, username }` | User is typing |
| `user-stopped-typing` | `{ userId }` | User stopped typing |
| `connect` | - | Socket connected |
| `disconnect` | - | Socket disconnected |
| `connect_error` | `error` | Connection error |

### Example Backend Socket Handler

```typescript
// backend/src/server.ts
import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
});

// Authentication middleware
io.use((socket, next) => {
  // Option 1: From auth header
  const token = socket.handshake.auth.token;
  
  // Option 2: From cookies (better for web)
  // const token = socket.handshake.headers.cookie
  //   ?.split('; ')
  //   .find(row => row.startsWith('token='))
  //   ?.split('=')[1];

  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    socket.data.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log('User connected:', userId);

  // Join chat room
  socket.on('join-chat', async (chatId: string) => {
    // Verify user is participant
    const isParticipant = await checkChatParticipant(chatId, userId);
    if (isParticipant) {
      socket.join(`chat:${chatId}`);
      console.log(`User ${userId} joined chat ${chatId}`);
    }
  });

  // Leave chat room
  socket.on('leave-chat', (chatId: string) => {
    socket.leave(`chat:${chatId}`);
  });

  // Send message
  socket.on('send-message', async (data: { chatId: string; content: string; type?: string }) => {
    try {
      // Save message to database
      const message = await saveMessage({
        chat_id: data.chatId,
        sender_id: userId,
        content: data.content,
        type: data.type || 'text',
      });

      // Emit to all users in the chat room
      io.to(`chat:${data.chatId}`).emit('new-message', message);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators
  socket.on('typing', (chatId: string) => {
    socket.to(`chat:${chatId}`).emit('user-typing', {
      userId,
      username: socket.data.username,
    });
  });

  socket.on('stop-typing', (chatId: string) => {
    socket.to(`chat:${chatId}`).emit('user-stopped-typing', { userId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', userId);
  });
});

// Start server with Socket.IO
httpServer.listen(PORT, () => {
  console.log(`Server with Socket.IO running on port ${PORT}`);
});
```

## 🎯 Frontend Flow

### 1. Connection Flow

```
User logs in
  ↓
AuthContext sets user
  ↓
Dashboard mounts
  ↓
socketClient.connect(token)
  ↓
Socket connects to backend
  ↓
Setup event listeners
```

### 2. Sending Messages

```
User types message → clicks Send
  ↓
socketClient.sendMessage({ chatId, content })
  ↓
Backend receives 'send-message' event
  ↓
Backend saves to database
  ↓
Backend emits 'new-message' to chat room
  ↓
All clients in room receive message
  ↓
Frontend updates messages state
  ↓
UI shows new message
```

### 3. Creating Chats

```
User clicks "New Chat"
  ↓
Modal opens with user search
  ↓
User selects participants
  ↓
API: POST /chats
  ↓
Backend creates chat
  ↓
Modal closes, chat list refreshes
  ↓
New chat appears in list
```

## 🔍 Debugging

### Frontend Console Logs

The socket client logs connection events:
- "Socket connected: {socketId}"
- "Socket disconnected"
- "Socket connection error: {error}"

### Check Connection Status

```javascript
// In browser console
window.socketStatus = socketClient.isConnected();
console.log('Socket connected:', window.socketStatus);
```

### Common Issues

**Issue: Socket not connecting**
- Check backend Socket.IO server is running
- Verify CORS allows credentials
- Check JWT token is valid

**Issue: Messages not appearing**
- Check socket is connected
- Verify user joined chat room with `join-chat` event
- Check backend emits to correct room: `chat:${chatId}`

**Issue: Authentication fails**
- Verify JWT token format
- Check token is sent in auth header or cookies
- Verify JWT_SECRET matches backend

## 📊 Message Flow Diagram

```
Frontend Dashboard
    ↓
  [User types message]
    ↓
socketClient.sendMessage()
    ↓
  emit('send-message')
    ↓
Backend Socket Handler
    ↓
Save to Supabase messages table
    ↓
io.to('chat:123').emit('new-message', message)
    ↓
All clients in chat:123 room
    ↓
onNewMessage() callback
    ↓
Update messages state
    ↓
Re-render chat UI
```

## ✅ Testing Checklist

- [ ] Socket connects on dashboard mount
- [ ] Can create new private chat
- [ ] Can create new group chat
- [ ] Chat appears in chat list after creation
- [ ] Can select chat and view empty state
- [ ] Can send message in chat
- [ ] Message appears in real-time
- [ ] Other users receive message (test with 2 browsers)
- [ ] Typing indicators work
- [ ] Messages persist after refresh
- [ ] Socket disconnects on logout
- [ ] Error handling works for failed sends

## 🚀 Next Steps

1. **Test with multiple users**: Open 2 browser windows/tabs
2. **Add message status**: Implement delivered/read receipts
3. **Add media support**: Implement file uploads
4. **Add notifications**: Notify users of new messages
5. **Add online status**: Show who's online in real-time

---

**Note**: This setup assumes your backend already has Socket.IO configured. If not, you'll need to add Socket.IO server to your Express backend as shown in the example above.