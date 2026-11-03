// Single source of truth for money math in payments.
// All amounts are compared and sent in integer minor units (paisa) to
// eliminate binary float artifacts (e.g. 99.9899999 vs "99.99").
export function toMinor(amount: unknown): number | null {
  const n = typeof amount === "string" ? Number(amount.trim().replace(/,/g, "")) : Number(amount);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** What we send to SSLCommerz total_amount: always "100.00" form. */
export function formatForGateway(amount: unknown): string {
  const minor = toMinor(amount);
  if (minor === null) throw new Error(`Invalid amount: ${String(amount)}`);
  return (minor / 100).toFixed(2);
}
