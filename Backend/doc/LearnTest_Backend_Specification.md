# LearnTest Backend Specification

Express.js • Node.js • TypeScript • MongoDB Atlas • Better Auth • SSLCOMMERZ

Implementation-ready requirements for an AI coding agent

## 1. Goal

Build a standalone REST API for LearnTest, consumed by a separate Next.js frontend. Use Express.js, Node.js, TypeScript, MongoDB Atlas, Better Auth, email verification, Google and GitHub OAuth, Multer for secure uploads, and SSLCOMMERZ hosted checkout with server-side transaction validation and IPN. Do not hard-code secrets. Create .env.example with placeholders and exclude real .env from Git.

## 2. Stack and engineering standards
- Use Node.js LTS, TypeScript strict mode, Express, and a committed lockfile.
- Use MongoDB Atlas and one consistent data-access approach. Use Better Auth's officially supported MongoDB setup for the installed version.
- Use Zod consistently for environment, route params, query strings, JSON bodies, and multipart text fields.
- Use Better Auth for identity, sessions, email verification, and social sign-in. Configure Better Auth's supported custom password hash and verify callbacks to use bcrypt for email/password credentials. Use bcrypt.compare through the verify callback; do not implement a separate sign-in/password database or bypass Better Auth.
- Use Multer with explicit file/field/size limits. Use private object storage for production uploads; local disk is for development only.
- Use a maintained HTTP client for SSLCOMMERZ calls, with timeouts, error handling, and safe logging.
- Use structured logs with redaction. Never log passwords, cookies, auth/OAuth tokens, payment credentials, or sensitive file content.
- Add lint, typecheck, automated tests, centralized error handling, request IDs, health checks, and graceful shutdown.

## 3. Suggested project layout

```text
src/
  app.ts
  server.ts
  config/{env.ts,database.ts,cors.ts}
  auth/{auth.ts,auth.routes.ts,require-auth.ts,require-email-verified.ts,require-role.ts}
  common/{errors/,middleware/,validation/,logger.ts,utils/}
  modules/
    users/ profiles/ teachers/ videos/ playlists/ questions/
    exams/ comments/ reactions/ follows/
    purchases/ entitlements/ payments/sslcommerz/ uploads/ health/
  tests/
.env.example
.gitignore
package.json
tsconfig.json
README.md
```

Keep route handlers thin. Controllers validate input and shape responses; services enforce business rules; data-access modules handle persistence.

## 4. Better Auth: authentication

### 4.1 Required features
- Email/password signup and login.
- Email verification before protected product features.
- Google OAuth (Google account, often called Gmail login) and GitHub OAuth.
- Logout, current-session endpoint, password reset by verified email, session expiration.
- Secure cookies and trusted-origin configuration appropriate to HTTPS production.

### 4.2 Requirements
- Use bcrypt for email/password hashing and comparison by configuring Better Auth's documented emailAndPassword.password.hash and verify callbacks. Use bcrypt.hash(password, 12) as a starting cost factor, then benchmark and tune it for the deployment. Use bcrypt.compare(password, storedHash) only inside the Better Auth verify callback. Never store plaintext passwords, expose hashes, or compare passwords manually in route handlers. Better Auth defaults to scrypt, so explicitly configure bcrypt as requested and test signup, login, password reset, and password change.
- Configure Google and GitHub client IDs/secrets only on the server. Register exact callback URLs in provider consoles; keep development and production URLs separate.
- Configure real email delivery through SMTP or a supported provider. Verification must use Better Auth's token flow; requesting an email or visiting a frontend route must not mark an account verified.
- Do not trust client-supplied emailVerified, userId, role, or permissions.
- Users may choose student or teacher during signup if desired; public signup must never permit admin role assignment.
- Mount Better Auth using the official Express integration and the documented auth path (commonly /api/auth/*). Check current documentation for the installed version and its expected Express/Web Request-Response bridge.
- If frontend and API use separate origins, configure CORS, credentials, cookies, and trusted origins together. Use the matching Better Auth client on Next.js and avoid creating a second independent auth system.

## 5. Authorization and data privacy
- Authentication proves identity; authorization checks what the identity may access.
- Provide reusable requireAuth, requireEmailVerified, requireRole, ownership, and entitlement checks.
- Roles: student, teacher, admin. No public admin signup.
- Students can access only their own private submissions, attempts, grades, purchases, and feedback unless a specific sharing rule allows otherwise.
- Teachers can manage only their own content and grade submissions related to their content.
- Admin operations require a server-controlled role.
- Paid content access requires a verified successful purchase and an active entitlement.
- Keep public comments/ratings/reactions separate from private answers, grading, submissions, and teacher feedback.
- Check authorization for every resource ID to prevent IDOR.

## 6. Email service

Create a mail-service abstraction for verification, password reset, and receipts. Use an actual SMTP/email provider in production. Do not log full verification/reset tokens in production. If email delivery fails, log safe diagnostic metadata and return a consistent error without exposing provider credentials.

## 7. SSLCOMMERZ payment requirements

### 7.1 Payment flow
1. Client submits content ID, not a trusted amount. Backend loads the authoritative price/currency from MongoDB.
2. Create a unique pending purchase/order record before initiating checkout.
3. Initiate SSLCOMMERZ server-to-server with sandbox credentials/endpoint in development and live credentials/endpoint only after merchant onboarding.
4. Use SSLCOMMERZ hosted checkout. Never collect or store card numbers, CVV, or card authentication data.
5. Provide success/fail/cancel callback URLs and configure the IPN URL in the merchant panel.
6. Treat callback/IPN fields as untrusted. Call SSLCOMMERZ Order Validation API and compare validated status, transaction/order ID, amount, and currency against the stored order.
7. Do not grant access based solely on a browser redirect or IPN status field.
8. Make processing idempotent. Duplicate notifications must not duplicate payment records or entitlements.
9. Handle VALID, FAILED, CANCELLED, EXPIRED, UNATTEMPTED, unknown/pending, and risk-level responses explicitly. Hold risk_level=1 transactions for review according to policy.
10. Only after verified success, atomically mark the purchase paid and grant an entitlement. Keep payment status separate from entitlement status.
11. Record gateway IDs, amount/currency, status history, and timestamps. Support refund/revocation workflow or explicitly mark it not yet implemented.

### 7.2 Proposed routes
- POST /api/v1/payments/sslcommerz/initiate — authenticated, verified user; backend computes price.
- POST /api/v1/payments/sslcommerz/ipn — public provider callback; validate server-to-server before state changes.
- POST /api/v1/payments/sslcommerz/success — browser return/status route; display verified order state only.
- POST /api/v1/payments/sslcommerz/fail
- POST /api/v1/payments/sslcommerz/cancel
- GET /api/v1/purchases/:purchaseId — owner or authorized admin.
- GET /api/v1/purchases/me
- GET /api/v1/entitlements/:contentType/:contentId

Use SSLCOMMERZ's current official documentation for exact request fields and response semantics. The server should reconcile orders stuck in pending state. A localhost IPN URL cannot be reached by SSLCOMMERZ; use a public HTTPS development tunnel or deployed sandbox API for end-to-end IPN tests.

## 8. MongoDB collections
- Better Auth user/session/account/verification collections: follow the exact schema and adapter guidance for the installed Better Auth version; do not create conflicting duplicates.
- Application user profile: safe profile fields, chosen role, bio, avatar, timestamps.
- videos: ownerId, title, description, sourceType, YouTube ID or private asset reference, visibility, price/currency, tags, status.
- playlists: ownerId, title, ordered video references, visibility, price/currency, status.
- questions: ownerId, title, tags, question type, public prompt, private answer/rubric, linked content, visibility, price, status.
- exams: ownerId, question references, availability, duration, attempt limits, price/access policy, status.
- examAttempts: studentId, examId, attempt number, timing, answers, submission state, score and feedback with strict visibility.
- exam attempts (incl. project submissions): examId, studentId, answers (file/repository/live URL references per slot), state, score, teacher feedback, timestamps.
- comments/reactions/ratings/follows: authorId, target type/id, value/content, moderation state, timestamps; enforce uniqueness where appropriate.
- purchases: userId, contentType/contentId, amount/currency, status, internal transaction ID, gateway session/validation references, verified transaction fields, status history.
- paymentEvents: provider identifiers, event/transaction ID, safe metadata/hash, processing state and timestamps; unique idempotency index where possible.
- entitlements: userId, contentType/contentId, sourcePurchaseId, active/revoked state, grant/revoke timestamps.
- uploads: ownerId, private storage key, display filename, detected MIME, size, checksum, purpose, scan status.
- auditLogs: actor, action, resource, outcome, request ID, timestamp; exclude secrets and private content.

### 8.1 Indexes and consistency
- Unique internal order/transaction IDs; unique gateway transaction ID where available.
- Unique idempotency key for payment events where supported.
- Indexes for content owner/status/tags/date and attempts/submissions/purchases by student and date.
- Use atomic updates and MongoDB transactions where supported by the deployed Atlas topology. Do not assume all local MongoDB setups support transactions.

## 9. Multer and upload validation
- Only parse multipart/form-data on designated upload routes.
- Set fileSize, file count, field count, and field size limits.
- Allowlist extensions and MIME types by purpose (e.g., PDF for answer sheets; selected image types for avatars). Do not accept all file types by default.
- Do not trust the client MIME type or extension. Check file signatures/magic bytes where possible and compare detected type with extension and declared MIME.
- Generate server-side storage keys; never use user filenames as paths. Defend against path traversal, double extensions, executable content, SVG/script risks, and archive bombs.
- Store uploads outside the public web root and preferably in private object storage in production. Do not commit upload files.
- Require authentication, email verification, ownership/role checks, and content-specific authorization for upload/download.
- Quarantine/scan untrusted documents where feasible before teacher access. Clean up temporary files on all success/error paths.
- Use authorized streaming or short-lived signed download URLs. Never expose private submissions through public static hosting.
- Validate multipart text fields with Zod after Multer parsing and return safe, consistent validation errors.

### 9.1 Proposed upload routes
- POST /api/v1/uploads/assignment — student assignment upload.
- POST /api/v1/uploads/content — teacher upload with role/ownership checks.
- GET /api/v1/uploads/:uploadId — authorized metadata.
- GET /api/v1/uploads/:uploadId/download — authorized stream or signed URL.

## 10. Input validation and error handling
- Validate route params, query strings, JSON bodies, multipart fields, environment variables, and payment callback fields.
- Use strict length/range/enum limits for titles, descriptions, tags, IDs, pagination, comments, URLs, and arrays.
- Never pass raw user objects into MongoDB filters; construct filters from validated fields to prevent NoSQL injection.
- Validate URL protocols. For repository/live project links, allow only http(s); avoid fetching arbitrary URLs server-side. If URL fetching is added, implement SSRF defenses.
- Use a consistent response shape, e.g. { success, data, error, requestId }. Do not expose stack traces in production.
- Map validation to 400, unauthenticated to 401, unauthorized to 403, missing to 404, conflict to 409, and unexpected errors to 500.
- Use central 404/error middleware, request IDs, and safe structured logs.

## 11. Security controls
- HTTPS in production, secure HttpOnly cookies, and deliberate SameSite settings.
- Strict CORS allowlist; never combine wildcard origin with credentialed requests.
- CSRF protection appropriate to cookie-based auth and Better Auth configuration.
- Helmet, request-body limits, and rate limits on auth, password reset, upload, comments, and payment initiation.
- Server-side authorization on every protected route and resource.
- Keep secrets in deployment secret storage; commit only placeholders in .env.example. Rotate exposed credentials.
- Use separate sandbox and live payment credentials. Client input must never switch environment or endpoints.
- Use dependency scanning, lockfile, tests, lint, and typecheck.
- Never trust frontend prices, payment status, roles, verification flags, or entitlement flags.

## 12. Route groups
- Authentication: /api/auth/* handled by Better Auth.
- Health: GET /api/v1/health and GET /api/v1/ready; do not expose secrets or connection strings.
- Profile: GET/PATCH /api/v1/me.
- Videos/playlists: public listing/detail and owner-only mutations.
- Questions: public discovery; exclude private answer/rubric fields unless authorized.
- Exams: list/detail, eligibility, start attempt, submit attempt, view results according to release rules.
- Exam attempts: start, submit, list own attempts, teacher review/grade within ownership. (Assignments were unified into project-type exams.)
- Engagement: comments, ratings, reactions, follows with validation and rate limits.
- Purchases, entitlements, payment, uploads, and admin/moderation routes as specified above.

## 13. .env.example template

```text
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

MONGODB_URI=
MONGODB_DB_NAME=learntest

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

SSLCOMMERZ_MODE=sandbox
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
SSLCOMMERZ_INIT_URL=https://sandbox.sslcommerz.com/gwprocess/v4/api.php
SSLCOMMERZ_VALIDATION_URL=https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php
SSLCOMMERZ_IPN_URL=http://localhost:4000/api/v1/payments/sslcommerz/ipn
PAYMENT_SUCCESS_URL=http://localhost:3000/payment/result
PAYMENT_FAIL_URL=http://localhost:3000/payment/result
PAYMENT_CANCEL_URL=http://localhost:3000/payment/result
PAYMENT_CURRENCY=USD

UPLOAD_STORAGE=local
UPLOAD_DIR=./private-uploads
MAX_PDF_SIZE_MB=5
MAX_PDF_FILES=1
MAX_ZIP_SIZE_MB=50
MAX_ZIP_FILES=1
MAX_VIDEO_SIZE_MB=200
MAX_VIDEO_FILES=1
MAX_IMAGE_SIZE_MB=3
MAX_IMAGE_FILES=5

OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=

MALWARE_SCAN_ENABLED=false
MALWARE_SCAN_ENDPOINT=

LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

This is a template, not a claim that every variable is automatically consumed by Better Auth. Validate environment variables at startup. Generate BETTER_AUTH_SECRET locally with a cryptographically secure command such as `openssl rand -base64 32`. Never commit .env. Production should use deployment environment settings and private object storage.

## 14. Deployment
- Deploy Express separately from Next.js and set production environment variables in the hosting dashboard.
- Configure exact FRONTEND_URL, CORS_ORIGINS, Better Auth base URL/trusted origins, and OAuth callback URLs.
- Use MongoDB Atlas network restrictions and least-privilege database credentials.
- Use persistent private object storage for production uploads; server local disks may be ephemeral.
- Keep SSLCOMMERZ in sandbox until tests pass and merchant setup is complete.
- Provide graceful shutdown, connection lifecycle management, health checks, request timeouts, and rollback instructions.

## 15. Acceptance tests
- Unverified email/password account cannot use protected features until verification succeeds.
- Google and GitHub OAuth work with correct callback URLs and role policy.
- Password reset works and secrets/passwords never appear in logs or responses.
- Student A cannot access Student B's private submission, attempt, grade, or purchase.
- Teacher cannot edit another teacher's content or grade unrelated submissions.
- Invalid body/params/multipart values are rejected.
- Oversized, disallowed, MIME-mismatched, and unauthorized uploads are rejected; private files are inaccessible without authorization.
- Sandbox payment initiation creates pending purchase and returns the gateway checkout URL.
- Fake success callback without provider validation never grants entitlement.
- Verified transaction with correct order, amount, and currency grants entitlement once.
- Wrong amount/order/currency, invalid validation, failed/cancelled payment, or risk hold does not grant ordinary access.
- Repeated IPN delivery is idempotent; payment status transitions are controlled.
- Secrets are absent from Git, API responses, and logs.
- Lint, typecheck, and automated tests pass.

## 16. Deliverables expected from the coding agent
- Complete TypeScript Express backend following this specification.
- .env.example with placeholders only and .gitignore excluding .env, uploads, logs, build output, and secrets.
- README covering local setup, Better Auth, OAuth callback configuration, SMTP, SSLCOMMERZ sandbox, testing, and deployment.
- MongoDB schemas/indexes and development seed script with no real user data.
- OpenAPI/Swagger or equivalent API documentation with auth requirements, request/response schemas, and error codes.
- Automated tests for auth guards, ownership, validation, uploads, payment state transitions, and webhook/IPN idempotency.
- List of manual provider dashboard configuration steps.
- No hard-coded credentials, fake security, frontend-only authorization, or TODO-only payment/auth core paths.

## 17. Official references
- Better Auth installation/configuration: https://better-auth.com/docs/installation
- Better Auth Express integration: https://better-auth.com/docs/integrations/express
- SSLCOMMERZ integration documentation: https://developer.sslcommerz.com/doc/v4/
- SSLCOMMERZ API reference: https://developer.sslcommerz.com/doc/v4/index.html
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/
- Multer: https://github.com/expressjs/multer
- Express security best practices: https://expressjs.com/en/advanced/best-practice-security.html

## 18. Implementation order
1. Scaffold project, validate environment, configure logging and health routes.
2. Connect MongoDB Atlas and establish schemas/indexes.
3. Implement Better Auth with email/password, email verification, Google, GitHub, and tests.
4. Implement authorization, validation, error handling, rate limiting, and CORS.
5. Implement core content, exam, assignment, submission, and engagement modules.
6. Implement private Multer uploads and authorized downloads.
7. Implement SSLCOMMERZ sandbox initiation, IPN, server-side validation, idempotency, purchases, and entitlements.
8. Add security tests, API docs, deployment instructions, and production readiness checks.

Before coding, inspect the current official Better Auth Express and MongoDB documentation for the installed version. Do not ask the developer to paste secrets into chat; leave placeholders and explain where each value is obtained.

## 19. Explicit Requirement Update: bcrypt and Role-Based Signup/Signin

### 19.1 bcrypt password hashing and comparison

The implementation must use bcrypt for email/password credentials, as explicitly requested. Better Auth uses scrypt by default, so configure its supported custom password hashing callbacks rather than implementing a separate authentication system.

```text
import { betterAuth } from "better-auth";
import bcrypt from "bcrypt";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128, // sign-in compatibility; new passwords are capped at 72 UTF-8 bytes
    password: {
      hash: async (password) => bcrypt.hash(password, 12),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
});
```
- Install bcrypt and its TypeScript types as required by the chosen runtime/package version (for example, npm install bcrypt and npm install -D @types/bcrypt).
- The hash callback receives the plaintext password and returns the bcrypt hash. The verify callback compares the submitted password with the stored hash; never write bcrypt.compare in a public route.
- A cost factor of 12 is an initial recommendation, not a universal value; benchmark on the target host and choose a cost that is secure without making login vulnerable to resource exhaustion.
- Keep password length validation and rate limits. Never log or return plaintext passwords or password hashes.
- Password policy (enforced server-side on signup, reset, and change):
  - at least 12 characters;
  - at least one uppercase letter, one lowercase letter, and one symbol (digits are optional);
  - at most 72 UTF-8 bytes, a technical limit because bcrypt silently truncates longer values.
- Enforce the policy in a Better Auth `hooks.before` handler for `/sign-up/email`, `/reset-password`, `/change-password`, and `/set-password`; never for sign-in, so existing accounts with older passwords still work.
- Test signup, login with correct and incorrect passwords, password reset, password change, and email verification after configuring bcrypt.
- Do not silently change hashing algorithms after real users exist. If the algorithm changes later, implement a verified migration/rehash strategy.

### 19.2 Role-based signup
- Provide a role choice on signup for student or teacher, if the product permits open teacher registration. Validate the value against the allowlist ['student', 'teacher']; reject every other client-supplied role.
- Persist the selected application role in a server-controlled user field or a related profile record using Better Auth's documented additional-field/custom-field configuration for the installed version.
- Never allow public signup to set role=admin. Admin assignment must be performed by a protected administrative process.
- For Google/GitHub first-time OAuth sign-in, if the role is not yet selected, route the user to a role-selection/onboarding step before granting role-protected product access. Do not infer the role from the email address or OAuth provider.
- Once a user has an established role, normal sign-in must not accept a new role in the request body or overwrite the stored role.
- If a user attempts to register with an email already linked to an account, follow Better Auth's account-linking and enumeration protections. Do not create duplicate user records manually.

### 19.3 Role-based sign-in and post-login routing
- Sign-in authenticates the account; it does not let the user choose or change their role. Read the role from the authenticated server-side user/profile record.
- After successful sign-in, the frontend may route student to the student dashboard and teacher to the teacher dashboard based on the role returned from the trusted session/profile API. This routing is for user experience only; every API endpoint must independently enforce authorization.
- A student must receive 403 when attempting a teacher-only endpoint. A teacher must receive 403 for another teacher's private resources. Only a server-authorized admin may use admin endpoints.
- Changing a role must be a separate authorized workflow with audit logging; never expose a generic PATCH endpoint that lets users set their own role.
- OAuth sign-in, email/password sign-in, and session restoration must all use the same stored role and authorization rules.

### 19.4 Acceptance tests for this update
- A new email/password signup stores a bcrypt hash, never the raw password.
- Correct password succeeds; incorrect password fails using Better Auth's bcrypt verify callback.
- Student and teacher signup choices persist correctly and cannot be changed by modifying the sign-in payload.
- A request containing role=admin during public signup is rejected or ignored safely; it never creates an admin.
- New OAuth users without a role must complete role onboarding before role-protected access.
- Post-login routing uses the stored role, but server-side authorization remains effective even if the frontend route is manually changed.

Implementation reference: Better Auth documents custom password hash/verify callbacks under emailAndPassword.password. Verify exact APIs against the installed version: https://better-auth.com/docs/reference/options and https://better-auth.com/docs/authentication/email-password.

## 20. Admin Dashboard and Administration API

LearnTest must include an administrative dashboard in the separate Next.js frontend and protected administration endpoints in the Express API. The admin dashboard is for platform operations and moderation. It is not the same as the teacher dashboard. All admin permissions must be enforced on the backend; hiding admin UI elements is not security.

### 20.1 Admin access and role protection
- Public signup and OAuth onboarding must never assign the admin role.
- Create the initial administrator only through a secure, documented bootstrap process (for example, a one-time CLI script or controlled database operation). Do not ship a public endpoint that promotes users to admin.
- Require a valid authenticated session, verified email, and server-side role=admin for all admin endpoints.
- Use a dedicated requireAdmin middleware and test it on every /api/v1/admin/* route.
- Record privileged actions in auditLogs with actor, action, target resource, timestamp, request ID, outcome, and a safe reason where appropriate.
- Consider requiring stronger account protection for admins, such as MFA where supported, short session lifetime, and re-authentication for high-impact actions.

### 20.2 Admin dashboard sections
- Overview: total users, active students/teachers, published videos/playlists/questions, exams, pending submissions requiring moderation, successful/failed/pending payments, and platform activity over time.
- User management: search/filter users; view safe profile and account status; suspend/reactivate accounts; inspect roles; handle reports. Never show password hashes, OAuth secrets, session tokens, or unnecessary private data.
- Role management: review and change student/teacher roles through a protected workflow with confirmation and audit logging. Admin assignment must require a separate high-privilege bootstrap/administrative process.
- Content moderation: review reported videos, playlists, questions, comments, and teacher profiles; hide/unpublish content; restore content; record moderation reason and moderator.
- Assessment oversight: inspect exam/assignment metadata and reports of abuse; do not expose private answers or grades beyond what is necessary for a specific authorized support/moderation task.
- Payment and purchase oversight: search purchases by internal order ID/provider transaction ID/user/status/date; view verified transaction metadata; identify pending or mismatched payments; inspect refund/dispute status. Never store or display full card numbers or CVV.
- Entitlement support: inspect access entitlement and source purchase; revoke or restore entitlement only through a reasoned, audited action. Do not manually grant paid access without an explicit privileged workflow.
- Reports and safety: triage user/content reports, record resolution, and preserve an audit trail.
- Analytics: aggregated user growth, content engagement, assessment completion, conversion, revenue totals, refund totals, and payment status. Restrict personal information to users who need it.
- System health: API readiness, database connectivity status, queue/background job status if present, and recent sanitized operational errors. Never reveal secrets, stack traces, connection strings, or environment values.
- Audit logs: filter by actor, action, resource, outcome, and date. Audit log records should be append-only for normal application workflows.

### 20.3 Suggested admin API routes
- GET /api/v1/admin/overview — summary metrics.
- GET /api/v1/admin/users — paginated, searchable user list with safe fields only.
- GET /api/v1/admin/users/:userId — authorized user detail.
- PATCH /api/v1/admin/users/:userId/status — suspend/reactivate with reason.
- PATCH /api/v1/admin/users/:userId/role — controlled student/teacher role change; never use this endpoint to create an admin.
- GET /api/v1/admin/content/reports — list content/user reports.
- PATCH /api/v1/admin/content/:contentType/:contentId/moderation — hide, restore, or reject content with reason.
- GET /api/v1/admin/payments — search verified payment/purchase records.
- GET /api/v1/admin/purchases/:purchaseId — purchase and entitlement support details.
- GET /api/v1/admin/analytics — aggregated metrics with bounded date ranges.
- GET /api/v1/admin/audit-logs — paginated audit log search.
- GET /api/v1/health and /api/v1/ready — operational health/readiness summaries; no secrets or internal configuration.

### 20.4 Admin API requirements
- Every endpoint must require authentication, verified email, and the server-side admin role.
- Use pagination and maximum date ranges; never return unbounded collections.
- Validate all filters, sort fields, IDs, action names, and moderation reasons.
- Use confirmation/step-up authentication for destructive or financially sensitive actions where supported.
- Audit role changes, suspensions, moderation decisions, entitlement changes, and payment-support actions.
- Never permit an admin UI action to alter payment verification facts. Only validated gateway evidence may mark a gateway transaction paid; administrative corrections must be separate, explicitly audited records.
- Protect against accidental exposure of private submissions, answers, grades, auth records, and personal data.
- Use soft deletion or reversible moderation where appropriate; preserve records needed for financial reconciliation and audit obligations.

### 20.5 Admin acceptance tests
- Unauthenticated and unverified users cannot access admin endpoints.
- Students and teachers receive 403 for every admin endpoint, even if they call it directly.
- Public signup, request-body tampering, and OAuth onboarding cannot create an admin.
- Suspension and moderation actions require a reason and create audit records.
- Admin lists are paginated and do not expose password hashes, tokens, secrets, or full payment-card data.
- Payment dashboard reflects server-verified records and cannot mark an unverified payment as successful.
- Entitlement changes are audited and do not rewrite gateway transaction validation results.
- Analytics responses contain aggregated data and enforce date-range limits.
