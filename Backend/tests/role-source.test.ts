import { describe, it, expect, vi, afterEach } from "vitest";
import { Profile } from "../src/models/index.js";
import { resolveFromProfile } from "../src/auth/guards.js";
import { normalizeRole } from "../src/services/user-roles.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("role lives only in the user collection", () => {
  it("Profile schema stores no role field", () => {
    expect((Profile.schema as any).path("role")).toBeUndefined();
  });

  it("normalizeRole keeps student/teacher/admin and defaults anything else to student", () => {
    expect(normalizeRole("student")).toBe("student");
    expect(normalizeRole("teacher")).toBe("teacher");
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole(undefined)).toBe("student");
    expect(normalizeRole("superuser")).toBe("student");
  });

  it("resolveFromProfile ignores a legacy profile.role and uses the user-collection role", async () => {
    vi.spyOn(Profile, "findOne").mockReturnValue({
      lean: () =>
        Promise.resolve({
          userId: "u1",
          email: "a@b.c",
          name: "",
          role: "teacher", // legacy field lingering in old documents
          roleSelected: false,
          status: "active",
        }),
    } as any);
    const me = await resolveFromProfile({
      id: "u1",
      email: "a@b.c",
      emailVerified: true,
      role: "student",
      roleSelected: true,
    });
    expect(me.role).toBe("student");
    expect(me.roleSelected).toBe(true);
    expect(me.status).toBe("active");
  });

  it("new profiles are created without a role field", async () => {
    vi.spyOn(Profile, "findOne").mockReturnValue({
      lean: () => Promise.resolve(null),
    } as any);
    const created: any[] = [];
    const createSpy = vi.spyOn(Profile, "create") as any;
    createSpy.mockImplementation(async (doc: any) => {
      created.push(doc);
      return { ...doc, status: "active" };
    });
    const me = await resolveFromProfile({
      id: "u2",
      email: "c@d.e",
      emailVerified: true,
      role: "teacher",
      roleSelected: false,
    });
    expect(created).toHaveLength(1);
    expect(created[0]).not.toHaveProperty("role");
    expect(created[0]).toMatchObject({ userId: "u2" });
    expect(me.role).toBe("teacher");
  });
});
