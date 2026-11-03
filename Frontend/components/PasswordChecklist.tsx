"use client";
import type { PasswordChecks } from "@/lib/password";

/** Live feedback for the shared password policy. Purely presentational; the
 *  backend performs the authoritative check when the form is submitted. */
export function PasswordChecklist({ checks }: { checks: PasswordChecks }) {
  const rows = [
    { ok: checks.minLength, label: "At least 12 characters" },
    { ok: checks.upper, label: "At least 1 uppercase letter" },
    { ok: checks.lower, label: "At least 1 lowercase letter" },
    { ok: checks.symbol, label: "At least 1 symbol" },
    { ok: checks.maxBytes, label: "72 bytes or fewer" },
  ];
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
      {rows.map((row) => (
        <li key={row.label} className={row.ok ? "font-medium text-[#16a34a]" : "text-muted"}>
          <span aria-hidden="true">{row.ok ? "✓" : "•"}</span> {row.label}
        </li>
      ))}
    </ul>
  );
}
