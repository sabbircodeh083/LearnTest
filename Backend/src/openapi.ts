export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "LearnTest API",
    version: "1.0.0",
    description:
      "Auth via Better Auth at /api/auth/* (cookie session). Protected routes return 401/403 as documented per-route in schemas. Errors: {success,data,error:{code,message},requestId}.",
  },
  servers: [{ url: "http://localhost:4000" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
      },
    },
  },
  paths: {
    "/api/v1/health": {
      get: { summary: "Liveness", responses: { "200": { description: "OK" } } },
    },
    "/api/v1/config": {
      get: { summary: "Public client config (upload limits + currencies, from .env)", responses: { "200": { description: "OK" } } },
    },
    "/api/v1/ready": {
      get: {
        summary: "Readiness (DB)",
        responses: {
          "200": { description: "Ready" },
          "503": { description: "Not ready" },
        },
      },
    },
    "/api/auth/sign-up/email": {
      post: {
        summary:
          "Better Auth signup — body: {name,email,password,role?: student|teacher}; admin rejected",
        responses: {
          "200": { description: "Created (verification email sent)" },
          "400": { description: "Validation / role error" },
        },
      },
    },
    "/api/auth/sign-in/email": {
      post: {
        summary:
          "Better Auth sign-in {email,password} (role is never accepted)",
        responses: {
          "200": { description: "Session cookie set" },
          "401": { description: "Bad credentials / unverified" },
        },
      },
    },
    "/api/v1/me": {
      get: {
        summary: "Current profile/role",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Profile" },
          "401": { description: "Unauthenticated" },
        },
      },
      patch: {
        summary: "Update safe profile fields (not role)",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Profile" },
          "400": { description: "Validation" },
        },
      },
    },
    "/api/v1/me/select-role": {
      post: {
        summary: "OAuth onboarding role choice (student|teacher, once)",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Role set" },
          "409": { description: "Already selected" },
        },
      },
    },
    "/api/v1/videos": {
      get: { summary: "List published videos" },
      post: {
        summary: "Create video (teacher, verified)",
        security: [{ cookieAuth: [] }],
        responses: {
          "201": { description: "Created" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/v1/exams/{id}/attempts": {
      get: {
        summary: "List attempts on an exam (owning teacher, verified; latest=1 current per student, submittedOnly=1 hides in_progress, pendingOnly=1 hides graded too)",
        security: [{ cookieAuth: [] }],
      },
      post: {
        summary: "Start exam attempt (student)",
        security: [{ cookieAuth: [] }],
        responses: {
          "201": { description: "Attempt" },
          "409": { description: "Limit reached" },
        },
      },
    },
    "/api/v1/uploads/assignment": {
      post: {
        summary:
          "Student test-file upload (multipart, PDF/ZIP, magic-byte checked)",
        security: [{ cookieAuth: [] }],
        responses: {
          "201": { description: "Upload metadata" },
          "400": { description: "Type/size rejected" },
        },
      },
    },
    "/api/v1/payments/sslcommerz/initiate": {
      post: {
        summary: "Initiate payment {contentType,contentId} — price from DB",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "{purchaseId,tranId,gatewayUrl}" } },
      },
    },
    "/api/v1/payments/sslcommerz/ipn": {
      post: {
        summary: "SSLCOMMERZ IPN — server-side validated, idempotent",
        responses: { "200": { description: "Received" } },
      },
    },
    "/api/v1/purchases/me": {
      get: { summary: "Own purchases", security: [{ cookieAuth: [] }] },
    },
    "/api/v1/purchases/sales/me": {
      get: { summary: "Teacher sales: purchases of own content with buyer + content title (teacher, verified)", security: [{ cookieAuth: [] }] },
    },
    "/api/v1/purchases/payouts/me": {
      get: { summary: "Teacher payout summary: total earned, paid out, due + admin payout history (teacher, verified)", security: [{ cookieAuth: [] }] },
    },
    "/api/v1/entitlements/{contentType}/{contentId}": {
      get: { summary: "Check own entitlement", security: [{ cookieAuth: [] }] },
    },
    "/api/v1/questions": { get: { summary: "List published questions (search=title)" }, post: { summary: "Create question (teacher, verified)", security: [{ cookieAuth: [] }] } },
    "/api/v1/playlists": { get: { summary: "List published playlists" }, post: { summary: "Create playlist (teacher, verified)", security: [{ cookieAuth: [] }] } },
    "/api/v1/exams": { get: { summary: "List published exams" }, post: { summary: "Create exam (teacher, verified)", security: [{ cookieAuth: [] }] } },
    "/api/v1/exam-attempts/me": { get: { summary: "Own exam attempts", security: [{ cookieAuth: [] }] } },
    "/api/v1/exam-attempts/{id}/questions": { get: { summary: "Questions for an attempt (answers stripped for students)", security: [{ cookieAuth: [] }] } },
    "/api/v1/exam-attempts/{id}/submit": { patch: { summary: "Submit attempt answers", security: [{ cookieAuth: [] }] } },
    "/api/v1/comments": { get: { summary: "List comments for target" }, post: { summary: "Create comment", security: [{ cookieAuth: [] }] } },
    "/api/v1/follows/me": { get: { summary: "Own followed teachers", security: [{ cookieAuth: [] }] } },
    "/api/v1/ratings/summary": { get: { summary: "Average rating + count per content id", security: [{ cookieAuth: [] }] } },
    "/api/v1/teachers/{id}": { get: { summary: "Public teacher profile (safe fields)" } },
    "/api/v1/bookmarks/me": { get: { summary: "Own saved items", security: [{ cookieAuth: [] }] } },
    "/api/v1/bookmarks": { post: { summary: "Save an item (video/playlist/question/exam)", security: [{ cookieAuth: [] }] } },
    "/api/v1/bookmarks/{targetType}/{targetId}": { delete: { summary: "Remove a saved item", security: [{ cookieAuth: [] }] } },
    "/api/v1/blocks/me": { get: { summary: "Own blocked teachers", security: [{ cookieAuth: [] }] } },
    "/api/v1/blocks": { post: { summary: "Block a teacher", security: [{ cookieAuth: [] }] } },
    "/api/v1/blocks/{teacherId}": { delete: { summary: "Unblock a teacher", security: [{ cookieAuth: [] }] } },
    "/api/v1/teachers": { get: { summary: "List active teacher profiles (safe fields)" } },
    "/api/v1/uploads/{id}": { get: { summary: "Upload metadata + scan status", security: [{ cookieAuth: [] }] } },
    "/api/v1/uploads/{id}/download": { get: { summary: "Authorized download (clean/disabled scans only)", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/users": { get: { summary: "Admin user list", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/payments": { get: { summary: "Admin payment list", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/analytics": { get: { summary: "Admin analytics aggregates", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/audit-logs": { get: { summary: "Admin audit logs", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/overview": {
      get: {
        summary: "Admin overview (admin, verified)",
        security: [{ cookieAuth: [] }],
        responses: { "403": { description: "Non-admin" } },
      },
    },
    "/api/v1/admin/users/{userId}/role": {
      patch: {
        summary: "Admin student/teacher role change with reason (never admin)",
        security: [{ cookieAuth: [] }],
      },
    },
    "/api/v1/my-tests": { get: { summary: "Teacher's unified test list (all exam kinds, newest first)", security: [{ cookieAuth: [] }] } },
    "/api/v1/exams/{id}": { get: { summary: "Exam detail (paid gate applies)" }, patch: { summary: "Update exam (owner, verified)", security: [{ cookieAuth: [] }] }, delete: { summary: "Hard-delete exam and its unused owned questions (owner)", security: [{ cookieAuth: [] }] } },
    "/api/v1/exams/{id}/preview": { get: { summary: "Student-safe exam preview (details only when free/entitled/owner)" } },
    "/api/v1/exam-attempts/{id}": { get: { summary: "Attempt detail (student score hidden until graded)", security: [{ cookieAuth: [] }] } },
    "/api/v1/exam-attempts/{id}/grade": { patch: { summary: "Grade attempt with score or itemized breakdown (exam owner)", security: [{ cookieAuth: [] }] } },
    "/api/v1/submission-queue/items": { get: { summary: "Teacher grading queue: latest submission per student per written/project test (state=pending|graded)", security: [{ cookieAuth: [] }] } },
    "/api/v1/reactions": { post: { summary: "Toggle/switch like-dislike (same value again removes it)", security: [{ cookieAuth: [] }] } },
    "/api/v1/reactions/summary": { get: { summary: "Like/dislike counts + caller's own reaction" } },
    "/api/v1/ratings": { post: { summary: "Rate content or a teacher (1-5, one per user)", security: [{ cookieAuth: [] }] } },
    "/api/v1/follows": { post: { summary: "Follow a teacher", security: [{ cookieAuth: [] }] } },
    "/api/v1/follows/{id}": { delete: { summary: "Unfollow a teacher", security: [{ cookieAuth: [] }] } },
    "/api/v1/follows/followers": { get: { summary: "Teacher's follower list with safe profile fields", security: [{ cookieAuth: [] }] } },
    "/api/v1/reports": { post: { summary: "Report content or a teacher (once per user per item)", security: [{ cookieAuth: [] }] } },
    "/api/v1/uploads/content": { post: { summary: "Teacher content upload (multipart, magic-byte checked)", security: [{ cookieAuth: [] }] } },
    "/api/v1/uploads/avatar": { post: { summary: "Avatar upload (multipart image)", security: [{ cookieAuth: [] }] } },
    "/api/v1/uploads/cover": { post: { summary: "Cover upload (multipart image)", security: [{ cookieAuth: [] }] } },
    "/api/v1/payments/sslcommerz/success": { post: { summary: "SSLCOMMERZ browser return — never grants access by itself; redirects to the frontend result page" } },
    "/api/v1/payments/sslcommerz/fail": { post: { summary: "SSLCOMMERZ browser fail return — redirects to the frontend result page" } },
    "/api/v1/payments/sslcommerz/cancel": { post: { summary: "SSLCOMMERZ browser cancel return — redirects to the frontend result page" } },
    "/api/v1/purchases/statement": { get: { summary: "Student purchase statements with content title + teacher (paginated, search/type filters)", security: [{ cookieAuth: [] }] } },
    "/api/v1/videos/{id}": { get: { summary: "Video detail (paid gate applies)" }, patch: { summary: "Update video (owner)", security: [{ cookieAuth: [] }] }, delete: { summary: "Hide video, or hard-delete with ?hard=true when no paying students", security: [{ cookieAuth: [] }] } },
    "/api/v1/videos/{id}/preview": { get: { summary: "Video pay-gate preview (safe metadata + price + entitlement, never playback IDs)" } },
    "/api/v1/playlists/{id}": { get: { summary: "Playlist detail (paid gate applies)" }, patch: { summary: "Update playlist (owner)", security: [{ cookieAuth: [] }] }, delete: { summary: "Hide playlist, or hard-delete with ?hard=true when no paying students", security: [{ cookieAuth: [] }] } },
    "/api/v1/questions/{id}": { get: { summary: "Question detail (answers stripped unless authorized)" }, patch: { summary: "Update question (owner)", security: [{ cookieAuth: [] }] }, delete: { summary: "Hide question (soft delete)", security: [{ cookieAuth: [] }] } },
    "/api/v1/questions/{id}/preview": { get: { summary: "Question pay-gate preview (stripped metadata + price + entitlement)" } },
    "/api/v1/admin/users/{userId}": { get: { summary: "Admin user profile + activity stats", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/users/{userId}/status": { patch: { summary: "Suspend/activate a user with reason (audited)", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/content/reports": { get: { summary: "All content reports (admin)", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/content/{contentType}/{contentId}": { get: { summary: "Admin preview of reported content (bypasses paid/visibility gates)", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/content/{contentType}/{contentId}/moderation": { patch: { summary: "Hide/restore/reject reported content with reason (audited)", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/payouts": { get: { summary: "Per-teacher earned / paid-out / due totals (admin)", security: [{ cookieAuth: [] }] } },
    "/api/v1/admin/payouts/{teacherId}": { get: { summary: "One teacher's payout summary + history (admin)", security: [{ cookieAuth: [] }] }, post: { summary: "Record a manual teacher payout (cannot exceed due, audited)", security: [{ cookieAuth: [] }] } },
  },
} as const;
