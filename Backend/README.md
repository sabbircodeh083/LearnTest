# LearnTest Backend

Express + TypeScript + MongoDB REST API for the LearnTest learning management system.

**Live Demo**: [https://www.easylearntest.tech](https://www.easylearntest.tech)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see below)

# Generate auth secret
openssl rand -base64 32
# Add to .env as BETTER_AUTH_SECRET

# Run development server
npm run dev
# Server runs at http://localhost:4000
# API docs: http://localhost:4000/api/docs
```

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB)
- SMTP email service (for verification emails)
- SSLCOMMERZ account (for payments)
- Google/GitHub OAuth apps (optional, for social login)

## ⚙️ Environment Variables

Create a `.env` file with these variables:

### Required

```env
# Server
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=learntest

# Auth
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000

# Email (for verification & password reset)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@yourdomain.com
```

### Optional (for full features)

```env
# Post-verification landing page (defaults to ${FRONTEND_URL}/sign-in)
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:3000/sign-in

# OAuth Social Login
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Payment Gateway
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
SSLCOMMERZ_MODE=sandbox  # or 'live' for production
PAYMENT_CURRENCY=BDT

# File Upload & Storage
UPLOAD_STORAGE=local  # or 's3' for production
UPLOAD_DIR=./uploads
MAX_PDF_SIZE_MB=10
MAX_VIDEO_SIZE_MB=100
MAX_IMAGE_SIZE_MB=5
MAX_ZIP_SIZE_MB=50

# Malware Scanning (Bouncer)
MALWARE_SCAN_ENABLED=false
BOUNCER_API_KEY=your_bouncer_api_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

## 🔐 Setting Up OAuth Providers

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Add authorized redirect URI:
   - Development: `http://localhost:4000/api/auth/callback/google`
   - Production: `https://your-api-domain.com/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env`

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set Authorization callback URL:
   - Development: `http://localhost:4000/api/auth/callback/github`
   - Production: `https://your-api-domain.com/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env`

## 💳 Payment Gateway Setup (SSLCOMMERZ)

1. Sign up at [SSLCOMMERZ](https://www.sslcommerz.com)
2. Get sandbox credentials from merchant dashboard
3. Set IPN (Instant Payment Notification) URL:
   - Development: Use ngrok or cloudflared tunnel → `https://your-tunnel.ngrok.io/api/v1/payments/sslcommerz/ipn`
   - Production: `https://your-api-domain.com/api/v1/payments/sslcommerz/ipn`
4. Add credentials to `.env`:
   ```env
   SSLCOMMERZ_STORE_ID=test_store_id
   SSLCOMMERZ_STORE_PASSWORD=test_password
   SSLCOMMERZ_MODE=sandbox
   ```

## 👥 User Roles & Authentication

### Role System

The platform supports three roles:
- **Student**: Can view content, take exams, submit assignments
- **Teacher**: Can create content, grade submissions, earn from sales
- **Admin**: Full system access, user management, moderation

### Role Selection Flow

Users only see the role selection page when `roleSelected` is still `false`:

- **Manual sign-up**: the sign-up form includes a Student/Teacher choice, so the account is created with `roleSelected: true` and goes straight to that workspace after verification and sign-in.
- **OAuth sign-up** (Google/GitHub): no role is supplied, so the account is created with `roleSelected: false`.

**New OAuth users** therefore go through onboarding:

1. User signs in with OAuth → Account created with `roleSelected: false`
2. Redirected to role selection page
3. Must choose Student or Teacher role
4. After selection, redirected to role-specific dashboard

**Technical Details:**
- Role stored in `user` collection (Better Auth database)
- `roleSelected` flag prevents accessing features before selection
- Endpoint: `POST /api/v1/me/select-role` (body: `{role: "student" | "teacher"}`)
- Returns `409 Conflict` if role already selected
- Database update handles both `id` and `_id` MongoDB field formats

### Account Deletion

`DELETE /api/v1/me` permanently deletes the account and its data.

- **Email/password accounts:** the body must include the current `password`.
  It is verified against the bcrypt hash stored in Better Auth's `account`
  collection (`providerId: "credential"`, related by
  `account.userId === user.id`) **before** any data is deleted. A wrong or
  missing password returns `400 INVALID_PASSWORD`.
- **OAuth-only accounts:** no credential account/password exists, so the
  authenticated session is sufficient.
- `GET /api/v1/me` returns `hasPassword` so the frontend knows whether to ask
  for a password.
- Teachers with content that has paid purchases cannot be deleted (existing
  safeguard).
- Shared bcrypt helpers live in `src/auth/credentials.ts`, so login and
  deletion always use the same hashing/verification configuration.

### Email Verification

Verification links redirect to the frontend sign-in page
(`EMAIL_VERIFICATION_REDIRECT_URL`, defaults to `${FRONTEND_URL}/sign-in`)
with `?verified=1`. `autoSignInAfterVerification` is disabled, so users verify
their address and then sign in explicitly.

### Creating First Admin

```bash
# 1. Sign up normally as student/teacher
# 2. Verify your email
# 3. Run the admin creation script:
ADMIN_EMAIL=your@email.com npm run create-admin
```

### Authentication Features

- ✅ Email/password signup with verification
- ✅ OAuth social login (Google, GitHub)
- ✅ Password reset via email
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Role-based access control
- ✅ Session-based auth (HTTP-only cookies)
- ✅ Email verification required for protected features
- ✅ Account deletion re-verifies the current password (OAuth-only accounts exempt)
- ✅ Verification links land on the frontend sign-in page

## 📁 Project Structure

```
Backend/
├── src/
│   ├── auth/           # Authentication & authorization
│   │   ├── auth.ts     # Better Auth configuration
│   │   ├── credentials.ts  # bcrypt helpers + credential-account lookup
│   │   ├── guards.ts   # Session resolver, role guards
│   │   └── password-policy.ts
│   ├── common/         # Shared utilities
│   │   ├── errors.ts
│   │   ├── logger.ts
│   │   ├── middleware.ts
│   │   └── schemas.ts
│   ├── config/         # Configuration
│   │   ├── database.ts
│   │   └── env.ts      # Environment validation (Zod)
│   ├── models/         # Mongoose models
│   │   └── index.ts
│   ├── modules/        # Feature modules (routes + logic)
│   │   ├── admin.routes.ts
│   │   ├── content.routes.ts
│   │   ├── engagement.routes.ts
│   │   ├── learning.routes.ts
│   │   ├── profile.routes.ts  # Profile, role selection, account deletion
│   │   ├── uploads.routes.ts
│   │   └── payments/
│   ├── services/       # Business logic & external services
│   │   ├── audit.ts
│   │   ├── mail.ts
│   │   ├── malware-scan.ts
│   │   └── user-roles.ts  # Role management utilities
│   ├── app.ts          # Express app setup
│   ├── server.ts       # Server initialization
│   └── openapi.ts      # API documentation
├── scripts/            # Utility scripts
│   ├── seed.ts
│   └── create-admin.ts
├── tests/              # Test suite
│   ├── guards.test.ts
│   ├── payments.test.ts
│   ├── role-source.test.ts
│   └── ...
└── .env.example        # Environment template
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test guards.test.ts

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Test Coverage

- ✅ Authentication & role guards
- ✅ Payment validation & state transitions
- ✅ Upload file type validation
- ✅ Ownership & authorization
- ✅ Admin access control
- ✅ Malware scanning (mocked)

## 📚 API Documentation

When running in development mode:
- **Swagger UI**: http://localhost:4000/api/docs
- **OpenAPI JSON**: http://localhost:4000/api/docs/openapi.json

### Key Endpoints

#### Authentication
- `POST /api/auth/sign-up/email` - Email/password signup
- `POST /api/auth/sign-in/email` - Email/password login  
- `POST /api/auth/sign-in/social` - OAuth (Google/GitHub)
- `POST /api/auth/sign-out` - Sign out

#### Profile
- `GET /api/v1/me` - Get current user profile, role & `hasPassword`
- `PATCH /api/v1/me` - Update profile (not role)
- `DELETE /api/v1/me` - Delete account (password required for email/password accounts)
- `POST /api/v1/me/select-role` - Role selection while `roleSelected=false` (e.g. OAuth onboarding)

#### Content (Students)
- `GET /api/v1/videos` - List videos
- `GET /api/v1/videos/:id` - Video details
- `GET /api/v1/exams` - List exams
- `POST /api/v1/exams/:id/attempts` - Start exam

#### Content (Teachers)
- `POST /api/v1/videos` - Create video
- `POST /api/v1/exams` - Create exam
- `GET /api/v1/submission-queue/items` - Grading queue
- `PATCH /api/v1/exam-attempts/:id/grade` - Grade submission

#### Payments
- `POST /api/v1/payments/sslcommerz/initiate` - Start payment
- `POST /api/v1/payments/sslcommerz/ipn` - Payment webhook
- `GET /api/v1/purchases/me` - My purchases

#### Admin
- `GET /api/v1/admin/overview` - Dashboard stats
- `GET /api/v1/admin/users` - User management
- `PATCH /api/v1/admin/users/:id/role` - Change user role
- `PATCH /api/v1/admin/users/:id/status` - Suspend/activate

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `BETTER_AUTH_SECRET` (32+ characters)
- [ ] Configure production MongoDB Atlas with IP whitelist
- [ ] Set correct `API_BASE_URL` and `FRONTEND_URL`
- [ ] Configure CORS origins properly
- [ ] Set up HTTPS (for secure cookies)
- [ ] Use object storage (S3/R2) for file uploads
- [ ] Enable malware scanning with Bouncer API
- [ ] Configure production SSLCOMMERZ credentials
- [ ] Set up proper SMTP service
- [ ] Configure OAuth callbacks with production URLs
- [ ] Set rate limits appropriately
- [ ] Monitor logs and errors

### Health Checks

- **Liveness**: `GET /api/v1/health` - Always returns 200
- **Readiness**: `GET /api/v1/ready` - Returns 200 when DB connected

### Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals:
- Stops accepting new connections
- Finishes pending requests (10s timeout)
- Closes database connections
- Exits cleanly

## 🛠️ Troubleshooting

### Role Selection Issues

**Role page keeps appearing after selection:**
- Check backend logs for database update success
- Verify `getAuthDb` is initialized before `defaultResolver` in `server.ts`
- Ensure the MongoDB `user` document has `roleSelected: true` after selection
- Manual signup supplies a role, so the create hook must set `roleSelected: true`

**Database update fails:**
- User documents may use `_id` instead of `id` field
- Update logic tries both formats automatically
- Check logs for "User not found in database" errors

### Common Issues

**"Auth service unavailable"**
- MongoDB connection failed
- Check `MONGODB_URI` in `.env`
- Verify MongoDB Atlas IP whitelist

**"Email verification required"**
- SMTP not configured
- Check `SMTP_*` environment variables
- Check email spam folder

**Verification link shows a JSON 404 after the email is verified**
- The link's `callbackURL` fell back to `/` (the API host root)
- Set `EMAIL_VERIFICATION_REDIRECT_URL` to the frontend sign-in page
  (`https://your-frontend/sign-in`) and resend the verification email
- Old emails keep their original callback; resend them after deploying

**OAuth callback errors**
- Verify callback URLs match in provider console
- Check `BETTER_AUTH_URL` in `.env`
- Ensure URLs include protocol (http:// or https://)

## 📝 Scripts

```bash
npm run dev          # Development server with auto-reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Run compiled production server
npm run typecheck    # Check types without emitting
npm run lint         # Run ESLint
npm test             # Run test suite
npm run seed         # Seed database with sample data
npm run create-admin # Promote user to admin
```

## 🤝 Contributing

1. Follow existing code style
2. Add tests for new features
3. Run `npm run typecheck && npm run lint && npm test` before committing
4. Update documentation for API changes

## 📄 License

ISC

## 🔗 Related

- **Live Demo**: [https://www.easylearntest.tech](https://www.easylearntest.tech)
- **Frontend**: `../Frontend/README.md`
- **API Spec**: `API-README.md`
- **Environment**: `.env.example`
