# Plan: OAuth first sign-in → role selection page → update user `role`

## Goal
When a user signs in with OAuth (Google/GitHub) for the first time, they land on a role-selection page; choosing student/teacher updates the `role` property (and `roleSelected` flag) on the `user` table/collection, after which they are routed to their role home.

## Current state — already implemented (no source changes required)
The full OAuth role-selection flow exists in the working tree as unstaged modifications. Evidence:

**Backend — data model (role lives on the `user` collection, not profiles)**
- `Backend/src/auth/auth.ts:68-76` — Better Auth `user.additionalFields`: `role` (default `"student"`), `roleSelected` (default `false`, `output: true`).
- `Backend/src/auth/auth.ts:78-82` — `databaseHooks.user.create.before`: sets `roleSelected` from explicit selection; `assertSignupRole` (lines 16-20) rejects `admin` self-assignment.
- `Backend/src/models/index.ts:4-5` — `ROLES = ["student","teacher","admin"]`; note at lines 13-15: role lives ONLY in the Better Auth `user` collection, profiles never store it.

**Backend — role-selection endpoint**
- `Backend/src/modules/profile.routes.ts:233-295` — `POST /api/v1/me/select-role`: `requireAuth` + zod `{ role: enum(["student","teacher"]) }`; returns `409` "Role already selected" when `roleSelected` is already true; updates `user` collection (`role` + `roleSelected: true`) and mirrors `roleSelected`/`email` on the profile; writes `user.role.select` audit.

**Backend — authorization guard**
- `Backend/src/auth/guards.ts:62-63` — `requireRoleSelected`: `403` unless `admin` or `roleSelected`.
- `Backend/src/app.ts:65` — `verified = [requireEmailVerified, requireRoleSelected]` applied to all product routers (`content`, `learning`, `engagement`, `uploads`, `payments`, `purchases`, `admin`). `/me` routes use `requireAuth` only, so onboarding works before role selection.

**Frontend — role selection page**
- `Frontend/app/select-role/page.tsx` — student/teacher choice cards; calls `POST /api/v1/me/select-role`; handles `409` conflict by refreshing and routing to `roleHome`; redirects to `roleHome(role)` after success.
- `Frontend/lib/auth.tsx:45-46` — `roleHome(role)`: admin → `/admin`, teacher → `/teacher`, else → `/student`.
- `Frontend/lib/auth.tsx:55-65` — `useRedirectIfSignedIn`: signed-in user with `!roleSelected && role !== "admin"` → `/select-role`.
- `Frontend/app/sign-in/page.tsx:101-111` — OAuth social sign-in posts `/api/auth/sign-in/social` with `callbackURL=/select-role`; fallback GET to provider; the sign-in guard also routes a freshly OAuth-signed-in un-onboarded user to `/select-role`.

**Spec:** `frontend.md §4.2.7` "OAuth Onboarding" documents `POST /api/v1/me/select-role`, student/teacher choices, and `409` handling — matches the implementation.

## Changes required
None. The feature is implemented. The remaining work is validation only:

1. `cd Backend && npm run typecheck` — must pass (`tsc --noEmit`)
2. `cd Backend && npm run lint` — must pass (`eslint src scripts tests`)
3. `cd Backend && npm test` — vitest suite must pass (includes `tests/role-source.test.ts`, `tests/guards.test.ts` covering `roleSelected`/`403`)
4. `cd Frontend && npm run typecheck` — `tsc --noEmit` must pass
5. `cd Frontend && npm run lint` — `next lint` must pass
6. Manual E2E:
   - OAuth sign-in (Google/GitHub) first time → lands on `/select-role` → pick student/teacher → `200`, `user.role` + `user.roleSelected` updated → routed to `/student` or `/teacher`.
   - Re-sign in after selection → not sent back to `/select-role` (goes straight to role home).
   - Repeat `POST /api/v1/me/select-role` → `409` handled gracefully, routed to role home.
   - OAuth user attempts a product feature before selecting role → `403` "Role selection required".

## Failure modes
- `POST /api/v1/me/select-role` when already selected → `409` (frontend handles, no duplicate write).
- OAuth user with no email verification: `requireEmailVerified` is part of `verified`, so email verification is enforced before product features; select-role itself only needs `requireAuth`.
- Admin OAuth user → `roleSelected` irrelevant; routed to `/admin` directly.

## Rollout / migration
None. Schema already carries `role`/`roleSelected` on the `user` collection. OAuth users default to `role="student"`, `roleSelected=false` and are routed to onboarding; no backfill needed.

## Notes
- All related files are currently **unstaged working-tree modifications** (see `git status`). Committing is out of scope unless explicitly requested.
- No new dependencies, environment variables, or route additions are required.

## Open questions (none blocking)
None — the implementation matches the spec. If the user wants the changes committed, that requires a separate explicit request (I do not commit without being asked).