export type GatewayDecision = "paid" | "failed" | "cancelled" | "expired" | "risk_hold" | "pending" | "rejected";
/** Pure state machine: decides an order outcome ONLY from server-validated gateway data. */
export function evaluateValidation(order: { tranId: string; amount: number; currency: string }, v: Record<string, any>): { decision: GatewayDecision; reason: string } {
  if (!v || typeof v !== "object") return { decision: "rejected", reason: "empty validation response" };
  const status = String(v.status ?? "").toUpperCase();
  if (!["VALID", "VALIDATED"].includes(status)) {
    if (status === "FAILED") return { decision: "failed", reason: status };
    if (status === "CANCELLED") return { decision: "cancelled", reason: status };
    if (status === "EXPIRED") return { decision: "expired", reason: status };
    if (["UNATTEMPTED", "PENDING", ""].includes(status)) return { decision: "pending", reason: status || "pending" };
    return { decision: "rejected", reason: `unknown status ${status}` };
  }
  if (String(v.tran_id ?? "") !== order.tranId) return { decision: "rejected", reason: "transaction id mismatch" };
  if (Math.abs(Number(v.amount) - order.amount) > 0.001) return { decision: "rejected", reason: "amount mismatch" };
  if (String(v.currency ?? "").toUpperCase() !== order.currency.toUpperCase()) return { decision: "rejected", reason: "currency mismatch" };
  if (String(v.risk_level ?? "0") === "1") return { decision: "risk_hold", reason: "risk_level=1 held for review" };
  return { decision: "paid", reason: "validated" };
}
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "failed", "cancelled", "expired", "risk_hold", "pending"],
  risk_hold: ["paid", "failed"], paid: [], failed: [], cancelled: [], expired: [], refunded: [],
};
export const canTransition = (from: string, to: string) => from === to || (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
