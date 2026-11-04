# Plan: Fix role selection page disappearing after sign-in

## Problem
Role selection page (`/select-role`) appears then immediately redirects away, preventing users from choosing a role.

## Likely root causes
1. `Frontend/app/select-role/page.tsx:17` redirects when `user.roleSelected || user.role === "admin"`. For OAuth users, `roleSelected` may be reported true due to profile mirror (`Backend/src/auth/guards.ts:86` uses `Boolean(u.roleSelected || profile.roleSelected)`), so the page bounces to role home.
2. `Frontend/lib/auth.tsx:61` and `AppShell.tsx:74` redirect unselected users to `/select-role`, but if `/api/v1/me` reports roleSelected true (stale profile), the flow never shows selection.

## Investigation steps
- Verify GET `/api/v1/me` response roleSelected for a fresh OAuth user.
- Check profile mirror sync logic in `resolveFromProfile` for OR-ing roleSelected.
- Ensure new OAuth users have roleSelected=false in both `user` and `profile`.

## Fix direction
- Make roleSelected authoritative from `user` collection only, not OR with profile.
- Ensure select-role page does not redirect prematurely before user state settles.

## Validation
- OAuth sign-in lands on /select-role and stays until selection.
- After selection, redirects to role home.
- Email/password users with roleSelected true skip selection.
