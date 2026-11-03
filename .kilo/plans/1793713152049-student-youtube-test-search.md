# Plan: Student YouTube URL → test search by videoId (live/debounced search, backward compatible)

## Goal
When a student pastes a YouTube video URL into the Practice Tests search bar, extract the YouTube video ID and return tests whose `videoId` matches. Works as live/debounced search. Existing behavior must be unchanged when no search is typed.

## Constraints (must hold)
- No existing feature affected: when `search` is empty/absent, `GET /api/v1/exams` returns exactly as before (all published tests, sorted newest first).
- Backend search only activates when `search` query param is present and non-empty.
- Frontend live search is debounced (already uses `setTimeout` 350ms); no extra network bursts.
- No new API endpoint; reuse existing `GET /api/v1/exams` with its existing `pagination` schema (already has `search: z.string().max(100)`).

## Affected files

### Backend
- `Backend/src/modules/learning.routes.ts` — `GET /api/v1/exams` (student-facing, line 77): currently ignores `search`. Add optional `search` filtering with `$or` on `videoId`, `title`, `description`, using the same regex-escaping pattern as the `my-tests` route (line 39-41). Only apply when `esc` is non-empty.

### Frontend
- `Frontend/lib/url.ts` — add `extractYouTubeVideoId(url: string): string | null` supporting: `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`, `m.youtube.com/watch?v=ID`, raw 11-char ID.
- `Frontend/components/discover.tsx` — `PracticeTests` component:
  - Import `extractYouTubeVideoId`.
  - On each debounced change, if input is a YouTube URL, extract ID and search by `videoId`; otherwise fall back to plain text search on `title`/`description`/`videoId`.
  - Add `videoId: string` to `TestRow` interface and map from `e.videoId`.
  - Keep the existing sort (kind filter), saved/purchased/blocked filters intact.

## Design decisions
1. Backend filter shape: `{ ...filter, $or: [{ videoId: { $regex: esc, $options: "i" } }, { title: { $regex: esc, $options: "i" } }, { description: { $regex: esc, $options: "i" } }] }` — identical escaping to `my-tests`.
2. Frontend sends single `search` param to the same endpoint; backend decides whether to match by ID or text.
3. Empty search → no `$or` → unchanged existing results.

## Edge cases
- Non-YouTube URL → plain text search (title/description/videoId).
- Invalid/malformed URL → `extractYouTubeVideoId` returns null → plain text search.
- Empty input → `search` undefined → returns all published tests (existing behavior).
- No matches → existing "No tests found" Empty state.
- YouTube ID is 11 chars; backend `videoId` maxlength is 100 — no schema change.

## Validation steps
1. Backend: `cd Backend && npm run typecheck && npm run lint && npm run test`
2. Frontend: `cd Frontend && npm run typecheck && npm run lint && npm run build`
3. Manual: paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → only tests with `videoId === "dQw4w9WgXcQ"` appear; empty input → all tests as before.

## Open questions
None.
