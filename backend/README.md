# NeuraChat Backend API

A comprehensive REST API for the NeuraChat messaging platform with end-to-end encryption support.

**Note**: Voice/video call functionality is yet to be implemented.  
**Note**: AI agent functionality is yet to be implemented.  
**Note**: Notification functionality is yet to be implemented.

## Tech Stack

- **Runtime**: Node.js (v18+) with TypeScript (v5.3.3)
- **Framework**: Express.js (v4.18.2)
- **Database**: Supabase (PostgreSQL) - @supabase/supabase-js (v2.39.0)
- **Authentication**: JWT (jsonwebtoken v9.0.2) + Cookie-based sessions
- **Real-time**: Socket.IO (v4.6.1) - WebSocket communication
- **Security**:
  - bcrypt (v5.1.1) - Password hashing
  - cookie-parser (v1.4.6) - Cookie management
  - CORS (v2.8.5) - Cross-origin resource sharing
- **Validation**: express-validator (v7.0.1)
- **File Upload**: multer (v1.4.5-lts.1)
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

4. Run the development server:

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

```http
POST /api/messages/:chatId

Content-Type: application/json

{
  "content": "Hello, World!",
  "type": "text"
}
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

### Call Endpoints

**Note**: Voice/Video call functionality is yet to be implemented.

All call endpoints will return:

```json
{
  "error": "Call functionality yet to be implemented"
}
```

Status Code: `501 Not Implemented`

### AI Agent Endpoints

**Note**: AI agent functionality is yet to be implemented.

All AI endpoints will return:

```json
{
  "error": "AI functionality yet to be implemented"
}
```

Status Code: `501 Not Implemented`

### Notification Endpoints

**Note**: Notification functionality is yet to be implemented.

All notification endpoints will return:
```json
{
  "error": "Notification functionality yet to be implemented"
}
```

Status Code: `501 Not Implemented`

## WebSocket Events (Socket.IO)

The server supports real-time communication via Socket.IO on the same port as the HTTP server.

**Connection URL**: `http://localhost:5000`

### Client Events (Emit from client)


| Event          | Payload                               | Description                                 |
| -------------- | ------------------------------------- | ------------------------------------------- |
| `join`         | `{ userId: string }`                  | Join user's personal room for notifications |
| `join-chat`    | `{ chatId: string }`                  | Join a specific chat room                   |
| `typing`       | `{ chatId: string, userId: string }`  | Broadcast typing indicator                  |
| `stop-typing`  | `{ chatId: string, userId: string }`  | Stop typing indicator                       |
| `send-message` | `{ chat_id: string, ...messageData }` | Send new message to chat                    |

**Note**: Call/Video functionality (call-user, answer-call, ice-candidate, end-call events) - Yet to be implemented

### Server Events (Listen on client)


| Event              | Payload                              | Description                    |
| ------------------ | ------------------------------------ | ------------------------------ |
| `connection`       | `{ id: string }`                     | Socket connected successfully  |
| `new-message`      | `{ ...messageData }`                 | New message in subscribed chat |
| `user-typing`      | `{ userId: string, chatId: string }` | User started typing            |
| `user-stop-typing` | `{ userId: string, chatId: string }` | User stopped typing            |
| `disconnect`       | `{}`                                 | Socket disconnected            |

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

// Listen for new messages
socket.on('new-message', (message) => {
  console.log('New message:', message);
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
- **`media_files`** - Media attachments for messages

  - `id` (uuid, primary key)
  - `message_id` (uuid, foreign key → messages)
  - `file_url` (text)
  - `file_type` (text)
  - `file_size` (integer)
  - `created_at` (timestamp)

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

**Note**: AI agent functionality yet to be implemented. The following schema is for future use.

- **`ai_agent_sessions`** - AI conversation sessions

  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key → users)
  - `title` (text, nullable)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- **`ai_interactions`** - AI conversation history

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
│   │   └── notificationRoutes.ts    # Notification endpoint routes
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

### Testing

Currently no automated tests are configured. Recommended testing tools:

- **Unit Tests**: Jest + ts-jest
- **Integration Tests**: Supertest
- **E2E Tests**: Postman/Insomnia collections
- **API Testing**: Thunder Client (VS Code extension)

### Debugging

1. **Console Logs**: All major operations log to console
2. **Error Messages**: Detailed errors in development mode
3. **VS Code Debugger**: Attach to ts-node process
4. **Source Maps**: Enabled for debugging TypeScript

### Performance Considerations

- **Database Singleton**: Single Supabase client instance prevents connection overhead
- **Cookie-based Auth**: Reduces token validation overhead vs header parsing
- **TypeScript**: Compiled to optimized JavaScript for production
- **Connection Pooling**: Handled by Supabase client
- **Lazy Loading**: Controllers only get DB client when functions execute

## Deployment

### Production Checklist

Before deploying to production:

- [ ]  Set strong `JWT_SECRET` (minimum 32 random characters)
- [ ]  Configure `NODE_ENV=production`
- [ ]  Set up proper `FRONTEND_URL` for CORS
- [ ]  Enable Supabase Row Level Security (RLS) policies
- [ ]  Use environment-specific Supabase projects
- [ ]  Enable HTTPS/SSL certificates
- [ ]  Set up monitoring and logging
- [ ]  Configure rate limiting (recommended: express-rate-limit)
- [ ]  Set up backup strategy for database
- [ ]  Review and test all API endpoints

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key
JWT_SECRET=your_very_long_random_secret_key_here
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://yourdomain.com
```

### Build and Deploy

```bash
# Install dependencies
npm install --production

# Build TypeScript
npm run build

# Start production server
npm start
```

### Deployment Platforms

**Recommended platforms:**

- **Railway**: Easy deployment with automatic SSL
- **Render**: Free tier available, auto-deploys from Git
- **Heroku**: Simple setup with buildpacks
- **DigitalOcean App Platform**: Scalable with managed databases
- **AWS EC2/ECS**: Full control, requires more setup
- **Vercel/Netlify**: Serverless functions (requires adaptation)

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

**1. "Database not initialized" error**

- **Cause**: Database client called before initialization
- **Solution**: Ensure `initializeDatabase()` is called in `server.ts` before importing controllers

**2. "Cannot find module" errors**

- **Cause**: Missing `.js` extensions or wrong module type
- **Solution**: We use CommonJS (no `"type": "module"` in package.json), imports should not have `.js` extensions

**3. "Invalid token" or "No token provided"**

- **Cause**: Cookie not being sent with requests
- **Solution**: Ensure client sends `credentials: 'include'` or `withCredentials: true`

**4. CORS errors in browser**

- **Cause**: Frontend URL not whitelisted or credentials not configured
- **Solution**: Check `FRONTEND_URL` in `.env` and ensure CORS credentials are enabled

**5. "Supabase configuration missing"**

- **Cause**: `.env` file not found or missing required variables
- **Solution**: Copy `.env.example` to `.env` and fill in all values

**6. WebSocket connection fails**

- **Cause**: Socket.IO CORS not configured or wrong URL
- **Solution**: Ensure Socket.IO CORS matches your frontend URL

**7. TypeScript compilation errors**

- **Cause**: Type mismatches or missing type definitions
- **Solution**: Run `npm install` to ensure all @types packages are installed

### Debug Mode

Enable verbose logging:

```typescript
// In src/server.ts, add:
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    cookies: req.cookies,
    headers: req.headers
  });
  next();
});
```

### Logs to Check

- **Server startup**: Confirms database connection and server running
- **Request logs**: Shows incoming requests and their paths
- **Error logs**: Displays caught errors with stack traces (dev mode)
- **Socket.IO logs**: Shows WebSocket connections and events

## Contributing

When contributing to this project:

1. Follow existing code structure and patterns
2. Use TypeScript types (not interfaces)
3. Add authentication middleware to protected routes
4. Use `getSupabaseClient()` inside controller functions
5. Handle errors appropriately with proper status codes
6. Update README.md if adding new features
7. Test endpoints before committing
