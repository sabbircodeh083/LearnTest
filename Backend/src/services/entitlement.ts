import { Entitlement } from "../models/index.js";
export async function hasEntitlement(userId: string, contentType: string, contentId: string): Promise<boolean> {
  return Boolean(await Entitlement.exists({ userId, contentType, contentId, active: true }));
}
/** Paid content: owner/admin/free bypass, otherwise active entitlement required. */
export async function canAccessPaid(user: { id: string; role: string }, doc: { ownerId: string; price?: number }, contentType: string, contentId: string): Promise<boolean> {
  if (user.role === "admin" || user.id === doc.ownerId) return true;
  if (!doc.price || doc.price <= 0) return true;
  return hasEntitlement(user.id, contentType, contentId);
}
