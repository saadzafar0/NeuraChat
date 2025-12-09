# NeuraChat Backend API

A comprehensive REST API for the NeuraChat messaging platform with real-time messaging and file sharing.

**✅ Implemented**: Authentication, Messaging, File Sharing, AI Features, **End-to-End Encryption (E2EE)**
**⚠️ Not Yet Implemented**: Voice/video calls

## 🔐 NEW: End-to-End Encryption (Signal Protocol)

**Signal Protocol implementation is now available!** 🎉

NeuraChat now supports industry-standard end-to-end encryption for 1-on-1 private chats.

### Quick Links
- 📖 [Complete Implementation Guide](SIGNAL_PROTOCOL_IMPLEMENTATION.md)
- ⚡ [Quick Start Guide](SIGNAL_PROTOCOL_QUICKSTART.md)
- 🚀 [5-Minute Setup](QUICK_SETUP.md)
- ✅ [Implementation Checklist](E2EE_CHECKLIST.md)

### E2EE Status
- ✅ Backend: Complete (100%)
- ✅ 1-on-1 Chats: Fully implemented
- ✅ Group Chats: Sender Keys protocol implemented
- ⏳ Frontend: Integration needed
- 🔒 Security: Industry-standard Signal Protocol

### New Encryption Endpoints

**1-on-1 Chat Encryption:**
```
POST   /api/encryption/keys              # Upload public keys
GET    /api/encryption/keys/:userId      # Get pre-key bundle  
POST   /api/encryption/rotate-prekey     # Rotate keys
POST   /api/encryption/replenish-prekeys # Replenish pre-keys
GET    /api/encryption/status            # Encryption status
POST   /api/encryption/session/:id       # Initialize session
DELETE /api/encryption/session/:id       # Delete session
GET    /api/encryption/sessions          # Get active sessions
```

**Group Chat Encryption:**
```
POST   /api/group-encryption/initialize           # Initialize group encryption
GET    /api/group-encryption/status/:groupId      # Get encryption status
POST   /api/group-encryption/rotate-sender-key/:groupId  # Rotate sender key
POST   /api/group-encryption/member-added         # Handle member added
POST   /api/group-encryption/member-removed       # Handle member removed
POST   /api/group-encryption/rotate-all/:groupId  # Rotate all keys (admin)
POST   /api/group-encryption/encrypt              # Encrypt message (test)
POST   /api/group-encryption/decrypt              # Decrypt message (test)
```

---

## Tech Stack

- **Runtime**: Node.js (v18+) with TypeScript (v5.3.3)
- **Framework**: Express.js (v4.18.2)
- **Database**: Supabase (PostgreSQL) - @supabase/supabase-js (v2.39.0)
- **Storage**: Supabase Storage - File uploads and media management
- **Authentication**: JWT (jsonwebtoken v9.0.2) + Cookie-based sessions
- **Real-time**: Socket.IO (v4.6.1) - WebSocket communication
- **File Upload**: multer (v1.4.5-lts.1) + mime-types (v2.1.35)
- **Security**:
  - bcrypt (v5.1.1) - Password hashing
  - cookie-parser (v1.4.6) - Cookie management
  - CORS (v2.8.5) - Cross-origin resource sharing
- **Validation**: express-validator (v7.0.1)
- **Development Tools**:
  - ts-node (v10.9.2) - TypeScript execution
  - nodemon (v3.0.2) - Auto-restart on file changes

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration (for cookie-based authentication)
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

**Important Notes:**

- `JWT_SECRET`: Use a strong, random secret in production (min 32 characters)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: Get these from your Supabase project settings
- `NODE_ENV`: Set to `production` in production environments

**Supabase Storage Setup (Required for File Sharing):**

1. Go to your Supabase project dashboard
2. Navigate to **Storage** section
3. Create a new bucket named `chat-media`
4. Set bucket to **Public** (Settings → Make bucket public)
5. This allows file uploads and downloads to work properly
6. Run the development server:

```bash
npm run dev
```

The server will start on `http://localhost:5000` with:

- Hot-reload enabled (nodemon watches for file changes)
- TypeScript compilation on-the-fly (ts-node)
- Socket.IO WebSocket server running
- Database connection initialized

5. Build for production:

```bash
npm run build  # Compiles TypeScript to JavaScript in /dist
npm start      # Runs the compiled JavaScript
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server (requires build first)

## API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication

All authenticated endpoints use **cookie-based authentication**. The JWT token is automatically stored in an httpOnly cookie after login/register and sent with subsequent requests.

**Important**: When making requests from a client, ensure you include credentials:

- Fetch API: `credentials: 'include'`
- Axios: `withCredentials: true`

### Authentication Endpoints

#### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "username": "johndoe",
  "full_name": "John Doe"
}
```

**Response**: Sets httpOnly cookie with JWT token and returns user data.

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: Sets httpOnly cookie with JWT token and returns user data.

#### Logout

```http
POST /api/auth/logout
```

**Response**: Clears the authentication cookie.

#### Get Current User

```http
GET /api/auth/me
```

**Note**: All endpoints below require authentication (cookie must be present).

### User Endpoints

#### Get User Profile

```http
GET /api/users/profile/:userId

```

#### Update Profile

```http
PUT /api/users/profile

Content-Type: application/json

{
  "username": "newusername",
  "full_name": "New Name",
  "avatar_url": "https://...",
  "status_message": "Hey there!"
}
```

#### Search Users

```http
GET /api/users/search?query=john

```

### Chat Endpoints

#### Create Chat

```http
POST /api/chats

Content-Type: application/json

{
  "type": "private",
  "participants": ["user-id-1", "user-id-2"]
}
```

#### Get User Chats

```http
GET /api/chats

```

#### Get Chat Details

```http
GET /api/chats/:chatId

```

### Message Endpoints

#### Send Message

**Note**: Sending messages is done via Socket.IO only (see WebSocket Events section below)

Use Socket.IO to send messages:

```javascript
socket.emit('send-message', {
  chat_id: 'chat-123',
  sender_id: 'user-456',
  content: 'Hello, World!',
  type: 'text'
});
```

#### Get Chat Messages

```http
GET /api/messages/:chatId?limit=50&offset=0

```

#### Edit Message

```http
PUT /api/messages/:messageId

Content-Type: application/json

{
  "content": "Updated message"
}
```

#### Delete Message

```http
DELETE /api/messages/:messageId

```

### Media/File Sharing Endpoints

#### Upload File

Upload a file to a chat (images, videos, documents, etc.)

```http
POST /api/media/upload
Content-Type: multipart/form-data

Form Fields:
- file: <file data>
- chatId: "chat-uuid"
- messageContent: "Check out this file!" (optional)
```

**JavaScript Example:**

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('chatId', 'chat-123');
formData.append('messageContent', 'Optional message');

fetch('/api/media/upload', {
  method: 'POST',
  credentials: 'include',
  body: formData
});
```

**Restrictions:**

- Max file size: 50MB
- Allowed types: images, videos, audio, documents, archives
- User must be a chat participant

**Response:** Returns file metadata, storage URL, and optional message data

#### Get Chat Media

```http
GET /api/media/chat/:chatId?type=image&limit=50&offset=0

Query Parameters:
- type: Filter by type (image, video, audio, document, file)
- limit: Number of files (default: 50)
- offset: Pagination offset (default: 0)
```

#### Get Media Statistics

```http
GET /api/media/chat/:chatId/stats

Returns counts by file type and total storage used
```

#### Get File Details

```http
GET /api/media/:fileId

```

#### Download File

```http
GET /api/media/:fileId/download

Returns download URL and file metadata
```

#### Delete File

```http
DELETE /api/media/:fileId

Only uploader or chat admin can delete
```

### Call Endpoints

**Note**: Voice/Video call functionality is yet to be implemented.

All call endpoints will return:

```json
{
  "error": "Call functionality yet to be implemented"
}
```

Status Code: `501 Not Implemented`

### AI Endpoints

All AI endpoints are protected and require authentication. They are routed under `/api/ai`.
These endpoints allow for dynamic model selection by passing an optional `model` field in the request body. If omitted, the default model configured on the server is used.

#### Get Available Models

Fetches a list of AI models available from the configured provider.

```http
GET /api/ai/models
```

**Response**:

```json
{
  "models": ["gemini-1.5-flash", "deepseek-coder", "llama3"]
}
```

---

#### Correct Grammar

Corrects grammar and spelling mistakes in the provided text.

```http
POST /api/ai/grammar
Content-Type: application/json

{
  "text": "Me want go store now.",
  "model": "gemini-1.5-flash"
}
```

**Response**:

```json
{
  "corrected": "I want to go to the store now."
}
```

---

#### Summarize Text

Generates a concise, single-sentence summary of the provided text.

```http
POST /api/ai/summarize
Content-Type: application/json

{
  "text": "NeuraChat is a new application that uses AI to help people communicate better. It has features like grammar correction and summarization."
}
```

**Response**:

```json
{
  "summary": "NeuraChat is an AI-powered application designed to improve communication through features like grammar correction and summarization."
}
```

---

#### Enhance Text

Rewrites text to be more clear, concise, and professional without changing the meaning.

```http
POST /api/ai/enhance
Content-Type: application/json

{
  "text": "hey i think maybe we should prolly delay the meetin cuz im busy"
}
```

**Response**:

```json
{
  "enhanced": "I propose we delay the meeting, as I have a scheduling conflict."
}
```

---

#### Expand Text

Expands a short input into a more detailed, well-structured paragraph.

```http
POST /api/ai/expand
Content-Type: application/json

{
  "text": "Project delayed. Supply chain issues."
}
```

**Response**:

```json
{
  "expanded": "The project timeline has been delayed due to unforeseen supply chain disruptions. We are actively monitoring the situation and will provide a revised schedule as soon as possible."
}
```

---

#### Change Tone

Rewrites text to adopt a specific tone.

```http
POST /api/ai/tone
Content-Type: application/json

{
  "text": "You missed the deadline. Fix it.",
  "tone": "empathetic"
}
```

**Body Parameters**:

- `tone` (string, required): The target tone. Options: `casual`, `formal`, `empathetic`.

**Response**:

```json
{
  "rewritten": "I noticed the deadline was missed. Let's touch base to see how we can work together to get this completed."
}
```

---

#### Translate Text

Translates text into a target language.

```http
POST /api/ai/translate
Content-Type: application/json

{
  "text": "Hello, welcome to NeuraChat.",
  "targetLang": "Spanish"
}
```

**Body Parameters**:

- `targetLang` (string, required): The language to translate the text into.

**Response**:

```json
{
  "translated": "Hola, bienvenido a NeuraChat."
}
```

---

#### AI Agent Chat

Engages in a conversational chat with the AI, maintaining context within a session.

```http
POST /api/ai/chat
Content-Type: application/json

{
  "sessionId": "session-12345",
  "query": "What was the last thing I asked you?"
}
```

**Body Parameters**:

- `sessionId` (string, required): A unique identifier for the conversation session. The server uses this to retrieve recent chat history.
- `query` (string, required): The user's new message or question.

**Response**:

```json
{
  "response": "You previously asked me about the project timeline."
}
```

### Notification Endpoints

**Note**: Notification functionality is yet to be implemented.

All notification endpoints will return:

```json
{
  "error": "Notification functionality yet to be implemented"
}
```

Status Code: `501 Not Implemented`

## Messaging Architecture

NeuraChat uses **Socket.IO for sending messages** with database persistence for optimal real-time messaging:

### How It Works

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │
       ├──► REST API (HTTP)
       │    - Fetch message history
       │    - Edit/Delete messages
       │    - User/Chat management
       │
       └──► Socket.IO (WebSocket)
            - Send messages (saves to DB + broadcasts)
            - Real-time message updates
            - Typing indicators
```

**Key Features:**

- ✅ **Socket.IO for Sending**: All new messages sent via WebSocket only
- ✅ **Database Persistence**: Messages automatically saved to Supabase
- ✅ **Real-time Broadcasts**: All chat participants receive messages instantly
- ✅ **Authentication Enforced**: WebSocket validates chat participation
- ✅ **Message History**: Retrieve past messages via REST API

### Sending Messages (Socket.IO Only)

To send a new message, use Socket.IO:

```javascript
// Connect to Socket.IO
const socket = io('http://localhost:5000');

// Join the chat room
socket.emit('join-chat', 'chat-123');

// Send message via Socket.IO
socket.emit('send-message', {
  chat_id: 'chat-123',
  sender_id: 'user-456',
  content: 'Hello!',
  type: 'text'
});
// ✅ Authenticates sender
// ✅ Saves to database
// ✅ Broadcasts to all chat participants
```

### Why Socket.IO Only for Sending?

- **Simpler Architecture**: One path for sending messages
- **Real-time by Design**: WebSocket is built for instant communication
- **Lower Latency**: No HTTP overhead for message delivery
- **Consistent Flow**: All real-time features use Socket.IO

### REST API for Everything Else

REST API handles non-real-time operations:

```javascript
// Fetch message history (REST)
const messages = await fetch('http://localhost:5000/api/messages/chat-123?limit=50', {
  credentials: 'include'
});

// Edit a message (REST)
await fetch('http://localhost:5000/api/messages/msg-123', {
  method: 'PUT',
  credentials: 'include',
  body: JSON.stringify({ content: 'Updated message' })
});
// ✅ Updates database
// ✅ Emits 'message-updated' via Socket.IO

// Delete a message (REST)
await fetch('http://localhost:5000/api/messages/msg-123', {
  method: 'DELETE',
  credentials: 'include'
});
// ✅ Removes from database
// ✅ Emits 'message-deleted' via Socket.IO
```

**Result:** Clean separation - Socket.IO for sending, REST for everything else!

## WebSocket Events (Socket.IO)

The server supports real-time communication via Socket.IO on the same port as the HTTP server.

**Connection URL**: `http://localhost:5000`

### Client Events (Emit from client)


| Event          | Payload                                                                 | Description                                    |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `join`         | `{ userId: string }`                                                    | Join user's personal room for notifications    |
| `join-chat`    | `{ chatId: string }`                                                    | Join a specific chat room                      |
| `typing`       | `{ chatId: string, userId: string }`                                    | Broadcast typing indicator                     |
| `stop-typing`  | `{ chatId: string, userId: string }`                                    | Stop typing indicator                          |
| `send-message` | `{ chat_id: string, sender_id: string, content: string, type: string }` | Send new message (authenticates & saves to DB) |

**Note**: Call/Video functionality (call-user, answer-call, ice-candidate, end-call events) - Yet to be implemented

### Server Events (Listen on client)


| Event              | Payload                                                  | Description                                      |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| `connection`       | `{ id: string }`                                         | Socket connected successfully                    |
| `new-message`      | `{ id, chat_id, sender_id, content, users: {...}, ... }` | New message received (from REST or Socket.IO)    |
| `message-updated`  | `{ id, chat_id, content, updated_at }`                   | Message was edited                               |
| `message-deleted`  | `{ messageId: string }`                                  | Message was deleted                              |
| `new-file`         | `{ file, message, uploadedBy }`                          | New file uploaded to chat                        |
| `file-removed`     | `{ fileId, chatId, deletedBy }`                          | File deleted from chat                           |
| `user-typing`      | `{ userId: string, chatId: string }`                     | User started typing                              |
| `user-stop-typing` | `{ userId: string, chatId: string }`                     | User stopped typing                              |
| `error`            | `{ message: string }`                                    | Error occurred (e.g., unauthorized, not in chat) |
| `disconnect`       | `{}`                                                     | Socket disconnected                              |

**Note**: Call/Video server events (incoming-call, call-answered, ice-candidate, call-ended) - Yet to be implemented

### Example Usage

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  withCredentials: true
});

// Join user room
socket.emit('join', 'user-123');

// Join chat room
socket.emit('join-chat', 'chat-456');

// Listen for new messages (from REST API or Socket.IO)
socket.on('new-message', (message) => {
  console.log('New message:', message);
  // message includes: { id, chat_id, sender_id, content, type, status, users: { username, full_name, avatar_url }, created_at, updated_at }
});

// Listen for message updates
socket.on('message-updated', (message) => {
  console.log('Message edited:', message);
});

// Listen for message deletions
socket.on('message-deleted', ({ messageId }) => {
  console.log('Message deleted:', messageId);
});

// Listen for file uploads
socket.on('new-file', (data) => {
  console.log('New file uploaded:', data.file);
  // data includes: { file, message, uploadedBy }
});

// Listen for file deletions
socket.on('file-removed', (data) => {
  console.log('File removed:', data.fileId);
  // data includes: { fileId, chatId, deletedBy }
});

// Listen for errors
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
});

// Send message via Socket.IO (also saves to database)
socket.emit('send-message', {
  chat_id: 'chat-456',
  sender_id: 'user-123',
  content: 'Hello!',
  type: 'text'
});

// Send typing indicator
socket.emit('typing', { chatId: 'chat-456', userId: 'user-123' });
```

## Database Schema

The API uses the following Supabase (PostgreSQL) tables:

### Core Tables

- **`users`** - User profiles and authentication

  - `id` (uuid, primary key)
  - `email` (text, unique)
  - `username` (text, unique)
  - `full_name` (text)
  - `avatar_url` (text, nullable)
  - `status_message` (text, nullable)
  - `last_seen` (timestamp)
  - `created_at` (timestamp)
- **`chats`** - Chat rooms (private/group)

  - `id` (uuid, primary key)
  - `type` (enum: 'private' | 'group')
  - `name` (text, nullable - for group chats)
  - `created_at` (timestamp)
- **`chat_participants`** - Chat membership relationships

  - `id` (uuid, primary key)
  - `chat_id` (uuid, foreign key → chats)
  - `user_id` (uuid, foreign key → users)
  - `role` (enum: 'admin' | 'member')
  - `joined_at` (timestamp)
- **`messages`** - Chat messages

  - `id` (uuid, primary key)
  - `chat_id` (uuid, foreign key → chats)
  - `sender_id` (uuid, foreign key → users)
  - `content` (text)
  - `type` (enum: 'text' | 'media' | 'system')
  - `status` (enum: 'sent' | 'delivered' | 'read')
  - `reply_to` (uuid, nullable, foreign key → messages)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- **`media_files`** - Media attachments and file sharing

  - `id` (uuid, primary key)
  - `message_id` (uuid, nullable, foreign key → messages)
  - `chat_id` (uuid, foreign key → chats)
  - `file_name` (text)
  - `file_type` (text) - Category: image, video, audio, document, file
  - `file_size` (integer) - Size in bytes
  - `mime_type` (text) - MIME type
  - `storage_url` (text) - Public URL from Supabase Storage
  - `storage_path` (text) - Internal storage path
  - `thumbnail_url` (text, nullable) - Thumbnail for images/videos
  - `uploaded_by` (uuid, foreign key → users)
  - `upload_status` (enum: 'pending' | 'uploading' | 'completed' | 'failed')
  - `created_at` (timestamp)
  - `uploaded_at` (timestamp)

### Call Management Tables

**Note**: Call functionality yet to be implemented. The following schema is for future use.

- **`calls`** - Voice/Video call sessions

  - `id` (uuid, primary key)
  - `chat_id` (uuid, foreign key → chats)
  - `initiator_id` (uuid, foreign key → users)
  - `type` (enum: 'audio' | 'video')
  - `status` (enum: 'active' | 'ended')
  - `start_time` (timestamp)
  - `end_time` (timestamp, nullable)
- **`call_participants`** - Participants in calls

  - `id` (uuid, primary key)
  - `call_id` (uuid, foreign key → calls)
  - `user_id` (uuid, foreign key → users)
  - `joined_at` (timestamp)
  - `left_at` (timestamp, nullable)
- **`call_logs`** - Call quality and metadata

  - `id` (uuid, primary key)
  - `call_id` (uuid, foreign key → calls)
  - `user_id` (uuid, foreign key → users)
  - `connection_quality` (text)
  - `duration` (integer)
  - `created_at` (timestamp)

### AI Agent Tables

- **`ai_agent_sessions`** - AI conversation sessions

  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key → users)
  - `title` (text, nullable)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- **`ai_interactions`** - AI conversation history
  **Note**: The `ai_interactions` table is actively used for storing AI chat session history.

  - `id` (uuid, primary key)
  - `session_id` (uuid, foreign key → ai_agent_sessions)
  - `user_query` (text)
  - `ai_response` (text)
  - `intent` (enum: 'info' | 'writing' | 'productivity', nullable)
  - `created_at` (timestamp)

### Notification & Security Tables

**Note**: Notification functionality yet to be implemented. The following schema is for future use.

- **`notifications`** - User notifications

  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key → users)
  - `title` (text)
  - `content` (text, nullable)
  - `type` (enum: 'message' | 'call' | 'system')
  - `is_read` (boolean, default: false)
  - `created_at` (timestamp)
- **`encryption_keys`** - End-to-end encryption keys (for future E2EE support)

  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key → users)
  - `public_key` (text)
  - `created_at` (timestamp)

**Note**: You need to create these tables in your Supabase project. Row Level Security (RLS) policies should be configured for production use.

## Error Handling

The API uses standard HTTP status codes with consistent JSON error responses:

**Status Codes:**

- `200` - Success (GET, PUT requests)
- `201` - Created (POST requests)
- `400` - Bad Request (Invalid input/validation errors)
- `401` - Unauthorized (Missing or invalid authentication)
- `403` - Forbidden (Valid auth but insufficient permissions)
- `404` - Not Found (Resource doesn't exist)
- `500` - Internal Server Error (Server-side errors)

**Error Response Format:**

```json
{
  "error": "Error message describing what went wrong"
}
```

**Development Mode:**
In development (`NODE_ENV=development`), error responses include detailed stack traces and error messages for debugging.

## Security

- **Cookie-Based Authentication**: All endpoints use JWT tokens stored in httpOnly cookies
  - **HttpOnly**: Cookies cannot be accessed by JavaScript (XSS protection)
  - **Secure**: Cookies only sent over HTTPS in production
  - **SameSite Strict**: Prevents CSRF attacks
  - **Automatic**: Browser automatically includes cookies in requests
- **Password Security**: All passwords are hashed using bcrypt before storage
- **CORS**: Configured for frontend access with credentials support
- **Environment Variables**: All sensitive configuration stored securely
- **Input Validation**: Request data validated and sanitized
- **JWT Expiration**: Tokens expire after 7 days by default

### Making Authenticated Requests

When using the API from a client application, ensure credentials are included:

**Fetch API:**

```javascript
fetch('http://localhost:5000/api/users/profile', {
  credentials: 'include'
})
```

**Axios:**

```javascript
axios.get('http://localhost:5000/api/users/profile', {
  withCredentials: true
})
```

## Development

### Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts              # Supabase client singleton initialization
│   ├── controllers/
│   │   ├── authController.ts        # Authentication endpoints (register, login, logout)
│   │   ├── userController.ts        # User profile management
│   │   ├── chatController.ts        # Chat room operations
│   │   ├── messageController.ts     # Message CRUD operations
│   │   ├── callController.ts        # Voice/video call management
│   │   ├── aiController.ts          # AI agent interactions
│   │   ├── mediaController.ts       # File upload and media management
│   │   └── notificationController.ts # User notifications
│   ├── middleware/
│   │   └── auth.ts                  # JWT cookie authentication middleware
│   ├── routes/
│   │   ├── authRoutes.ts            # Auth endpoint routes
│   │   ├── userRoutes.ts            # User endpoint routes
│   │   ├── chatRoutes.ts            # Chat endpoint routes
│   │   ├── messageRoutes.ts         # Message endpoint routes
│   │   ├── callRoutes.ts            # Call endpoint routes
│   │   ├── aiRoutes.ts              # AI endpoint routes
│   │   ├── mediaRoutes.ts           # Media/file sharing routes
│   │   └── notificationRoutes.ts    # Notification endpoint routes
│   ├── services/
│   │   └── storageService.ts        # Supabase Storage file operations
│   ├── config/
│   │   ├── database.ts              # Supabase client singleton
│   │   └── multer.ts                # File upload configuration
│   ├── types/
│   │   └── index.ts                 # TypeScript type definitions
│   └── server.ts                    # Express app & Socket.IO server setup
├── dist/                             # Compiled JavaScript (after build)
├── node_modules/                     # Dependencies
├── .env                              # Environment variables (not in git)
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── package.json                      # NPM dependencies and scripts
├── tsconfig.json                     # TypeScript compiler configuration
├── nodemon.json                      # Nodemon configuration for dev mode
└── README.md                         # This file
```

### TypeScript Types

All TypeScript types are defined in `src/types/index.ts`:

```typescript
type User = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status_message?: string;
  last_seen: Date;
  created_at: Date;
};

type Chat = {
  id: string;
  type: 'private' | 'group';
  name?: string;
  created_at: Date;
};

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'media' | 'system';
  status: 'sent' | 'delivered' | 'read';
  created_at: Date;
  updated_at: Date;
};

type AuthRequest = Request & {
  userId?: string;
};
```

### Architecture Patterns

- **Singleton Pattern**: Database client initialized once on server startup
- **MVC Pattern**: Separation of routes, controllers, and data access
- **Middleware Pattern**: Authentication middleware applied to protected routes
- **Type Safety**: Full TypeScript coverage with strict mode enabled
- **Functional Approach**: Using `type` instead of `interface` for consistency

### Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Nodemon detects** file changes automatically
3. **ts-node compiles** and runs TypeScript on-the-fly
4. **Server restarts** with your changes
5. **Test endpoints** using your preferred API client

### Configuration Files

**`tsconfig.json`** - TypeScript compiler options:

- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps for debugging
- Output directory: `./dist`

**`nodemon.json`** - Development server configuration:

- Watches: `src/**/*.ts`
- Executor: `ts-node src/server.ts`
- Auto-restart on file changes

**`package.json`** - Scripts:

- `dev`: Start development server with nodemon
- `build`: Compile TypeScript to JavaScript
- `start`: Run production server from compiled code

### Adding New Features

1. **Create types** in `src/types/index.ts`
2. **Create controller** in `src/controllers/`
3. **Create routes** in `src/routes/`
4. **Register routes** in `src/server.ts`
5. **Test endpoints** with authentication

Example:

```typescript
// 1. Add type
type Feature = {
  id: string;
  name: string;
};

// 2. Create controller
export const getFeature = async (req: AuthRequest, res: Response) => {
  const supabase = getSupabaseClient();
  // Implementation
};

// 3. Create route
router.get('/feature/:id', authenticateToken, getFeature);

// 4. Register in server.ts
import featureRoutes from './routes/featureRoutes';
app.use('/api/features', featureRoutes);
```
