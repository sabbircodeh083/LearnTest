import type { Role } from "../models/index.js";
import { ObjectId } from "mongodb";

// Single source of truth for roles: the Better Auth `user` collection.
// Profiles must never store or decide `role`; every consumer reads it here.

export function normalizeRole(role: unknown): Role {
  if (role === "student" || role === "teacher" || role === "admin")
    return role;
  return "student";
}

export function userCollection(authDb?: () => any) {
  return authDb?.()?.collection("user");
}

const HEX24 = /^[0-9a-fA-F]{24}$/;

export async function findUserByUserId(
  authDb: (() => any) | undefined,
  userId: string,
): Promise<any | null> {
  const col = userCollection(authDb);
  if (!col) return null;
  // Better Auth mongodb adapter keys documents by `id`; fall back to `_id`.
  const byId = await col.findOne({ id: userId }).catch(() => null);
  if (byId) return byId;
  if (HEX24.test(userId)) {
    const byObjectId = await col.findOne({ _id: new ObjectId(userId) }).catch(() => null);
    if (byObjectId) return byObjectId;
  }
  return col.findOne({ _id: userId as any }).catch(() => null);
}

export async function listUserIdsByRole(
  authDb: (() => any) | undefined,
  role: string,
): Promise<string[]> {
  const col = userCollection(authDb);
  if (!col) return [];
  const docs = await col
    .find({ role })
    .project({ id: 1 })
    .toArray()
    .catch(() => []);
  return docs.map((d: any) => String(d.id ?? d._id));
}

export async function roleMapForUserIds(
  authDb: (() => any) | undefined,
  userIds: string[],
): Promise<Map<string, { role: Role; roleSelected: boolean }>> {
  const map = new Map<string, { role: Role; roleSelected: boolean }>();
  const col = userCollection(authDb);
  if (!col || userIds.length === 0) return map;
  const docs = await col
    .find({ id: { $in: userIds } })
    .project({ id: 1, role: 1, roleSelected: 1 })
    .toArray()
    .catch(() => []);
  for (const d of docs)
    map.set(String(d.id ?? d._id), {
      role: normalizeRole(d.role),
      roleSelected: Boolean(d.roleSelected),
    });
  return map;
}
