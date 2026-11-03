import { randomBytes } from "crypto";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import bcrypt from "bcrypt";
import type { Db } from "mongodb";
import { env, trustedOrigins } from "../config/env.js";
import { sendAuthEmail } from "../services/mail.js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { PASSWORD_MIN_LENGTH, validatePassword } from "./password-policy.js";

/** Every endpoint that sets a password. Sign-in is deliberately excluded so
 *  existing accounts with older, shorter passwords can still sign in. */
const PASSWORD_SET_PATHS = new Set(["/sign-up/email", "/reset-password", "/change-password", "/set-password"]);

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
    // Never sign sessions with a known/published secret. Production requires
    // BETTER_AUTH_SECRET (env validation enforces it); outside production a
    // per-process ephemeral secret is generated instead of a fallback value.
    secret: env.BETTER_AUTH_SECRET ?? randomBytes(32).toString("hex"),
    trustedOrigins,
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, minPasswordLength: PASSWORD_MIN_LENGTH,
      // Keep 128 for compatibility: Better Auth also applies the max on sign-in,
      // so lowering it would lock out existing accounts with long passwords.
      // New passwords are capped at 72 UTF-8 bytes by the policy hook below.
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: async (password: string) => bcrypt.hash(password, 12),
        verify: async ({ hash, password }: { hash: string; password: string }) => bcrypt.compare(password, hash),
      },
      sendResetPassword: async ({ user, url }: any) => { await sendAuthEmail(user.email, "Reset your LearnTest password", url); },
    } as any,
    hooks: {
      // Server-side strength check for every password-setting endpoint. Better
      // Auth only knows min/max length; this adds classes, common-password and
      // personal-info checks. It never runs for sign-in.
      before: createAuthMiddleware(async (ctx) => {
        if (!PASSWORD_SET_PATHS.has(ctx.path)) return;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const candidate = typeof body.newPassword === "string" ? body.newPassword : body.password;
        if (typeof candidate !== "string") return; // let Better Auth report the missing field
        const errors = validatePassword(candidate);
        if (errors.length) throw new APIError("BAD_REQUEST", { message: errors[0], code: "WEAK_PASSWORD" });
      }),
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: true, expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }: any) => { await sendAuthEmail(user.email, "Verify your LearnTest email", url); },
    },
    socialProviders: social as any,
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 60 } },
    advanced: { useSecureCookies: env.NODE_ENV === "production", defaultCookieAttributes: { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: env.NODE_ENV === "production" ? "none" : "lax" } },
    user: {
      additionalFields: {
        // Role IS accepted at signup — the user picks student/teacher on the sign-up form
        // and it is stored in the `user` collection. OAuth / no-role signups default to
        // "student" with roleSelected: false and must pick via /api/v1/me/select-role later.
        role: { type: "string", required: false, defaultValue: "student", input: true, output: true },
        roleSelected: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      user: { create: { before: async (user: any) => {
        const explicitlySelected = user.role === "student" || user.role === "teacher";
        const role = assertSignupRole(user.role);
        return { data: { ...user, role, roleSelected: explicitlySelected } };
      } } },
    },
  } as any);
}
export type Auth = ReturnType<typeof createAuth>;
