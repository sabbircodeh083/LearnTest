import type { ReactNode } from "react";

/** Loading skeletons that mirror the real layouts (DataList rows, cards,
 *  stat tiles) so reloads keep the page shape instead of flashing spinners. */

const pulse = "animate-pulse rounded bg-soft";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`${pulse} ${className}`} />;
}

/** Rows matching DataList/DataRow anatomy: icon box + title + meta lines. */
export function ListSkeleton({ rows = 5, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="divide-y divide-line rounded-xl border border-line bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-10 w-10 shrink-0 !rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-6 w-16 shrink-0 !rounded-md" />
            <Skeleton className="h-9 w-20 shrink-0 !rounded-lg" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
    </div>
  );
}

/** Card grid matching video/playlist cards. */
export function CardsSkeleton({ cards = 6, label = "Loading…" }: { cards?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-line bg-card">
            <Skeleton className="aspect-video w-full !rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-6 w-24 !rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
    </div>
  );
}

/** Stat tiles row (dashboards / earnings). */
export function StatsSkeleton({ tiles = 3 }: { tiles?: number }) {
  return (
    <div aria-hidden className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: tiles }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-line bg-card p-5">
          <Skeleton className="h-14 w-14 shrink-0 !rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Form layout: labels + inputs + submit. */
export function FormSkeleton({ fields = 5, label = "Loading…" }: { fields?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="max-w-2xl space-y-4 rounded-2xl border border-line bg-card p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-full !rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-36 !rounded-lg" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/** Detail page: back link, title block, media/content area. */
export function DetailSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="aspect-video w-full !rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/** Whole-page skeleton for route-level loading.tsx (header + body variant). */
export function PageSkeleton({ variant = "list", label = "Loading…" }: {
  variant?: "list" | "cards" | "detail" | "form" | "stats";
  label?: string;
}) {
  const body: Record<string, ReactNode> = {
    list: <ListSkeleton rows={5} label={label} />,
    cards: <CardsSkeleton cards={6} label={label} />,
    detail: <DetailSkeleton label={label} />,
    form: <FormSkeleton label={label} />,
    stats: (
      <div className="space-y-4">
        <StatsSkeleton />
        <ListSkeleton rows={4} label={label} />
      </div>
    ),
  };
  return (
    <div aria-busy="true" aria-label={label} className="animate-fade-up">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {body[variant]}
    </div>
  );
}
