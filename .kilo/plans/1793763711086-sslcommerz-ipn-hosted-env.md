# Plan: Deploy backend to hosted domain — SSLCommerz IPN cutover + OAuth state_mismatch fix

## Goal
Move the backend from localhost/Cloudflare Tunnel to `https://54-205-31-17.sslip.io` so:
1. SSLCommerz IPN callbacks reach `https://54-205-31-17.sslip.io/api/v1/payments/sslcommerz/ipn` (replacing the old trycloudflare tunnel URL)
2. OAuth sign-in works without `state_mismatch` errors
3. Frontend API calls from `https://www.easylearntest.tech` are not CORS-blocked

## Current state — no code changes required

**Backend — all values are env-driven** (verified against source):
- `Backend/src/config/env.ts:51-54` — `SSLCOMMERZ_IPN_URL` zod-validated, default `http://localhost:4000/api/v1/payments/sslcommerz/ipn`
- `Backend/src/config/env.ts:9` — `API_BASE_URL` default `http://localhost:4000`
- `Backend/src/config/env.ts:11` — `CORS_ORIGINS` default `http://localhost:3000`
- `Backend/src/config/env.ts:18` — `BETTER_AUTH_URL` default `http://localhost:4000`
- `Backend/src/config/env.ts:19` — `BETTER_AUTH_TRUSTED_ORIGINS` default `http://localhost:3000`
- `Backend/src/modules/payments/payments.routes.ts:29-30` — `success_url`/`fail_url`/`cancel_url` use `API_BASE_URL`; `ipn_url` uses `SSLCOMMERZ_IPN_URL`
- `Backend/src/modules/payments/payments.routes.ts:134` — route `POST /api/v1/payments/sslcommerz/ipn` matches new URL path
- `Backend/src/app.ts:44` — `trust proxy` set in production
- `Backend/src/app.ts:93` — CSRF exemption for `/api/v1/payments/sslcommerz/*` (IPN posts from SSLCommerz have no Origin header)
- `Backend/src/auth/auth.ts:43` — `baseURL: env.BETTER_AUTH_URL` (Better Auth OAuth base)
- `Backend/src/auth/auth.ts:48` — `trustedOrigins` from `env.BETTER_AUTH_TRUSTED_ORIGINS`
- `Backend/src/auth/auth.ts:108-112` — `useSecureCookies`/`sameSite` depend on `NODE_ENV`

**Root cause of `state_mismatch`:** `BETTER_AUTH_URL` is still `http://localhost:4000` in `.env`. OAuth is initiated against `localhost:4000` while the frontend is hosted on `https://www.easylearntest.tech` (HTTPS). The `state` cookie set by Better Auth on localhost doesn't match on callback due to cross-origin/protocol issues, and `CORS_ORIGINS` blocks the frontend's API calls to localhost.

## Changes required (env + infra only — zero source edits)

### 1. Backend `.env` — update these values:
| Variable | Current | Required |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `API_BASE_URL` | `http://localhost:4000` | `https://54-205-31-17.sslip.io` |
| `BETTER_AUTH_URL` | `http://localhost:4000` | `https://54-205-31-17.sslip.io` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:3000` | `https://www.easylearntest.tech` |
| `CORS_ORIGINS` | `http://localhost:3000` | `http://localhost:3000,https://www.easylearntest.tech` |
| `SSLCOMMERZ_IPN_URL` | `https://blocked-handles-tub-jumping.trycloudflare.com/...` | `https://54-205-31-17.sslip.io/api/v1/payments/sslcommerz/ipn` |

### 2. Frontend `.env.local` — update:
| Variable | Current | Required |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | `https://54-205-31-17.sslip.io` |

### 3. Restart the backend — `dotenv` loads at startup (`env.ts:1`); new values take effect only after restart.

### 4. Frontend rebuild/redeploy — `NEXT_PUBLIC_API_BASE_URL` is baked at build time (`next.config.mjs:8` and `lib/api.ts:3`).

### 5. Infrastructure (outside codebase):
- `https://54-205-31-17.sslip.io` resolves to `54.205.31.17`, publicly reachable on port 443 with TLS
- Firewall/security group allows inbound HTTPS from SSLCommerz callback IPs
- Remove/disable old Cloudflare Tunnel once hosted IPN is verified

## Why `NODE_ENV=production` is required
- `useSecureCookies: true` (`auth.ts:108`) — cookies marked Secure, only sent over HTTPS
- `sameSite: "none"` (`auth.ts:112`) — required for cross-site OAuth callback cookies; must be paired with Secure
- `trust proxy: 1` (`app.ts:44`) — correct client IP behind reverse proxy/load balancer

## Validation steps

1. Backend starts without env validation errors (`env.ts` zod schema passes)
2. `POST https://54-205-31-17.sslip.io/api/v1/payments/sslcommerz/ipn` returns `200` with a sample SSLCommerz-like form body
3. Frontend at `https://www.easylearntest.tech/sign-in` — click Google/GitHub → no `state_mismatch` → callback completes → redirected to `/select-role` or role home
4. Initiate a payment from frontend → confirm `ipn_url` in SSLCommerz payload is the new hosted URL
5. Trigger a real/sandbox IPN → order transitions to `paid`, entitlement granted (idempotent via `PaymentEvent` key at `payments.routes.ts:117`)
6. `cd Backend && npm run typecheck` and `npm run lint` pass
7. `cd Frontend && npm run typecheck` and `npm run lint` pass

## Failure modes

- **`state_mismatch` persists**: `BETTER_AUTH_URL` not updated, `NODE_ENV` not `production` (cookies not Secure/SameSite=None), or `trustedOrigins` missing frontend domain
- **IPN not received**: `SSLCOMMERZ_IPN_URL` not updated, backend not restarted, port 443/firewall blocking SSLCommerz
- **CORS block on frontend**: `CORS_ORIGINS` missing `https://www.easylearntest.tech` → frontend API calls fail
- **TLS handshake failure**: slsslip.io not resolving or no cert → SSLCommerz and browser can't reach backend
- **Duplicate IPN**: handled by idempotency key (`tranId:valId:ipn`) at `payments.routes.ts:116-117`

## Rollout / migration

No database migration, no schema change, no new dependencies, no source edits. Switch is env-only. Keep old Cloudflare Tunnel URL as fallback until hosted IPN is verified receiving live callbacks.

## Open questions (none blocking)

None. Both issues are env/infra configuration. Source code requires no modifications.