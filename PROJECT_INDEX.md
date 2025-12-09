# NeuraChat Project Index

## 📋 Project Overview

NeuraChat is a modern, AI-powered messaging platform built with a full-stack TypeScript architecture. It features real-time messaging, AI agent capabilities, and a comprehensive REST API with WebSocket support.

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js with TypeScript (v5.3.3)
- Express.js (v4.18.2) - REST API framework
- Socket.IO (v4.6.1) - Real-time WebSocket communication
- Supabase (PostgreSQL) - Database
- JWT + Cookie-based authentication
- Multi-provider AI integration (Gemini, HuggingFace, Ollama)

**Frontend:**
- Next.js 15.5 with App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Socket.IO Client for real-time features

## 📁 Project Structure

```
NeuraChat/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts     # Supabase client singleton
│   │   ├── controllers/        # Request handlers
│   │   │   ├── authController.ts
│   │   │   ├── userController.ts
│   │   │   ├── chatController.ts
│   │   │   ├── messageController.ts
│   │   │   ├── callController.ts (not implemented)
│   │   │   ├── aiController.ts
│   │   │   └── notificationController.ts (not implemented)
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT cookie authentication
│   │   ├── routes/             # API route definitions
│   │   │   ├── authRoutes.ts
│   │   │   ├── userRoutes.ts
│   │   │   ├── chatRoutes.ts
│   │   │   ├── messageRoutes.ts
│   │   │   ├── callRoutes.ts
│   │   │   ├── aiRoutes.ts
│   │   │   └── notificationRoutes.ts
│   │   ├── services/
│   │   │   └── ai/             # AI service layer
│   │   │       ├── AIService.ts
│   │   │       ├── adapters/   # AI provider adapters
│   │   │       │   ├── GeminiAdapter.ts
│   │   │       │   ├── HuggingFaceAdapter.ts
│   │   │       │   └── OllamaAdapter.ts
│   │   │       ├── agent/      # Agentic copilot
│   │   │       │   ├── AgentService.ts
│   │   │       │   ├── history/
│   │   │       │   │   └── SupabaseHistory.ts
│   │   │       │   └── tools/
│   │   │       │       └── index.ts
│   │   │       ├── config/
│   │   │       │   └── prompts.ts
│   │   │       └── interfaces/
│   │   │           └── AIProvider.ts
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript type definitions
│   │   └── server.ts           # Express app + Socket.IO setup
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── layout.tsx     # Root layout with AuthProvider
│   │   │   ├── page.tsx       # Home page
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx   # Main chat dashboard
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   ├── calls/
│   │   │   │   └── page.tsx
│   │   │   └── ai-agent/
│   │   │       └── page.tsx
│   │   ├── components/        # React components
│   │   │   ├── AuthGuard.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── NewChatModal.tsx
│   │   │   ├── DeleteConfirmationModal.tsx
│   │   │   └── AIMessageAssistant.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Global auth state
│   │   ├── lib/
│   │   │   ├── api.ts         # REST API client
│   │   │   └── socket.ts     # Socket.IO client wrapper
│   │   └── types/
│   │       └── global.d.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
└── NeuraChat SDA/            # Project documentation
    ├── Phase1/               # UML diagrams, use cases
    ├── Phase2/               # EERD, sequence diagrams
    ├── Phase3/               # Implementation docs
    └── Proposal/             # PRD and proposals
```

## 🔑 Key Features

### ✅ Implemented

1. **Authentication System**
   - JWT-based authentication with httpOnly cookies
   - Registration, login, logout
   - Protected routes with middleware
   - Session restoration

2. **User Management**
   - User profiles with avatar and status
   - User search functionality
   - Contact management

3. **Chat System**
   - Private and group chats
   - Chat creation and management
   - Real-time messaging via Socket.IO
   - Message history via REST API
   - Message editing and deletion

4. **Real-time Communication**
   - Socket.IO WebSocket server
   - Real-time message delivery
   - Typing indicators
   - Message status updates

5. **AI Features**
   - Multi-provider AI support (Gemini, HuggingFace, Ollama)
   - Grammar correction
   - Text summarization
   - Message enhancement/expansion
   - Tone adjustment
   - Translation
   - AI agent chat with session history
   - Agentic copilot with tools

### 🚧 Not Yet Implemented

1. **Call System** - Voice/video call functionality
2. **Notifications** - Push notifications system
3. **Media Upload** - File/media attachment support

## 🗄️ Database Schema

### Core Tables

- **users** - User profiles and authentication
- **chats** - Chat rooms (private/group)
- **chat_participants** - Chat membership
- **messages** - Chat messages
- **media_files** - Media attachments

### AI Tables

- **ai_agent_sessions** - AI conversation sessions
- **ai_interactions** - AI conversation history

### Future Tables

- **calls** - Voice/video call sessions
- **call_participants** - Call participants
- **call_logs** - Call quality metrics
- **notifications** - User notifications
- **encryption_keys** - E2EE keys (future)

## 🔌 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /me` - Get current user

### Users (`/api/users`)
- `GET /profile/:userId` - Get user profile
- `PUT /profile` - Update profile
- `GET /search?query=...` - Search users
- `GET /contacts` - Get user contacts
- `PUT /last-seen` - Update last seen

### Chats (`/api/chats`)
- `POST /` - Create chat
- `GET /` - Get user chats
- `GET /:chatId` - Get chat details
- `PUT /:chatId` - Update chat
- `DELETE /:chatId/leave` - Leave chat

### Messages (`/api/messages`)
- `GET /:chatId?limit=&offset=` - Get messages
- `PUT /:messageId` - Edit message
- `DELETE /:messageId` - Delete message
- **Note**: Sending messages is via Socket.IO only

### AI (`/api/ai`)
- `GET /models` - Get available models
- `POST /grammar` - Correct grammar
- `POST /summarize` - Summarize text
- `POST /enhance` - Enhance text
- `POST /expand` - Expand text
- `POST /tone` - Change tone
- `POST /translate` - Translate text
- `POST /chat` - AI agent chat
- `GET /session` - Get main AI session
- `GET /session/history` - Get session history
- `POST /sessions` - Create AI session
- `GET /sessions` - Get user AI sessions
- `GET /sessions/:sessionId` - Get session interactions
- `POST /sessions/:sessionId/message` - Send AI message

### Calls (`/api/calls`)
- ⚠️ Not implemented (returns 501)

### Notifications (`/api/notifications`)
- ⚠️ Not implemented (returns 501)

## 🔌 Socket.IO Events

### Client → Server
- `join` - Join user's personal room
- `join-chat` - Join chat room
- `typing` - Start typing indicator
- `stop-typing` - Stop typing indicator
- `send-message` - Send new message

### Server → Client
- `new-message` - New message received
- `message-updated` - Message was edited
- `message-deleted` - Message was deleted
- `user-typing` - User started typing
- `user-stop-typing` - User stopped typing
- `error` - Error occurred
- `connect` - Socket connected
- `disconnect` - Socket disconnected

## 🔐 Security

- **Cookie-based Authentication**: JWT stored in httpOnly cookies
- **Password Hashing**: bcrypt for password security
- **CORS**: Configured with credentials support
- **Input Validation**: express-validator for request validation
- **JWT Expiration**: 7 days default

## 🚀 Getting Started

### Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000

# AI Provider Configuration
AI_PROVIDER=ollama  # or "gemini", "huggingface"
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:latest
GEMINI_API_KEY=your_gemini_key
HF_API_KEY=your_hf_key
```

3. Run development server:
```bash
npm run dev
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

3. Run development server:
```bash
npm run dev
```

## 📝 Development Notes

### Architecture Patterns
- **Singleton Pattern**: Database client initialization
- **MVC Pattern**: Routes, controllers, data access separation
- **Middleware Pattern**: Authentication middleware
- **Adapter Pattern**: AI provider abstraction
- **Provider Pattern**: Multi-provider AI support

### Type Safety
- Full TypeScript coverage with strict mode
- Centralized type definitions in `backend/src/types/index.ts`
- Type-safe API client in frontend

### Real-time Architecture
- Socket.IO for sending messages (saves to DB + broadcasts)
- REST API for message history, editing, deletion
- Clean separation of concerns

## 📚 Documentation Files

- `backend/README.md` - Comprehensive backend API documentation
- `frontend/README.md` - Frontend setup and usage guide
- `frontend/SOCKET_SETUP.md` - Socket.IO integration guide
- `backend/src/services/ai/README.md` - AI service documentation

## 🔄 Development Workflow

1. Backend changes: Edit TypeScript files in `backend/src/`
2. Nodemon auto-restarts server on file changes
3. Frontend changes: Edit files in `frontend/src/`
4. Next.js hot-reloads on file changes

## 🧪 Testing

- Backend: Test scripts in `backend/src/services/ai/tests/`
- Frontend: Manual testing with multiple browser windows
- API: Postman collection available (`backend/NeuraChat-Postman-Collection.json`)

## 📊 Project Status

### Completed ✅
- Authentication system
- User management
- Chat creation and management
- Real-time messaging
- AI service layer with multiple providers
- AI agent with tools
- Frontend authentication flow
- Socket.IO integration

### In Progress 🚧
- Frontend chat UI enhancements
- AI agent frontend integration

### Planned 📋
- Voice/video calls
- Push notifications
- Media file uploads
- End-to-end encryption

## 🎯 Key Design Decisions

1. **Cookie-based Auth**: More secure than localStorage, httpOnly prevents XSS
2. **Socket.IO for Sending**: Real-time by design, lower latency
3. **REST for History**: Better for pagination and caching
4. **Multi-provider AI**: Flexible, can switch providers via config
5. **Agentic Copilot**: User-friendly tools that accept names, not IDs
6. **EERD Alignment**: All queries use correct table names from database schema

## 📞 Contact & Support

For issues or questions, refer to:
- Backend logs for API errors
- Browser console for frontend errors
- Socket.IO connection status in browser DevTools
- Environment variable configuration

---

**Last Updated**: Project indexed and documented
**Version**: 1.0.0
**Status**: Active Development

