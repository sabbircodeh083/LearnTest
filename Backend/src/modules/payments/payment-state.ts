import { toMinor } from "./money.js";
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
  // SSLCommerz multi-currency: non-BDT orders are converted to BDT at the
  // current rate. The validation response then carries the ORIGINAL charge in
  // `currency_type`/`currency_amount` (e.g. USD 1.00) while `amount`/`currency`
  // hold the BDT settlement (e.g. BDT 83.19). Comparing settlement BDT
  // against the USD order always fails, so when the gateway echoes the
  // original currency we must compare THAT against the stored order.
  const orderCurrency = String(order.currency ?? "").toUpperCase();
  const gatewayType = String(v.currency_type ?? "").toUpperCase();
  if (gatewayType) {
    if (gatewayType !== orderCurrency) return { decision: "rejected", reason: `currency mismatch (expected ${orderCurrency} got ${gatewayType})` };
    const expected = toMinor(order.amount);
    const gotOriginal = toMinor(v.currency_amount);
    if (expected === null || gotOriginal === null)
      return { decision: "rejected", reason: `amount not numeric (expected ${String(order.amount)} got ${String(v.currency_amount)})` };
    if (expected !== gotOriginal)
      return { decision: "rejected", reason: `amount mismatch (expected ${(expected / 100).toFixed(2)} ${orderCurrency} got ${(gotOriginal / 100).toFixed(2)} ${gatewayType})` };
    if (String(v.risk_level ?? "0") === "1") return { decision: "risk_hold", reason: "risk_level=1 held for review" };
    return { decision: "paid", reason: "validated" };
  }
  // Single-currency (BDT) path: strict integer-minor comparison, no float epsilon.
  const expected = toMinor(order.amount);
  const got = toMinor(v.amount);
  if (expected === null || got === null)
    return { decision: "rejected", reason: `amount not numeric (expected ${String(order.amount)} got ${String(v.amount)})` };
  if (expected !== got)
    return { decision: "rejected", reason: `amount mismatch (expected ${(expected / 100).toFixed(2)} got ${(got / 100).toFixed(2)})` };
  if (String(v.currency ?? "").toUpperCase() !== order.currency.toUpperCase()) return { decision: "rejected", reason: "currency mismatch" };
  if (String(v.risk_level ?? "0") === "1") return { decision: "risk_hold", reason: "risk_level=1 held for review" };
  return { decision: "paid", reason: "validated" };
}
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "failed", "cancelled", "expired", "risk_hold", "pending"],
  risk_hold: ["paid", "failed"], paid: [], failed: [], cancelled: [], expired: [], refunded: [],
};
export const canTransition = (from: string, to: string) => from === to || (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
