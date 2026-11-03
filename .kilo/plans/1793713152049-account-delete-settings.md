# Plan: Account Delete Option in Settings (Student + Teacher) — FIX user lookup bug

## Goal
Add a "Delete Account" action in both `/student/settings` and `/teacher/settings`. When confirmed, the user's account (auth + profile) and their data are removed, then they are signed out and redirected to `/`.

## Root Cause (current bug)
The `DELETE /api/v1/me` handler looks up the auth user with:
```ts
findOne({ id: userId }) ?? findOne({ _id: userId as any })
```
Better Auth's mongodb adapter stores `_id` as a MongoDB ObjectId. `req.user.id` is a string (from Better Auth session). `findOne({ _id: "string" })` does **not** match an ObjectId, and `findOne({ id: userId })` may also fail if the `id` field isn't present on user documents. Result: `authUser` is null → `notFound("Account not found")`.

## Fix for user lookup
1. Import `findUserByUserId` from `../services/user-roles.js` (established pattern, already used in admin routes).
2. Add ObjectId conversion: if `userId` is a valid 24-char hex string, also try `findOne({ _id: new ObjectId(userId) })`.
3. Add email fallback: `findOne({ email: req.user.email })` — email is unique in Better Auth.
4. Only throw `notFound("Account not found")` if **all** lookups fail.

## Architecture Facts (from codebase)
- **Two stores**: Better Auth `user` collection (email/password/role/roleSelected/emailVerified, accessed via `deps.authDb?.()?.collection("user")`) + Mongoose `Profile` collection (name/bio/payout/status, accessed via mongoose models).
- Auth user resolved on each request via `resolveFromProfile` → `req.user`.
- Routes mounted at `v1.use("/me", profileRouter(...))` → `DELETE /api/v1/me` goes in `Backend/src/modules/profile.routes.ts`.
- `Btn` supports `variant="danger"`. `ModalShell` + `useDialog` (`confirm`/`promptReason`) available in `Frontend/components/AlertDialog.tsx`.
- Frontend `useAuth()` provides `signOut()` and `refresh()`.
- Existing pattern: content soft-deletes (`status="hidden"`), never hard-deletes when purchases exist.

## Design Decisions (confirmed)

1. **Endpoint**: `DELETE /api/v1/me` in `profile.routes.ts`. Auth: `requireAuth` + `requireEmailVerified`. Body: `{ password: string }` for confirmation.
2. **Confirmation flow**: Both password re-entry AND typing "DELETE" to confirm (user-confirmed).
3. **Password verification**: Read the user's bcrypt hash from the `user` collection via `authDb`, compare with `bcrypt.compare()`. Reject with 400 if wrong.
4. **Teacher precondition**: Block deletion (409) if the teacher owns content with any `Purchase` status `paid` — students paid for access, can't orphan entitlements. Free-content-only teachers may proceed.
5. **Delete semantics**:
   - **Auth user** (`user` collection): hard delete.
   - **Profile**: hard delete.
   - **Owned content (teacher only)**: soft-delete `status="hidden"` on Videos/Playlists/Questions/Exams — preserves purchase records for students who already bought.
   - **User-scoped data (both roles)**: hard delete Bookmarks, Blocks (as user), Follows (as follower), Ratings (as author), Comments (as author), Reactions (as author), ExamAttempts (as student), Purchases (as buyer), Entitlements (as user).
   - **Reverse references**: Delete Follows where `teacherId = req.user.id`; delete Ratings where `targetId = req.user.id` and `targetType="teacher"`.
   - Audit log the deletion.
6. **Frontend**: Add "Delete Account" danger-zone section to both settings pages. Confirmation dialog via `ModalShell` with password input + typed "DELETE" confirmation. On success: `apiDelete("/api/v1/me")` → `signOut()` → `router.replace("/")` (user-confirmed redirect to home).
7. **No existing feature affected**: New endpoint, new UI section; existing routes untouched.

## Affected Files

### Backend
- `Backend/src/modules/profile.routes.ts` — fix user lookup in `DELETE /api/v1/me` (import `findUserByUserId`, add ObjectId + email fallback). Already has the delete handler implemented; needs lookup fix.
- `Backend/src/common/errors.ts` — no change.
- `Backend/src/models/index.ts` — no change.

### Frontend
- `Frontend/app/student/settings/page.tsx` — add delete-account section + dialog (already implemented).
- `Frontend/app/teacher/settings/page.tsx` — add delete-account section + dialog (already implemented).
- `Frontend/lib/api.ts` — `apiDelete` accepts body data (already implemented).

## Edge Cases
- Wrong password → 400 error, shown in UI, account not deleted.
- Teacher with paid sales → 409 "Cannot delete account with active paid content", shown in UI.
- OAuth-only accounts (no password hash) → 400 "password not set".
- User lookup fails (ObjectId/email fallback) → 404 "Account not found" → fixed by this plan.
- Deletion fails midway → no transaction across two stores; profile deleted first, then auth user. Audit log records outcome.

## Validation Steps
1. Backend: `cd Backend && npm run typecheck && npm run lint && npm test`
2. Frontend: `cd Frontend && npm run typecheck && npm run build`
3. Manual: sign in → Settings → Delete Account → enter wrong password → error shown. Enter correct password + type DELETE → account deleted, signed out, redirected to `/`. Teacher with paid sales → 409 blocked.

## Open Questions
None — all decisions confirmed with user:
- Confirmation: both password + typed "DELETE"
- Post-delete redirect: `/` (home)
