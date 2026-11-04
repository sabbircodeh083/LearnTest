import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { forbidden, unauthorized } from "../common/errors.js";
import { Profile, type Role } from "../models/index.js";
import { normalizeRole, findUserByUserId } from "../services/user-roles.js";
import type { Auth } from "./auth.js";

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  roleSelected: boolean;
  status: "active" | "suspended";
}
export type SessionResolver = (req: Request) => Promise<AuthUser | null>;

export async function resolveFromProfile(u: {
  id: string;
  email: string;
  emailVerified: boolean;
  role?: string;
  roleSelected?: boolean;
  name?: string;
}): Promise<AuthUser> {
  // Role is authoritative from the Better Auth `user` collection (session `u`);
  // profiles never store or decide it — a legacy `profile.role` is ignored.
  const role = normalizeRole(u.role);
  let profile: any = await Profile.findOne({ userId: u.id })
    .lean()
    .catch(() => null);
  if (!profile) {
    profile = await Profile.create({
      userId: u.id,
      email: u.email,
      name: u.name || "",
      roleSelected: Boolean(u.roleSelected),
    }).catch(async () => Profile.findOne({ userId: u.id }).lean());
  } else if (
    profile.email !== u.email ||
    (u.name && profile.name !== u.name) ||
    Boolean(profile.roleSelected) !== Boolean(u.roleSelected)
  ) {
    // Keep the profile mirror in sync with the authoritative `user` collection
    // so the admin users table never drifts from the current user table.
    // In-memory first (no extra latency); persist best-effort without blocking
    // the request — a missing DB / mocked model must never hang auth.
    const synced = {
      ...profile,
      email: u.email,
      name: u.name || profile.name || "",
      roleSelected: Boolean(u.roleSelected),
    };
    try {
      const p = Profile.findOneAndUpdate(
        { userId: u.id },
        {
          $set: {
            email: synced.email,
            name: synced.name,
            roleSelected: synced.roleSelected,
          },
        },
        { returnDocument: "after" },
      ).lean() as any;
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    } catch {
      /* best-effort only */
    }
    profile = synced;
  }
  if (!profile)
    return {
      id: u.id,
      email: u.email,
      emailVerified: u.emailVerified,
      role,
      roleSelected: Boolean(u.roleSelected),
      status: "active",
    };
  return {
    id: u.id,
    email: profile.email || u.email,
    emailVerified: u.emailVerified,
    role,
    roleSelected: Boolean(u.roleSelected),
    status: profile.status,
  };
}

export function makeRequireAuth(resolver: SessionResolver) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = await resolver(req);
      if (!user) return next(unauthorized());
      if (user.status === "suspended")
        return next(forbidden("Account suspended"));
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function makeOptionalAuth(resolver: SessionResolver) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const u = await resolver(req).catch(() => null);
      if (u && u.status !== "suspended") req.user = u;
    } catch {
      /* anonymous */
    }
    next();
  };
}
export const requireEmailVerified = (
  req: Request,
  _res: Response,
  next: NextFunction,
) =>
  !req.user
    ? next(unauthorized())
    : !req.user.emailVerified
      ? next(forbidden("Email verification required"))
      : next();
export const requireRoleSelected = (
  req: Request,
  _res: Response,
  next: NextFunction,
) =>
  !req.user
    ? next(unauthorized())
    : req.user.role === "admin" || req.user.roleSelected
      ? next()
      : next(forbidden("Role selection required"));
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    !req.user
      ? next(unauthorized())
      : roles.includes(req.user.role)
        ? next()
        : next(forbidden());
export const requireAdmin = requireRole("admin");
export const isOwnerOrAdmin = (user: AuthUser, ownerId: string) =>
  user.role === "admin" || user.id === ownerId;

export function defaultResolver(auth: Auth, getAuthDb?: () => any): SessionResolver {
  return async (req) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) return null;
    const u: any = session.user;

    // roleSelected (and role) are authoritative from the `user` collection;
    // the Better Auth session may be stale after a direct DB write (e.g. role
    // selection). Read the fresh values from the database so post-selection
    // redirects don't loop and land on the correct role home.
    let roleSelected = Boolean(u.roleSelected);
    let role = u.role;
    try {
      if (getAuthDb) {
        const fresh = await findUserByUserId(getAuthDb, u.id);
        if (fresh) {
          roleSelected = Boolean(fresh.roleSelected);
          role = fresh.role;
        }
      }
    } catch { /* keep session values */ }

    return resolveFromProfile({
      id: u.id,
      email: u.email,
      emailVerified: Boolean(u.emailVerified),
      role,
      roleSelected,
      name: u.name,
    });
  };
}
