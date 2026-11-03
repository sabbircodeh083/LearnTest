# Plan: Fix Password Hash Lookup in DELETE /api/v1/me

## Goal
Fix `DELETE /api/v1/me` so that regular email/password accounts can be deleted. Currently the handler checks `authUser.password` on the `user` collection document, but Better Auth's mongodb adapter stores the password hash in a separate `account` collection (model `"account"`), not on the `user` document. This causes `storedHash` to be `undefined` and throws "This account has no password set" for every email/password account.

## Root Cause
- `Backend/src/modules/profile.routes.ts:147-153`: Reads `(authUser as any).password ?? (authUser as any).passwordHash` from the user document.
- Better Auth's mongodb adapter stores credential data (including `password` hash) in a separate `account` collection, linked by `userId` with `provider: "email"`.
- The `user` document never has a `password` field, so `storedHash` is always falsy → 400 error for all accounts.

## Evidence
From `Backend/node_modules/better-auth/dist/db/internal-adapter.mjs`:
- `updatePassword: async (userId, password) => { await updateManyWithHooks({ password }, [...], "account", void 0); }` — writes hash to `account` model
- `findAccountByKey` — queries `model: "account"`
- `findMany({ model: "account", ... })` — accounts stored separately from users

## Changes Required

### 1. `Backend/src/modules/profile.routes.ts`
After finding `authUser` in the `user` collection, also look up the `account` collection for the user's email/password credential:

```ts
// Look up the credential account to get the password hash.
// Better Auth stores passwords in a separate `account` collection, not on the `user` document.
const accountCol = deps.authDb?.()?.collection("account");
let storedHash: string | undefined;
if (accountCol) {
  const credential = await accountCol
    .findOne({ userId: authUser.id, provider: "email" })
    .catch(() => null);
  storedHash = credential?.password;
}

if (typeof storedHash !== "string" || !storedHash) {
  throw badRequest("This account has no password set — account deletion is not available.");
}

const passwordValid = await bcrypt.compare(password, storedHash);
if (!passwordValid) throw badRequest("Incorrect password.");
```

This replaces the current lines 147-153:
```ts
const storedHash = (authUser as any).password ?? (authUser as any).passwordHash;
if (typeof storedHash !== "string" || !storedHash) {
  throw badRequest("This account has no password set — account deletion is not available.");
}
const passwordValid = await bcrypt.compare(password, storedHash);
if (!passwordValid) throw badRequest("Incorrect password.");
```

Keep `bcrypt` import (still used for comparison). No new imports needed.

## Validation
1. `cd Backend && npm run typecheck` — must pass
2. `cd Backend && npm run lint` — must pass
3. `cd Backend && npm test` — all 69 existing tests must pass
4. Manual: email/password user → Settings → Delete Account → enter correct password → account deleted, signed out, redirected to `/`. Wrong password → 400 "Incorrect password."

## Edge Cases
- Email/password account with correct password → deletion proceeds (fixed)
- Email/password account with wrong password → 400 "Incorrect password." (unchanged)
- OAuth-only account (no email credential) → `accountCol.findOne({ provider: "email" })` returns null → 400 "no password set" (expected — OAuth users can't delete via password flow)
- Account collection unavailable → `accountCol` is undefined → `storedHash` stays undefined → 400 "no password set"

## Rollback
Revert `Backend/src/modules/profile.routes.ts` password lookup block to the previous version (check `authUser.password` on user document).
