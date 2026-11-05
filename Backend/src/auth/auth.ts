import { randomBytes } from "crypto";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import type { Db } from "mongodb";
import { env, trustedOrigins } from "../config/env.js";
import { hashPassword, verifyPassword } from "./credentials.js";
import { sendAuthEmail } from "../services/mail.js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { PASSWORD_MIN_LENGTH, validatePassword } from "./password-policy.js";

/** Every endpoint that sets a password. Sign-in is deliberately excluded so
 *  existing accounts with older, shorter passwords can still sign in. */
const PASSWORD_SET_PATHS = new Set([
  "/sign-up/email",
  "/reset-password",
  "/change-password",
  "/set-password",
]);

export const SIGNUP_ROLES = ["student", "teacher"] as const;
export function assertSignupRole(role: unknown): string | undefined {
  if (role === undefined || role === null || role === "") return undefined;
  if (role === "student" || role === "teacher") return role;
  throw new APIError("BAD_REQUEST", {
    message: "Role must be student or teacher",
  }); // admin can never self-assign
}

/** Role state applied when a user document is created. A role supplied by the
 *  manual sign-up form is a completed onboarding choice (roleSelected=true);
 *  OAuth/no-role signups stay unselected and are sent to /select-role later. */
export function signupRoleState(role: unknown): {
  role: string | undefined;
  roleSelected: boolean;
} {
  const resolved = assertSignupRole(role);
  return { role: resolved, roleSelected: Boolean(resolved) };
}

/** Frontend URL the user is sent to after a verification link is opened.
 *  Never fall back to "/" — that resolves to the API host root and shows a
 *  JSON 404 after the email has already been verified. */
function verificationRedirectUrl(): string {
  const base = (
    env.EMAIL_VERIFICATION_REDIRECT_URL ?? `${env.FRONTEND_URL}/sign-in`
  ).replace(/\/$/, "");
  return `${base}${base.includes("?") ? "&" : "?"}verified=1`;
}

/** Better Auth embeds the post-verification redirect in the link as
 *  `callbackURL`. When the client does not send one it defaults to "/", so
 *  rewrite that (and only that) to the frontend sign-in page. */
export function withVerificationRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    const callback = parsed.searchParams.get("callbackURL");
    if (!callback || callback === "/") {
      parsed.searchParams.set("callbackURL", verificationRedirectUrl());
    }
    return parsed.toString();
  } catch {
    return url; // malformed URL — send the original rather than break the link
  }
}

export function createAuth(db: Db) {
  const social: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    social.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
    social.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
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
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      // Keep 128 for compatibility: Better Auth also applies the max on sign-in,
      // so lowering it would lock out existing accounts with long passwords.
      // New passwords are capped at 72 UTF-8 bytes by the policy hook below.
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: (password: string) => hashPassword(password),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          verifyPassword(hash, password),
      },
      sendResetPassword: async ({ user, url }: any) => {
        await sendAuthEmail(user.email, "Reset your LearnTest password", url);
      },
    } as any,
    hooks: {
      // Server-side strength check for every password-setting endpoint. Better
      // Auth only knows min/max length; this adds classes, common-password and
      // personal-info checks. It never runs for sign-in.
      before: createAuthMiddleware(async (ctx) => {
        if (!PASSWORD_SET_PATHS.has(ctx.path)) return;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const candidate =
          typeof body.newPassword === "string"
            ? body.newPassword
            : body.password;
        if (typeof candidate !== "string") return; // let Better Auth report the missing field
        const errors = validatePassword(candidate);
        if (errors.length)
          throw new APIError("BAD_REQUEST", {
            message: errors[0],
            code: "WEAK_PASSWORD",
          });
      }),
    },
    emailVerification: {
      sendOnSignUp: true,
      // Verification proves ownership of the address; the user then signs in
      // explicitly so the flow always ends on the login page.
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }: any) => {
        await sendAuthEmail(
          user.email,
          "Verify your LearnTest email",
          withVerificationRedirect(url),
        );
      },
    },
    socialProviders: social as any,
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      },
    },
    user: {
      additionalFields: {
        // Role IS accepted at signup — the user picks student/teacher on the sign-up form
        // and it is stored in the `user` collection. OAuth / no-role signups leave role
        // undefined and must pick via /api/v1/me/select-role later.
        role: {
          type: "string",
          required: false,
          input: true,
          output: true,
        },
        roleSelected: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
      databaseHooks: {
        user: {
          create: {
            before: async (user: any) => {
              // Manual sign-up picks a role in the form, so onboarding is done
              // immediately. OAuth/no-role users keep roleSelected=false and
              // choose via /select-role after their first sign-in.
              const { role, roleSelected } = signupRoleState(user.role);
              return {
                data: { ...user, role, roleSelected },
              };
            },
          },
        },
      },
  } as any);
}
export type Auth = ReturnType<typeof createAuth>;
