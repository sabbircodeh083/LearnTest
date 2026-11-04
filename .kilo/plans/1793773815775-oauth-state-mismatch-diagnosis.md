# Plan: Diagnose and fix OAuth state_mismatch

## Problem
Backend logs show Better Auth errors:
- `User already exist but account isn't linked to google` / `account_not_linked`
- `Failed to parse state [StateError: State mismatch: verification not found]` (code `state_mismatch`), state `bx75b10_fTxhPOQJcSZHPiQZVFtzuMmw`

## Root cause
`BETTER_AUTH_URL` is `http://localhost:4000` while frontend is hosted on `https://www.easylearntest.tech`. OAuth initiates against localhost; the state cookie set by Better Auth doesn't match on callback due to cross-origin/protocol mismatch, and `CORS_ORIGINS` blocks frontend API calls. Additionally `NODE_ENV=development` disables Secure/SameSite=None cookies required for cross-site OAuth.

## Fix (env + infra only, no source edits)
Update Backend `.env`:
- `NODE_ENV` → `production`
- `API_BASE_URL` → `https://54-205-31-17.sslip.io`
- `BETTER_AUTH_URL` → `https://54-205-31-17.sslip.io`
- `BETTER_AUTH_TRUSTED_ORIGINS` → `https://www.easylearntest.tech`
- `CORS_ORIGINS` → `http://localhost:3000,https://www.easylearntest.tech`

Frontend `.env.local`: `NEXT_PUBLIC_API_BASE_URL` → `https://54-205-31-17.sslip.io`. Rebuild frontend (build-time baked). Restart backend.

## account_not_linked note
Existing user with same email but no linked Google account. Either link accounts or use a different email; not a state_mismatch cause.

## Validation
- Backend starts without env validation errors
- Frontend sign-in Google/GitHub completes without state_mismatch, redirects to /select-role or role home
- `cd Backend && npm run lint && npm run typecheck` pass

## Open questions
- None.
