# LearnTest Backend — API Call Reference

Base URL: `http://localhost:4000`. Every response is `{ success, data, error, requestId }`. `🔒` = needs a logged-in session cookie. Most `🔒` routes also need a verified email and a selected role (`student`/`teacher`; admins bypass role selection).

## Health (public)

```http
GET /api/v1/health
GET /api/v1/ready
```

## Auth — `🔒` via session cookie from `/api/auth/*`

Better Auth handles signup/sign-in/OAuth under `/api/auth/*` (see Swagger `/api/docs`). Then call:

```http
GET   /api/v1/me                 🔒  Get my profile + stored role (includes hasPassword)
PATCH /api/v1/me                 🔒  Body: { "name"?, "bio"?, "avatarUploadId"? } (role not editable)
DELETE /api/v1/me                🔒  Body: { "password"? } (password required for email/password accounts)
POST  /api/v1/me/select-role     🔒  Body: { "role": "student" | "teacher" } (only while roleSelected=false, e.g. OAuth signup)
```

## Videos — list/detail are public-ish, writes need teacher/admin `🔒`

```http
GET    /api/v1/videos?page=1&limit=20&search=text
GET    /api/v1/videos/:id
POST   /api/v1/videos            🔒  Body below
PATCH  /api/v1/videos/:id        🔒  Body: any of the POST fields
DELETE /api/v1/videos/:id        🔒  (soft delete → hidden)
```

POST body:

```json
{ "title": "Intro", "description": "", "tags": [], "visibility": "public|private|unlisted", "status": "draft|published", "price": 0, "currency": "USD", "sourceType": "youtube|upload", "youtubeId": "", "assetUploadId": null }
```

## Playlists — same pattern as videos `🔒` writes need teacher/admin

```http
GET    /api/v1/playlists?page=1&limit=20&search=text
GET    /api/v1/playlists/:id
POST   /api/v1/playlists         🔒  Same base fields as videos + { "videoIds": ["<videoId>"] }
PATCH  /api/v1/playlists/:id     🔒  Any editable field, incl. "videoIds"
DELETE /api/v1/playlists/:id    🔒
```

## Questions — answers/rubrics hidden unless authorized

```http
GET    /api/v1/questions?page=1&limit=20&search=text
GET    /api/v1/questions/:id
POST   /api/v1/questions         🔒  Base fields + { "type": "mcq|short|code", "prompt": "...", "answer": "", "rubric": "" }
PATCH  /api/v1/questions/:id     🔒
DELETE /api/v1/questions/:id     🔒
```

## Exams & attempts

```http
GET   /api/v1/my-tests?page=1&limit=20&type=quiz|written|problem|project&tab=all|published|drafts|archived   🔒 teacher  Unified list of all own tests by kind/status
GET   /api/v1/exams?page=1&limit=20
GET   /api/v1/exams/:id
GET   /api/v1/exams/:id/preview            Student-safe preview (item details only when free/entitled/owner)
POST  /api/v1/exams                        🔒 teacher  Body: base fields + { "questionIds": [], "durationMinutes": 60, "maxAttempts": 1, "startsAt": "2026-01-01T00:00:00Z"?, "endsAt"?, "accessPolicy": "free|paid|enrolled", "kind": "quiz|written|problem|project" }
PATCH /api/v1/exams/:id                    🔒 teacher (owner)
DELETE /api/v1/exams/:id                   🔒 teacher (owner)  Hard delete + its unused owned questions
GET   /api/v1/exams/:id/attempts?latest=1&submittedOnly=1&pendingOnly=1   🔒 teacher (owner)  Attempts with student identity
POST  /api/v1/exams/:id/attempts            🔒 student  No body — starts attempt (checks window, purchase, attempt limit)
PATCH /api/v1/exam-attempts/:id/submit      🔒 student  Body: { "answers": { "<questionId>": <answer> } }
GET   /api/v1/exam-attempts/me?page=1&limit=20   🔒 student
GET   /api/v1/exam-attempts/:id             🔒 (score hidden from student until graded)
PATCH /api/v1/exam-attempts/:id/grade       🔒 teacher (exam owner)  Body: { "score": 85, "feedback": "..." }
```

## Project & written submissions (via exams)

Assignments were unified into project-type exams. Students submit through exam attempts; teachers grade through the queue below.

```http
GET   /api/v1/submission-queue/items?state=pending|graded&type=written|project   🔒 teacher  Grading queue: latest attempt per student per written/project test
PATCH /api/v1/exam-attempts/:id/grade       🔒 teacher (exam owner)  Body: { "score": 85, "feedback": "..." } or itemized { "breakdown": [...] }
```

## Comments / reactions / ratings / follows / reports `🔒`

```http
GET    /api/v1/comments?targetType=video&targetId=<id>&page=1&limit=20
POST   /api/v1/comments           Body: { "targetType": "video|playlist|question|exam", "targetId": "<id>", "content": "..." }
POST   /api/v1/reactions          Body: { "targetType": "...", "targetId": "<id>", "value": "like|dislike" }  (same value again removes it; other value switches)
GET    /api/v1/reactions/summary?targetType=...&targetId=...
POST   /api/v1/ratings            Body: { "targetType": "video|playlist|question|exam|teacher", "targetId": "<id>", "value": 1-5 }
GET    /api/v1/ratings/summary?targetType=...&targetIds=id1,id2
POST   /api/v1/follows            Body: { "teacherId": "<userId>" }
DELETE /api/v1/follows/:id
GET    /api/v1/follows/me?page=1&limit=20
GET    /api/v1/follows/followers?page=1&limit=20   🔒 teacher  Own followers with safe profile fields
GET    /api/v1/bookmarks/me?page=1&limit=20
POST   /api/v1/bookmarks          Body: { "targetType": "...", "targetId": "<id>" }
DELETE /api/v1/bookmarks/:targetType/:targetId
GET    /api/v1/blocks/me?page=1&limit=20
POST   /api/v1/blocks             Body: { "teacherId": "<userId>" }
DELETE /api/v1/blocks/:teacherId
GET    /api/v1/teachers?page=1&limit=20&search=text   Public teacher profiles (safe fields)
GET    /api/v1/teachers/:id       Public teacher profile
POST   /api/v1/reports            Body: { "targetType": "...", "targetId": "<id>", "reason": "..." (min 3 chars) }
```

## Uploads — multipart file, Bouncer-scanned before download `🔒`

Send as `multipart/form-data` with field name `file` (PDF/ZIP for test submissions; PDF/MP4/PNG/JPG/WEBP for content; PNG/JPG/WEBP for avatars/covers; max 10 MB default):

```http
POST /api/v1/uploads/assignment   🔒 student  Test-file upload. Extra fields: relatedId=<attemptId>
POST /api/v1/uploads/content      🔒 teacher
POST /api/v1/uploads/avatar       🔒 any verified user
POST /api/v1/uploads/cover        🔒 any verified user
GET  /api/v1/uploads/:id          🔒  Metadata incl. scanStatus (pending_scan → clean | suspicious | infected | scan_failed)
GET  /api/v1/uploads/:id/download 🔒  File bytes — only when scan is clean (403 otherwise)
```

## Payments (SSLCOMMERZ) / purchases / entitlements

```http
POST /api/v1/payments/sslcommerz/initiate   🔒  Body: { "contentType": "video|playlist|question|exam", "contentId": "<id>" } → { purchaseId, tranId, gatewayUrl }
POST /api/v1/payments/sslcommerz/ipn        Provider callback (validates server-to-server; only this grants access)
POST /api/v1/payments/sslcommerz/success    Browser return → redirects to frontend result page
POST /api/v1/payments/sslcommerz/fail       Browser return → redirects to frontend result page
POST /api/v1/payments/sslcommerz/cancel     Browser return → redirects to frontend result page
GET  /api/v1/purchases/me                   🔒  My last 100 purchases
GET  /api/v1/purchases/statement?page=1&limit=20&search=text&type=video|playlist|quiz|written|problem|project   🔒  Own statements with content title + teacher
GET  /api/v1/purchases/sales/me?page=1&limit=20   🔒 teacher  Purchases of own content with buyer + content title
GET  /api/v1/purchases/payouts/me           🔒 teacher  Earned / paid-out / due + payout history
GET  /api/v1/entitlements/:contentType/:contentId   🔒  → { entitled: true|false }
```

## Admin — every route needs admin role `🔒`

```http
GET   /api/v1/admin/overview
GET   /api/v1/admin/users?page=1&limit=20&search=text&role=student&status=active
GET   /api/v1/admin/users/:userId
PATCH /api/v1/admin/users/:userId/status   Body: { "status": "active|suspended", "reason": "..." }
PATCH /api/v1/admin/users/:userId/role     Body: { "role": "student|teacher", "reason": "..." } (never creates admin)
GET   /api/v1/admin/content/reports?page=1&limit=20
GET   /api/v1/admin/content/:contentType/:contentId   Admin preview of reported content
PATCH /api/v1/admin/content/:contentType/:contentId/moderation   Body: { "action": "hide|restore|reject", "reason": "..." }
GET   /api/v1/admin/payments?page=1&limit=20&status=pending&userId=...&tranId=...
GET   /api/v1/admin/purchases/:purchaseId
GET   /api/v1/admin/payouts
GET   /api/v1/admin/payouts/:teacherId
POST  /api/v1/admin/payouts/:teacherId   Body: { "amount": 1000, "note": "..." }  (cannot exceed due payout)
GET   /api/v1/admin/analytics?from=2026-01-01T00:00:00Z&to=2026-01-31T00:00:00Z   (max 366 days)
GET   /api/v1/admin/audit-logs?page=1&limit=20&actorId=...&action=...
```

## Docs

```http
GET /api/docs              Interactive Swagger UI
GET /api/docs/openapi.json Raw OpenAPI JSON
```

Common query params on list routes: `page` (default 1), `limit` (default 20, max 100), `search`, `status`. Error shape for bad calls: `{ success: false, data: null, error: { code, message }, requestId }` with 400 validation / 401 unauthenticated / 403 forbidden / 404 not found.
