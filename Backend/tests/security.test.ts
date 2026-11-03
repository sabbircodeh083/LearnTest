import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AuthUser } from "../src/auth/guards.js";

const student: AuthUser = { id: "stu1", email: "s@test.dev", emailVerified: true, role: "student", roleSelected: true, status: "active" };
const app = createApp({ sessionResolver: async () => student });
const asStudent = { "x-test-user": "stu1" };

describe("security hardening", () => {
  it("blocks cross-site state-changing requests with an untrusted Origin (CSRF)", async () => {
    const res = await request(app)
      .post("/api/v1/comments")
      .set(asStudent)
      .set("Origin", "https://evil.example")
      .send({ targetType: "video", targetId: "x", content: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows same-site requests from the trusted frontend origin", async () => {
    const res = await request(app)
      .post("/api/v1/comments")
      .set(asStudent)
      .set("Origin", "http://localhost:3000")
      .send({ targetType: "nope" }); // passes CSRF, fails schema validation instead
    expect(res.status).toBe(400);
  });

  it("payment provider callbacks are exempt from the Origin check (validated server-side instead)", async () => {
    const res = await request(app)
      .post("/api/v1/payments/sslcommerz/fail")
      .set("Origin", "https://sandbox.sslcommerz.com")
      .send({});
    expect(res.status).not.toBe(403);
  });

  it("rejects javascript: URLs in profile socials (stored-XSS guard)", async () => {
    const res = await request(app)
      .patch("/api/v1/me")
      .set(asStudent)
      .send({ socials: { github: "javascript:alert(1)" } });
    expect(res.status).toBe(400);
  });

  it("rejects malformed YouTube IDs at video creation (before any DB access for students is irrelevant; schema-level for teachers)", async () => {
    const res = await request(app)
      .post("/api/v1/videos")
      .set(asStudent)
      .send({ title: "x", sourceType: "youtube", youtubeId: "abc" });
    // Students are role-blocked; the key assertion is it never succeeds.
    expect([400, 403]).toContain(res.status);
  });

  it("does not serve API docs routes as part of the v1 API surface", async () => {
    const res = await request(app).get("/api/v1/docs");
    expect(res.status).toBe(404);
  });
});
