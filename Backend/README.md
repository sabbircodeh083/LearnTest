# LearnTest Backend

Express + TypeScript + MongoDB (Mongoose) + Better Auth (bcrypt) + SSLCOMMERZ REST API for the separate Next.js frontend.

## Local setup

```bash
npm install
cp .env.example .env   # fill values below; never commit .env
npm run dev            # http://localhost:4000  (docs: /api/docs, spec: /api/docs/openapi.json)
npm test && npm run typecheck && npm run lint && npm run build
```

Generate the auth secret: `openssl rand -base64 32` → `BETTER_AUTH_SECRET`.

## Where each secret comes from (manual provider steps)

| Value                          | Obtained from                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                  | MongoDB Atlas → Database → Connect → Drivers. Create a least-privilege DB user; restrict Network Access to your API host.                                                                                               |
| `GOOGLE_CLIENT_ID/SECRET`      | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web client. Authorized redirect: `http://localhost:4000/api/auth/callback/google` (prod: `https://<api-domain>/api/auth/callback/google`).             |
| `GITHUB_CLIENT_ID/SECRET`      | GitHub → Settings → Developer settings → OAuth Apps. Callback: `http://localhost:4000/api/auth/callback/github` (prod equivalent).                                                                                      |
| `SMTP_*`                       | Your SMTP/email provider (e.g. Resend/SES/Mailgun SMTP creds). Required for verification & reset mail in production.                                                                                                    |
| `SSLCOMMERZ_STORE_ID/PASSWORD` | SSLCOMMERZ merchant panel (sandbox first). Set IPN URL there to `https://<api-domain>/api/v1/payments/sslcommerz/ipn`. Localhost cannot receive IPN — use a public HTTPS tunnel (e.g. ngrok) or a deployed sandbox API. |

Keep dev and production URLs/credentials separate. `SSLCOMMERZ_MODE=live` with a sandbox endpoint is rejected at startup.

## Auth & roles (§4, §19)

- Better Auth mounted at `/api/auth/*` (official Express `toNodeHandler`), MongoDB adapter.
- Email/password uses **bcrypt** via `emailAndPassword.password.hash/verify` (`bcrypt.hash(p,12)` / `bcrypt.compare`) — no custom password store, no manual compares in routes.
- Verification required before protected features (`requireEmailVerified`); reset uses Better Auth's token flow by email.
- Signup role allowlist is `student|teacher` only; `admin` is rejected by a DB hook. Sign-in never accepts a role. OAuth first-time users (default role, `roleSelected=false`) must `POST /api/v1/me/select-role` once before role-protected access. `PATCH /api/v1/me` cannot change role (strict schema).
- First admin: sign up + verify normally, then `ADMIN_EMAIL=you@example.com npm run create-admin`. No public promotion endpoint.
- Frontend routes students/teachers to their dashboards from `GET /api/v1/me` — UX only; every API route re-checks authorization.

## Payments (§7)

`POST /api/v1/payments/sslcommerz/initiate` takes only `{contentType, contentId}`; price/currency are loaded from MongoDB. A pending `Purchase` is created before gateway initiation. Browser success/fail/cancel and IPN are **untrusted**: entitlement is granted only after the server calls the SSLCOMMERZ Validation API and `evaluateValidation` confirms `VALID/VALIDATED` + matching tran_id/amount/currency; `risk_level=1` is held. Settlement is atomic and idempotent (unique tran/payment-event/entitlement indexes) — duplicate IPNs do not duplicate entitlements. Refunds are not implemented (status `refunded` reserved; no endpoint rewrites gateway facts).

Reconciliation of stuck `pending` orders: re-deliver IPN or call the validation flow again for the order's `valId`; terminal states (`paid/failed/cancelled/expired`) cannot transition further except the documented `risk_hold → paid/failed`.

## Uploads (§9)

Multer only on `/api/v1/uploads/*` with size/file/field limits. Extensions + **magic bytes** (file-type) + declared MIME must all agree; SVG/executables are never allowed. Server-generated storage keys, SHA-256 checksums, private dir outside the web root, authorized download only (owner, assignment-owning teacher, or admin). Production: set `UPLOAD_STORAGE=s3` credentials and move storage to private object storage (local disk is dev-only; malware scanning hook: `MALWARE_SCAN_ENABLED`).

## Malware scanning (Bouncer)

Every upload is scanned with [Bouncer](https://usebouncer.dev/docs/) before anyone can download it.

**Account & key (manual steps):** sign up at usebouncer.dev → Dashboard → API Keys → create a key (`bnc_live_…`, shown once) → set `BOUNCER_API_KEY` in the backend `.env` only. Never put it in Next.js (`NEXT_PUBLIC_*`), an API response, or logs (logger redacts it; the scan service never logs the key or v2 upload fields).

**How it works:** `MALWARE_SCAN_ENABLED=true` → the file is stored under the private `quarantine/` prefix (Cloudflare R2 bucket must stay private — no public access / r2.dev; local disk mirrors this under `UPLOAD_DIR` in dev), recorded as `scanStatus=pending_scan`, and scanned asynchronously by `src/services/malware-scan.ts` (separate from route handlers; provider is replaceable). Files ≤ ~4.5 MB use `POST /v1/scan`; larger files use the documented v2 flow (`POST /v2/scan` → direct-to-storage upload → poll `GET /v1/scan/:id`) up to your tier limit (Free 25 MB / Pro 100 MB via v2), also bounded by `MAX_UPLOAD_SIZE_MB`. Polling is bounded (`MALWARE_SCAN_POLL_*`, default 15 × 2 s), requests time out (`MALWARE_SCAN_TIMEOUT_MS`), transient 5xx/429 responses retry with backoff (`MALWARE_SCAN_MAX_RETRIES`, honoring `Retry-After`).

**Verdict mapping & fail-closed policy:** `clean → clean` (only state that promotes the file out of quarantine to `files/` and allows download), `suspicious → suspicious`, `malicious → infected`, engine failure/timeout/quota/auth/network errors → `scan_failed`. Suspicious, infected, pending, and failed files return `403` on download and stay quarantined. Scanning enabled but unavailable never marks a file clean; an authorized owner/admin can retry with `POST /api/v1/uploads/:id/rescan`. Auth, ownership, size limits, extension/MIME allowlists, and magic-byte checks are enforced independently of scanning.

**Quotas:** account-level, monthly (Free: 500 scans/mo, 25 MB max via v2; Pro: 10,000/mo, 100 MB). Quota exhaustion returns 429 `rate_limit_exceeded` → uploads stay `scan_failed`/quarantined until the period resets or the plan is upgraded. Check usage with `GET /v1/scan/usage` using your key.

**Disabled policy (`MALWARE_SCAN_ENABLED=false`):** scanning is off by explicit operator choice. Files are stored approved but recorded as `scanStatus=disabled` — unscanned, **never** labelled `clean`. If your policy requires scanning, leave it enabled; enabling it without `BOUNCER_API_KEY` fails startup.

**Testing:** `npm test` mocks the Bouncer API (clean, suspicious, malicious, pending/poll-exhaustion, timeout, quota, invalid-key, unavailable, retry, and >4.5 MB v2 scenarios). A real-account smoke test (not in CI) needs a valid key: set `MALWARE_SCAN_ENABLED=true`, upload a harmless PDF, confirm `pending_scan → clean` and download works; upload the EICAR test string in a file to confirm it is blocked as infected.

**Deployment:** set `MALWARE_SCAN_ENABLED=true`, `BOUNCER_API_KEY`, `UPLOAD_STORAGE=s3` with the R2 `OBJECT_STORAGE_*` values, and a private bucket in the host dashboard; redeploy and watch logs for `malware scan completed` (scan IDs only).

## Tests

`npm test` — covering bcrypt, signup-role rejection, payment validation/state transitions/idempotency, upload type rules, guard/ownership/validation/admin-403 behavior via injected sessions, and the mocked Bouncer suite above (no DB or real Bouncer account needed). DB-backed acceptance flows (real OAuth, Atlas, SSLCOMMERZ sandbox IPN, real Bouncer scan) require the provider setup above.

## Deployment

Deploy separately from Next.js. Set production env in the host dashboard, exact `FRONTEND_URL`/`CORS_ORIGINS`/`BETTER_AUTH_URL`/trusted origins and OAuth callbacks, Atlas IP allowlist, private object storage, HTTPS (secure `HttpOnly` cookies, `SameSite=None` cross-site). Graceful shutdown on SIGTERM/SIGINT; `GET /api/v1/health` (liveness) and `/api/v1/ready` (DB readiness). Rollback: redeploy the previous build artifact; migrations are additive indexes only.
