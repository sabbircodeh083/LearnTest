import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import bcrypt from "bcrypt";
import type { Db } from "mongodb";
import { env, trustedOrigins } from "../config/env.js";
import { sendAuthEmail } from "../services/mail.js";
import { APIError } from "better-auth/api";

export const SIGNUP_ROLES = ["student", "teacher"] as const;
export function assertSignupRole(role: unknown): string {
  if (role === undefined || role === null || role === "") return "student";
  if (role === "student" || role === "teacher") return role;
  throw new APIError("BAD_REQUEST", { message: "Role must be student or teacher" }); // admin can never self-assign
}

export function createAuth(db: Db) {
  const social: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) social.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) social.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  return betterAuth({
    appName: "LearnTest",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET || "dev-only-secret-change-me-32-chars-minimum",
    trustedOrigins,
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, minPasswordLength: 8, maxPasswordLength: 128,
      password: {
        hash: async (password: string) => bcrypt.hash(password, 12),
        verify: async ({ hash, password }: { hash: string; password: string }) => bcrypt.compare(password, hash),
      },
      sendResetPassword: async ({ user, url }: any) => { await sendAuthEmail(user.email, "Reset your LearnTest password", url); },
    } as any,
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: true, expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }: any) => { await sendAuthEmail(user.email, "Verify your LearnTest email", url); },
    },
    socialProviders: social as any,
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 300 } },
    advanced: { useSecureCookies: env.NODE_ENV === "production", defaultCookieAttributes: { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: env.NODE_ENV === "production" ? "none" : "lax" } },
    user: {
      additionalFields: {
        // Role is NEVER accepted at signup — every account picks it once, signed in,
        // through POST /api/v1/me/select-role (once-only, 409 afterwards).
        role: { type: "string", required: false, defaultValue: "student", input: false },
        roleSelected: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      user: { create: { before: async (user: any) => {
        const role = assertSignupRole(user.role);
        // Every account starts unselected and must pick student/teacher once via
        // select-role after signing in — email and OAuth users alike.
        return { data: { ...user, role, roleSelected: false } };
      } } },
    },
  } as any);
}
export type Auth = ReturnType<typeof createAuth>;
