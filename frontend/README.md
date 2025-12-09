# NeuraChat Frontend

Modern dark-themed Next.js frontend for NeuraChat with authentication.

## 🚀 Tech Stack

- **Next.js 15.5** with App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Turbopack** for fast development

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with AuthProvider
│   │   ├── page.tsx             # Home page (redirects)
│   │   ├── login/page.tsx       # Login page
│   │   ├── register/page.tsx    # Registration page
│   │   ├── dashboard/page.tsx   # Main dashboard with chats
│   │   ├── settings/page.tsx    # Settings with logout
│   │   └── calls/page.tsx       # Calls page
│   ├── components/
│   │   ├── AuthGuard.tsx        # Protected route wrapper
│   │   └── Sidebar.tsx          # Navigation sidebar
│   ├── context/
│   │   └── AuthContext.tsx      # Global auth state
│   └── lib/
│       └── api.ts               # API client with credentials
├── .env.local                   # Environment variables
└── color_scheme.txt             # Design system colors
```

## ⚙️ Setup Instructions

### 1. Environment Configuration

Create `.env.local` in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id_here
```

**Important**: You need to get your Agora App ID from [Agora Console](https://console.agora.io/). This should be the same value as `AGORA_APP_ID` in your backend `.env` file.

Note: `next.config.ts` will automatically map `AGORA_APP_ID` (from your backend/root `.env`) to `NEXT_PUBLIC_AGORA_APP_ID` for the frontend, so you can set it once in `backend/.env` and reuse it.

### 2. Backend CORS Setup

Ensure your backend (`backend/src/server.ts`) has CORS configured:

```typescript
import cors from 'cors';

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
```

### 3. Install Dependencies

```bash
cd frontend
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 🔐 Authentication Flow

### Registration
1. Navigate to `/register`
2. Fill in:
   - Display Name (full_name)
   - Username
   - Email
   - Password (min 6 characters)
3. On success, redirected to `/dashboard`
4. JWT token stored in httpOnly cookie by backend

### Login
1. Navigate to `/login`
2. Enter email and password
3. On success, redirected to `/dashboard`
4. Session restored automatically on page refresh

### Logout
1. Go to `/settings`
2. Click "Logout" button
3. Cookie cleared, redirected to `/login`

## 🎨 Color Scheme

See `color_scheme.txt` for the complete dark theme design system:

- **Primary**: Blue (#2563EB)
- **Background**: Slate-900 (#0F172A)
- **Cards**: Slate-800 (#1E293B)
- **Text**: Slate-50 (#F8FAFC)
- **Borders**: Slate-700 (#334155)

## 📡 API Integration

All API calls use `credentials: 'include'` to send httpOnly cookies:

```typescript
// Example from src/lib/api.ts
fetch(url, {
  method: 'POST',
  credentials: 'include',  // CRITICAL for cookies
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

## 🛡️ Protected Routes

Routes are protected using `<AuthGuard>` component:

```typescript
// src/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <AuthGuard>
      {/* Protected content */}
    </AuthGuard>
  );
}
```

## 🧪 Testing Authentication

### Test Registration
```bash
# Backend should be running on port 5000
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "username": "testuser",
    "full_name": "Test User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 📄 Available Pages

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Home (redirects) | No |
| `/login` | Login form | No |
| `/register` | Registration form | No |
| `/dashboard` | Chat dashboard | Yes |
| `/settings` | User settings & logout | Yes |
| `/calls` | Call history | Yes |

## 🔧 Key Features

- ✅ JWT authentication with httpOnly cookies
- ✅ Automatic session restoration
- ✅ Protected route guards
- ✅ Dark theme UI with Tailwind
- ✅ Responsive design
- ✅ Error handling with user feedback
- ✅ Loading states
- ✅ Form validation

## 🐛 Troubleshooting

### CORS Errors
- Verify backend CORS allows `credentials: true`
- Check origin is `http://localhost:3000`

### Cookie Not Set
- Ensure backend sets `httpOnly`, `sameSite: 'strict'`
- Check `secure: false` in development

### 401 Unauthorized
- Verify `JWT_SECRET` matches in backend `.env`
- Check token expiration settings

### Redirect Loops
- Clear browser cookies
- Check `AuthGuard` logic
- Verify `/auth/me` endpoint works

## 📝 Development Notes

1. **API Client**: All requests in `src/lib/api.ts` use singleton pattern
2. **Auth Context**: Global state managed in `src/context/AuthContext.tsx`
3. **Cookie Storage**: JWT stored by backend, never accessible via JavaScript
4. **Type Safety**: Full TypeScript support for API responses

## 🚀 Next Steps

- [ ] Implement chat functionality
- [ ] Add real-time messaging with WebSocket
- [ ] Integrate call features
- [ ] Add notification system
- [ ] Connect to AI endpoints

## 📚 Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React 19](https://react.dev)

## 🤝 Support

For issues or questions, check the backend logs and ensure all environment variables are correctly set.

---

**Built with ❤️ using Next.js 15.5, React 19, and Tailwind CSS v4**