import { AuditLog } from "../models/index.js";
export const audit = (actorId: string, action: string, resourceType: string, resourceId: string, requestId: string, reason = "", outcome: "success" | "failure" = "success") =>
  AuditLog.create({ actorId, action, resourceType, resourceId, requestId, reason: reason.slice(0, 500), outcome }).catch(() => undefined);
