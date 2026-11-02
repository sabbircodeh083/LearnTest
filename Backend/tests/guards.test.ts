import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AuthUser } from "../src/auth/guards.js";

const USERS: Record<string, AuthUser> = {
  student: { id: "stu1", email: "s@test.dev", emailVerified: true, role: "student", roleSelected: true, status: "active" },
  teacher: { id: "tea1", email: "t@test.dev", emailVerified: true, role: "teacher", roleSelected: true, status: "active" },
  admin: { id: "adm1", email: "a@test.dev", emailVerified: true, role: "admin", roleSelected: true, status: "active" },
  unverified: { id: "unv1", email: "u@test.dev", emailVerified: false, role: "student", roleSelected: true, status: "active" },
  norole: { id: "nr1", email: "n@test.dev", emailVerified: true, role: "student", roleSelected: false, status: "active" },
};
const app = createApp({ sessionResolver: async (req) => USERS[String(req.header("x-test-user") ?? "")] ?? null });
const as = (u: string) => ({ "x-test-user": u });

describe("auth guards & authorization (§5, §15, §20.5)", () => {
  it("health is public; protected routes 401 when unauthenticated", async () => {
    await request(app).get("/api/v1/health").expect(200);
    await request(app).get("/api/v1/me").expect(401);
    await request(app).get("/api/v1/purchases/me").expect(401);
  });
  it("unverified users are blocked from protected product features (403)", async () => {
    await request(app).post("/api/v1/comments").set(as("unverified")).send({ targetType: "video", targetId: "x", content: "hi" }).expect(403);
  });
  it("OAuth users without a selected role are blocked until onboarding (403)", async () => {
    await request(app).post("/api/v1/comments").set(as("norole")).send({ targetType: "video", targetId: "x", content: "hi" }).expect(403);
  });
  it("students and teachers get 403 on every admin endpoint; unauthenticated 401", async () => {
    for (const u of ["student", "teacher"]) {
      await request(app).get("/api/v1/admin/overview").set(as(u)).expect(403);
      await request(app).get("/api/v1/admin/users").set(as(u)).expect(403);
      await request(app).get("/api/v1/admin/health").set(as(u)).expect(403);
    }
    await request(app).get("/api/v1/admin/overview").expect(401);
  });
  it("student gets 403 on teacher-only content creation (before DB access)", async () => {
    await request(app).post("/api/v1/videos").set(as("student")).send({ title: "x", sourceType: "youtube" }).expect(403);
  });
  it("admin role cannot be set via generic profile PATCH (validation strips/rejects role)", async () => {
    // PATCH /me schema has no role field; zod strips unknown keys by default in the route schema object —
    // the request validates but role must not change. Without a DB the handler 500s, so assert it is not a 200 role change.
    const res = await request(app).patch("/api/v1/me").set(as("student")).send({ role: "admin" });
    expect(res.status).toBe(400); // strict schema: role is not a patchable field
  });
  it("invalid bodies are rejected with 400 and the standard error shape", async () => {
    const res = await request(app).post("/api/v1/comments").set(as("student")).send({ targetType: "nope" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, data: null });
    expect(res.body.requestId).toBeTruthy();
  });
  it("unknown routes return central 404 shape; ready is 503 without DB", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404); expect(res.body.error.code).toBe("NOT_FOUND");
    await request(app).get("/api/v1/ready").expect(503);
  });
  it("auth mount never fakes auth when DB is absent (503)", async () => {
    await request(app).post("/api/auth/sign-in/email").send({ email: "a@b.c", password: "x".repeat(9) }).expect(503);
  });
});
