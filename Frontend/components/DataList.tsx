"use client";
import type { ReactNode } from "react";

/** Responsive row-list primitives shared by every data table in the app.
 *  Same anatomy as the student Results & Feedback list: rows wrap gracefully
 *  on small screens instead of forcing horizontal scrolling like <table>. */

/** List container — replaces `<div class="overflow-x-auto"><table …>`. */
export function DataList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ol aria-label={label} className="divide-y divide-line rounded-xl border border-line bg-card">
      {children}
    </ol>
  );
}

/** One responsive row: icon + (title, meta, detail) + chip + actions.
 *  On narrow screens the actions wrap below the content instead of clipping. */
export function DataRow({ icon, title, meta, detail, chip, actions }: {
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  chip?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-row flex-wrap items-center gap-3 p-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-soft/70 lg:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{title}</span>
          {meta !== undefined && meta !== null && (
            <span className="mt-0.5 block text-[13px] text-muted">{meta}</span>
          )}
          {detail !== undefined && detail !== null && (
            <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{detail}</span>
          )}
        </span>
        {chip !== undefined && chip !== null && (
          <span className="shrink-0 self-center">{chip}</span>
        )}
      </div>
      {actions !== undefined && actions !== null && (
        <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      )}
    </li>
  );
}

/** Square icon box used at the head of a row. */
export function RowIcon({ tone, children, shape = "rounded-lg", size = "h-10 w-10" }: {
  tone: string;
  children: ReactNode;
  shape?: string;
  size?: string;
}) {
  return (
    <span aria-hidden className={`flex ${size} shrink-0 items-center justify-center overflow-hidden ${shape} ${tone}`}>
      {children}
    </span>
  );
}

/** Small colored label (kind / type) shown at the row's trailing edge. */
export function RowChip({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${tone}`}>
      {children}
    </span>
  );
}

/** Search input with magnifier icon, matching the Results & Feedback filter bar. */
export function SearchField({ id, label, value, onChange, placeholder }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[240px] flex-1">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="w-full rounded-lg border border-line bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70" />
    </div>
  );
}
