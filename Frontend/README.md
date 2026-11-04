# LearnTest Frontend

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS frontend for the LearnTest learning management platform.

**Live Demo**: [https://www.easylearntest.tech](https://www.easylearntest.tech)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local (see below)

# Start development server
npm run dev
# Open http://localhost:3000
```

## 📋 Prerequisites

- Node.js 18+
- Backend API running (see `../Backend/README.md`)
- Modern web browser with JavaScript enabled

## ⚙️ Environment Variables

Create `.env.local` file:

```env
# Backend API URL (required)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

**Important:**
- Only `NEXT_PUBLIC_*` variables are exposed to the browser
- Never put secrets in `NEXT_PUBLIC_*` variables
- Backend API URL is the only required frontend environment variable

### Environment Files

- `.env.local` - Local development (git-ignored)
- `.env.example` - Template for production deployment
- Production: Set environment variables in your hosting platform

## 🏗️ Project Structure

```
Frontend/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── reset-password/
│   ├── select-role/       # OAuth role selection
│   ├── student/           # Student dashboard & features
│   ├── teacher/           # Teacher studio & content management
│   ├── admin/             # Admin panel
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── globals.css        # Global styles
├── components/            # Reusable React components
│   ├── ui/               # UI primitives
│   ├── cards/            # Content cards
│   ├── AlertDialog.tsx
│   ├── AppShell.tsx      # Main app shell with navigation
│   ├── AuthCard.tsx
│   ├── RoleSelectModal.tsx  # Role selection modal
│   ├── VideoPlayer.tsx
│   └── ...
├── lib/                   # Utilities & hooks
│   ├── api.ts            # API client with authentication
│   ├── auth.tsx          # Auth context & hooks
│   ├── hooks.ts          # Custom React hooks
│   ├── types.ts          # TypeScript types
│   ├── url.ts            # URL safety helpers
│   └── validation.ts     # Form validation
└── public/               # Static assets
    └── favicon.ico
```

## 🔐 Authentication & Authorization

### User Flow

**New Users (Email/Password)**
1. Sign up at `/sign-up`
2. Choose student/teacher role during signup
3. Verify email (check inbox/spam)
4. Sign in at `/sign-in`
5. Redirected to role-specific dashboard

**New Users (OAuth - Google/GitHub)**
1. Click social login button at `/sign-in`
2. Authorize with Google/GitHub
3. **Role Selection**: Choose student or teacher
4. Redirected to role-specific dashboard

**Returning Users**
1. Sign in (email or OAuth)
2. Automatically redirected to:
   - Students → `/student`
   - Teachers → `/teacher`  
   - Admins → `/admin`

### OAuth Role Selection

When users sign in with Google or GitHub for the first time:

1. **Redirect to role selection** - Automatically shown `/select-role` page
2. **Choose role** - Select Student or Teacher (permanent choice)
3. **Loading state** - Shows spinner: "Setting up your workspace, please wait..."
4. **Save to database** - `POST /api/v1/me/select-role`
5. **Redirect** - Full page reload to role-specific workspace

**Technical Implementation:**
- Root page (`/`) checks authentication status
- If `!user.roleSelected` → redirects to `/select-role`
- Role selection updates backend, then uses `window.location.href` for full reload
- Full reload clears Better Auth's 60-second session cache
- Modal removed from global layout (only route-based now)

### Session Management

- Sessions handled by Better Auth (backend)
- HttpOnly secure cookies
- All API calls include `credentials: "include"`
- Role always verified server-side
- Auto-redirects on authentication state changes

## 🎨 Features by Role

### 🎓 Student Features

- **Dashboard**: Personal learning overview
- **Browse Content**: Videos, questions, playlists, exams
- **Watch Videos**: Inline playback with authorization
- **Take Exams**: Start, answer, submit assignments
- **View Results**: Scores & feedback (after grading)
- **Purchases**: Buy premium content
- **Bookmarks**: Save favorite content
- **Follow Teachers**: Track favorite educators
- **Profile**: Manage account settings

### 👨‍🏫 Teacher Features

- **Studio Dashboard**: Content & earnings overview
- **Create Content**: Videos, questions, exams, playlists
- **Content Management**: Edit, publish, hide
- **Grading Queue**: Review & grade submissions
- **Analytics**: Views, earnings, engagement stats
- **Pricing**: Set prices for premium content
- **Students**: View followers
- **Profile**: Public teacher profile

### 🛠️ Admin Features

- **Overview**: Platform statistics
- **User Management**: View, suspend, change roles
- **Content Moderation**: Review reports, hide content
- **Payment Overview**: Transaction monitoring
- **Analytics**: Platform-wide insights
- **Audit Logs**: Track admin actions
- **Payout Management**: Process teacher payouts

## 📱 Pages & Routes

### Public Pages
- `/` - Landing page with content discovery
- `/sign-in` - Email/password & OAuth login
- `/sign-up` - New account registration  
- `/reset-password` - Password reset flow

### Authenticated Pages
- `/select-role` - OAuth role selection (first-time only)
- `/student/*` - Student dashboard & features
- `/teacher/*` - Teacher studio & management
- `/admin/*` - Admin panel (admin only)
- `/payment/result` - Payment confirmation

## 🔌 API Integration

All API calls go through `lib/api.ts`:

```typescript
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';

// Examples
const profile = await apiGet('/api/v1/me');
const video = await apiPost('/api/v1/videos', videoData);
const updated = await apiPatch('/api/v1/me', { name: 'New Name' });
```

### API Client Features

- ✅ Automatic authentication (cookies)
- ✅ JSON request/response handling
- ✅ Error handling with typed errors
- ✅ File upload support
- ✅ Blob download for media
- ✅ HTTPS upgrade for cross-origin requests
- ✅ Environment-based API URL

### Error Handling

```typescript
try {
  const data = await apiPost('/api/v1/endpoint', payload);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status);   // HTTP status code
    console.error(error.code);     // Error code
    console.error(error.message);  // User-friendly message
  }
}
```

## 🎨 Styling & UI

### Tech Stack
- **Framework**: Tailwind CSS 4
- **Typography**: Plus Jakarta Sans (body), Fraunces (headings)
- **Theme**: Light/dark mode support
- **Icons**: SVG inline icons
- **Responsive**: Mobile-first design

### UI Components

Reusable components in `components/ui/`:
- `Btn` - Buttons with variants
- `Field` - Form fields with labels & errors
- `Badge` - Status badges
- `Notice` - Alert messages
- `Loading` - Loading states
- `Empty` - Empty state placeholders
- `ErrorBox` - Error displays

### Theme Toggle

```typescript
// Automatic dark mode based on system preference
// Theme persists in localStorage
```

## 🧪 Development

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Development Tools

- **Hot Reload**: Changes reflect instantly
- **TypeScript**: Full type safety
- **ESLint**: Code quality checks
- **Type Checking**: Catch errors before runtime

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Hosting Platforms

Compatible with:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **AWS Amplify**
- **DigitalOcean App Platform**
- **Docker** + any cloud provider

### Environment Variables in Production

Set in your hosting platform:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

### Production Checklist

- [ ] Set `NEXT_PUBLIC_API_BASE_URL` to production backend
- [ ] Verify backend CORS includes frontend origin
- [ ] Test OAuth callbacks with production URLs
- [ ] Enable HTTPS
- [ ] Configure custom domain
- [ ] Test all authentication flows
- [ ] Verify payment integration
- [ ] Check mobile responsiveness

## 🐛 Troubleshooting

### Common Issues

**"Network Error" or API calls fail**
- Backend not running (start with `cd ../Backend && npm run dev`)
- Wrong `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- CORS issues (check backend `CORS_ORIGINS`)

**OAuth callback errors**
- Callback URLs don't match in OAuth provider settings
- Backend `BETTER_AUTH_URL` misconfigured
- Frontend and backend on different protocols (http vs https)

**Role selection modal appears repeatedly**
- Clear browser cookies and try again
- Check backend logs for database update errors
- Verify backend `getAuthDb` initialization order

**Session/authentication issues**
- Clear browser cookies
- Check HttpOnly cookie settings
- Verify `credentials: "include"` in API calls

### Debug Mode

Enable detailed logging:

```typescript
// In lib/api.ts, uncomment:
console.log('API Request:', method, path, init);
console.log('API Response:', response);
```

## 📦 Dependencies

### Production
- `next` - React framework with App Router
- `react` - UI library
- `react-dom` - React DOM renderer

### Development
- `typescript` - Type safety
- `tailwindcss` - CSS framework
- `eslint` - Code linting
- `@types/*` - TypeScript definitions

### No Additional Libraries

This project uses:
- ✅ Native fetch API (no axios)
- ✅ Built-in React hooks (no external state management)
- ✅ Tailwind CSS (no UI component library)
- ✅ Vanilla JS for utilities (minimal dependencies)

## 🔄 Updates & Maintenance

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update all dependencies
npm update

# Update Next.js
npm install next@latest react@latest react-dom@latest
```

### Code Quality

```bash
# Before committing
npm run typecheck && npm run lint && npm run build
```

## 🤝 Contributing

1. Follow existing code patterns
2. Use TypeScript strictly (no `any` types)
3. Keep components small and focused
4. Add loading and error states
5. Test authentication flows
6. Ensure mobile responsiveness

## 📄 License

ISC

## 🔗 Resources

- **Live Demo**: [https://www.easylearntest.tech](https://www.easylearntest.tech)
- **Backend API**: `../Backend/README.md`
- **API Documentation**: http://localhost:4000/api/docs (development)
- **Specification**: `frontend.md`
- **Next.js Docs**: https://nextjs.org/docs
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
