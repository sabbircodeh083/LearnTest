"use client";
import { Btn } from "./ui";

export function RateDialog({ open, title, sub, value, busy, onPick, onClose, onSubmit }: {
  open: boolean; title: string; sub: string; value: number; busy: boolean;
  onPick: (n: number) => void; onClose: () => void; onSubmit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-card p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{sub}</p>
        <div className="mt-4 flex items-center justify-center gap-1.5" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onPick(n)}
              role="radio" aria-checked={value === n} aria-label={`${n} out of 5 stars`} title={`${n} / 5`}
              className={`rounded p-1 transition ${n <= value ? "text-[#f5a623]" : "text-muted/40 hover:text-[#f5a623]"}`}>
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill={n <= value ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg>
            </button>
          ))}
        </div>
        {value > 0 && <p className="mt-2 text-sm font-semibold text-muted">{value}/5</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Skip</Btn>
          <Btn onClick={onSubmit} disabled={busy}>{busy ? "Saving…" : "Submit rating"}</Btn>
        </div>
      </div>
    </div>
  );
}
