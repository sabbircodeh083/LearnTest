# Plan: Fix account table leftovers after user deletion

## Problem
`DELETE /api/v1/me` removes the `user` document (with id/ObjectId fallbacks) but deletes `account` rows only with `{ userId: uid }` (string). Better Auth may store `userId` as an ObjectId, so those rows remain.

## Fix
In `Backend/src/modules/profile.routes.ts` delete handler, after deleting user, delete account (and session) rows matching both string and ObjectId forms of `uid`.

## Changes
- Add ObjectId import if missing.
- Replace account deletion:
  - `accountCol.deleteMany({ userId: uid })`
  - if HEX24, also `accountCol.deleteMany({ userId: new ObjectId(uid) })`
- Same for session collection.

## Validation
- Delete account, verify no rows remain in `account`/`session` for that user.
- Run backend tests.
