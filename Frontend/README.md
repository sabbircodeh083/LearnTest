# LearnTest Frontend

Next.js (App Router) frontend for the LearnTest backend API in `../Backend`.
Specification: [frontend.md](frontend.md)

## Run

Backend first (port 4000), then frontend (port 3000):

```bash
# Backend — from ../Backend
npm run dev

# Frontend — from this folder
npm install --cache /tmp/npm-cache   # only if the default npm cache is read-only
npm run dev                          # dev server
# or: npm run build && npm run start
```

Open http://localhost:3000 in your browser.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | Public API origin only. Never put backend secrets in `NEXT_PUBLIC_*` variables. |

Sessions are Better Auth cookies: every API call sends `credentials: "include"`,
and the role is always read back from `GET /api/v1/me` — never from a form or local storage.

## What is wired to the real API

- Auth: sign-up (student/teacher only), sign-in (no role sent), email-verification
  notice, OAuth role onboarding (`POST /api/v1/me/select-role`, 409-safe), sign-out.
- Student: question-first home, questions + detail, videos + playback, exams
  (start / answer / submit), assignments (PDF/ZIP upload + scan state + submission),
  submissions, results (hidden until graded), purchases, following teachers, settings.
- Teacher Studio: dashboard counts from own content, videos/playlists/questions/
  exams/assignments CRUD with publish/hide, highlighted-question search by title
  and `#tags`, submission + exam-attempt grading, honest analytics/earnings.
- Admin: overview, users (role change + suspend, reason required, never admin),
  payments, report moderation, analytics, audit logs.
- Payments: `POST /api/v1/payments/sslcommerz/initiate` (no client amount),
  redirect to the returned gateway URL, and `/payment/result` which only reports
  the server-confirmed purchase state from `GET /api/v1/purchases/me`.

Pages without a backend contract (teacher payouts) say so plainly
instead of showing invented data.

## Backend sync additions

Three small endpoints were added to `../Backend` so the spec's flows work end to end,
and documented in its OpenAPI:

- `GET /api/v1/teachers` — active teacher profiles (safe fields) for discovery/follow.
- `GET /api/v1/follows/me` — the signed-in user's followed teachers.
- `GET /api/v1/exam-attempts/:id/questions` — attempt questions with
  answers/rubrics stripped for the student owner.
- `GET /api/v1/bookmarks/me`, `POST /api/v1/bookmarks`,
  `DELETE /api/v1/bookmarks/:targetType/:targetId` — saved videos/tests.

## Verify

```bash
npm run typecheck
npm run build
```
