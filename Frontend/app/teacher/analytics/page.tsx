"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Empty, ErrorBox, Loading } from "@/components/ui";
import { apiGet, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtMoney, type MyTestPage, type Page, type Video } from "@/lib/types";

type RangeKey = "7" | "30" | "90";

interface MonthEarning { month: string; total: number; sales: number }
interface MyPayout {
  totalEarned: number;
  totalPaidOut: number;
  duePayout: number;
  currency: string;
  salesCount: number;
  monthly?: MonthEarning[];
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTick(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}
function niceCeil(v: number) {
  if (v <= 4) return 4;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= v) return m * base;
  return 10 * base;
}

/* Smooth path through points (Catmull-Rom → bezier). */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function ActivityChart({ videos, tests, days }: { videos: number[]; tests: number[]; days: string[] }) {
  const W = 760;
  const H = 260;
  const padL = 40;
  const padB = 28;
  const padT = 14;
  const padR = 10;
  const maxV = niceCeil(Math.max(0, ...videos, ...tests));
  const n = days.length;
  const x = (i: number) => (n === 1 ? padL : padL + ((W - padL - padR) * i) / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / maxV);
  const vPts = videos.map((v, i) => ({ x: x(i), y: y(v) }));
  const tPts = tests.map((v, i) => ({ x: x(i), y: y(v) }));
  const vLine = smoothPath(vPts);
  const tLine = smoothPath(tPts);
  const base = H - padB;
  const ticks = [0, 1, 2, 3, 4].map((k) => (maxV * k) / 4);
  const labelIdx = useMemo(() => {
    if (n <= 7) return days.map((_, i) => i);
    const out: number[] = [];
    const count = 6;
    for (let k = 0; k < count; k++) out.push(Math.round((k * (n - 1)) / (count - 1)));
    return [...new Set(out)];
  }, [days, n]);

  const [showV, setShowV] = useState(true);
  const [showT, setShowT] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const onMove = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    // Map clientX → svg x units, then → nearest day index.
    const svgX = padL + ((clientX - rect.left) / rect.width) * W;
    const frac = (svgX - padL) / Math.max(1, W - padL - padR);
    const i = Math.round(frac * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
        <button type="button" aria-pressed={showV} onClick={() => setShowV((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 transition ${showV ? "" : "opacity-50"}`}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />Videos Published
        </button>
        <button type="button" aria-pressed={showT} onClick={() => setShowT((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 transition ${showT ? "" : "opacity-50"}`}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#7c3aed]" />Tests Created
        </button>
      </div>
      <div ref={wrapRef} className="relative mt-2 w-full overflow-hidden"
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => { if (e.touches[0]) onMove(e.touches[0].clientX); }}
        onTouchEnd={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Creation activity over time">
          <defs>
            <linearGradient id="anaBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="anaPurple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth="1" opacity="0.5" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" className="fill-muted">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={base} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
          )}
          {showV && vLine && <path d={`${vLine} L ${x(n - 1)} ${base} L ${x(0)} ${base} Z`} fill="url(#anaBlue)" />}
          {showT && tLine && <path d={`${tLine} L ${x(n - 1)} ${base} L ${x(0)} ${base} Z`} fill="url(#anaPurple)" />}
          {showV && vLine && <path d={vLine} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {showT && tLine && <path d={tLine} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {showV && vPts.map((p, i) => (i % Math.max(1, Math.floor(n / 30)) === 0 || i === hover ? <circle key={`v${i}`} cx={p.x} cy={p.y} r={i === hover ? 5 : 3} fill="#2563eb" stroke="#fff" strokeWidth="1.5" /> : null))}
          {showT && tPts.map((p, i) => (i % Math.max(1, Math.floor(n / 30)) === 0 || i === hover ? <circle key={`t${i}`} cx={p.x} cy={p.y} r={i === hover ? 5 : 3} fill="#7c3aed" stroke="#fff" strokeWidth="1.5" /> : null))}
          {labelIdx.map((i) => (
            <text key={days[i]} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" className="fill-muted">{fmtTick(days[i]!)}</text>
          ))}
        </svg>
        {hover !== null && days[hover] && (
          <div aria-live="polite"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`,
              top: 0,
            }}>
            <p className="font-bold">{fmtTick(days[hover]!)}</p>
            {showV && <p className="text-[#2563eb]">Videos: {videos[hover]}</p>}
            {showT && <p className="text-[#7c3aed]">Tests: {tests[hover]}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function EarningsChart({ monthly }: { monthly: MonthEarning[] }) {
  const W = 760;
  const H = 260;
  const padL = 56;
  const padB = 28;
  const padT = 14;
  const padR = 10;
  const maxV = niceCeil(Math.max(0, ...monthly.map((m) => m.total)));
  const base = H - padB;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / maxV);
  const ticks = [0, 1, 2, 3, 4].map((k) => (maxV * k) / 4);
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const onMove = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || !monthly.length) return;
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    const slot = 1 / monthly.length;
    const i = Math.floor(frac / slot);
    setHover(Math.max(0, Math.min(monthly.length - 1, i)));
  };

  return (
    <div ref={wrapRef} className="relative mt-3 w-full overflow-hidden"
      onMouseMove={(e) => onMove(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onTouchMove={(e) => { if (e.touches[0]) onMove(e.touches[0].clientX); }}
      onTouchEnd={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Earnings per month for the last 5 months">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" className="fill-muted">$ {t >= 1000 ? `${Math.round(t / 100) / 10}k` : Math.round(t).toLocaleString()}</text>
          </g>
        ))}
        {monthly.map((m, i) => {
          const slot = (W - padL - padR) / Math.max(1, monthly.length);
          const bw = Math.min(64, slot * 0.55);
          const cx = padL + slot * i + slot / 2;
          const h = maxV ? ((H - padT - padB) * m.total) / maxV : 0;
          const active = hover === i;
          return (
            <g key={m.month}>
              <rect x={cx - bw / 2} y={active ? y(m.total) - 2 : y(m.total)} width={bw} height={Math.max(m.total > 0 ? h : 0, m.total > 0 ? 4 : 0)}
                rx="6" fill={active ? "#15803d" : "#16a34a"} opacity={active ? 1 : 0.9} />
              {m.total > 0 && (
                <text x={cx} y={y(m.total) - 8} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-muted">
                  $ {m.total >= 1000 ? `${Math.round(m.total / 100) / 10}k` : Math.round(m.total).toLocaleString()}
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" className="fill-muted">{fmtMonth(m.month)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && monthly[hover] && (
        <div aria-live="polite"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${Math.min(86, Math.max(14, ((hover + 0.5) / monthly.length) * 100))}%`,
            top: 0,
          }}>
          <p className="font-bold">{fmtMonth(monthly[hover]!.month)} · {monthly[hover]!.month}</p>
          <p className="font-semibold text-[#16a34a]">$ {Number(monthly[hover]!.total ?? 0).toLocaleString()}</p>
          <p className="text-muted">{monthly[hover]!.sales} paid sale{monthly[hover]!.sales === 1 ? "" : "s"}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ href, iconBox, label, value, delta, sub }: {
  href: string; iconBox: React.ReactNode; label: string; value: string; delta: string; sub: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:shadow-[0_4px_12px_rgba(16,24,40,0.10)]">
      {iconBox}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[22px] font-bold leading-none tracking-tight">{value}</span>
          {delta && <span className="text-[13px] font-semibold text-[#16a34a]">↗ {delta}</span>}
        </span>
        <span className="mt-1 block text-[13px] text-muted">{sub}</span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </Link>
  );
}

export default function TeacherAnalysisPage() {
  const [range, setRange] = useState<RangeKey>("30");
  const videos = useFetch(() => apiGet<Page<Video>>(`/api/v1/videos${qs({ mine: 1, limit: 100 })}`), []);
  const tests = useFetch(() => apiGet<MyTestPage>(`/api/v1/my-tests${qs({ limit: 100 })}`), []);
  const earnings = useFetch(() => apiGet<MyPayout>("/api/v1/purchases/payouts/me"), []);
  const loading = videos.loading || tests.loading;
  const error = videos.error || tests.error;

  const days = useMemo(() => {
    const n = Number(range);
    const out: string[] = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(dayKey(d));
    }
    return out;
  }, [range]);
  const cutoff = days[0]!;

  const videoItems = videos.data?.items ?? [];
  const testItems = tests.data?.items ?? [];
  const publishedVideos = videoItems.filter((v) => v.status === "published");
  const newVideos = publishedVideos.filter((v) => dayKey(new Date(v.createdAt)) >= cutoff).length;
  const newTests = testItems.filter((t) => dayKey(new Date(t.createdAt)) >= cutoff).length;
  const paidPrices = [
    ...videoItems.filter((v) => v.price > 0).map((v) => ({ price: v.price, currency: v.currency })),
    ...testItems.filter((t) => t.price > 0).map((t) => ({ price: t.price, currency: t.currency })),
  ];
  const catalogueValue = paidPrices.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const earningValue = earnings.data ? earnings.data.totalEarned : catalogueValue;
  const earningSub = earnings.data
    ? `${earnings.data.salesCount} paid sales · $ ${earnings.data.totalPaidOut.toLocaleString()} paid out`
    : "Priced catalogue value";

  const series = useMemo(() => {
    const v = new Array(days.length).fill(0) as number[];
    const t = new Array(days.length).fill(0) as number[];
    const idx = new Map(days.map((d, i) => [d, i]));
    for (const item of publishedVideos) {
      const i = idx.get(dayKey(new Date(item.createdAt)));
      if (i !== undefined) v[i]! += 1;
    }
    for (const item of testItems) {
      const i = idx.get(dayKey(new Date(item.createdAt))) ;
      if (i !== undefined) t[i]! += 1;
    }
    return { v, t };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, videos.data, tests.data]);

  const monthly: MonthEarning[] = earnings.data?.monthly ?? [];

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede9fe] text-[#7c3aed]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></svg>
          </span>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">Analysis</h1>
            <p className="text-[15px] text-muted">Overview of your videos, tests and earnings.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.10)]">
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
          <span className="sr-only">Date range</span>
          <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} aria-label="Date range" className="bg-transparent text-sm font-semibold outline-none">
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </label>
      </div>

      {loading ? <div className="mt-6"><Loading label="Loading analysis…" /></div>
        : error ? <div className="mt-6"><ErrorBox message={error} onRetry={() => { videos.retry(); tests.retry(); }} /></div>
        : (
          <>
            {/* stat cards */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <StatCard href="/teacher/videos" label="Videos" value={String(publishedVideos.length)}
                delta={newVideos ? `+${newVideos} new` : ""} sub="Total published videos"
                iconBox={
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fe] text-[#2f80ed]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10.5l5-2.8v8.6l-5-2.8" /><circle cx="8.5" cy="12" r="1.6" /><path d="M8.5 10.8v2.4l2-1.2z" /></svg>
                  </span>
                } />
              <StatCard href="/teacher/exams" label="Tests" value={String(tests.data?.total ?? testItems.length)}
                delta={newTests ? `+${newTests} new` : ""} sub="Total tests created"
                iconBox={
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f1eafe] text-[#7c3aed]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9.5h6M9 13h6M9 16.5h4" /></svg>
                  </span>
                } />
              <StatCard href="/teacher/earnings" label="Earning" value={fmtMoney(earningValue, "USD")}
                delta="" sub={earningSub}
                iconBox={
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e6f9ec] text-[#16a34a]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M14.5 9.5c-.6-1-1.5-1.3-2.5-1.3-1.4 0-2.5.8-2.5 2 0 2.7 5.5 1.3 5.5 4 0 1.2-1.1 2-2.5 2-1 0-1.9-.4-2.5-1.3" /></svg>
                  </span>
                } />
            </div>

            {/* activity chart */}
            <section className="mt-4 w-full max-w-full overflow-hidden rounded-xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Activity Over Time">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-bold">Activity Over Time</h2>
              </div>
              <ActivityChart videos={series.v} tests={series.t} days={days} />
              <p className="mt-2 text-xs text-muted">
                Built from your real content dates (up to 100 recent videos and tests). Hover or tap the chart to inspect a day; use the pills to show or hide a series.
              </p>
            </section>

            {/* earnings chart — last 5 months */}
            <section className="mt-4 w-full max-w-full overflow-hidden rounded-xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6" aria-label="Earnings by Month">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-bold">Earnings by Month</h2>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Paid sales · last 5 months
                </span>
              </div>
              {earnings.loading ? <div className="mt-3"><Loading label="Loading earnings…" /></div>
                : earnings.error ? <div className="mt-3"><ErrorBox message={earnings.error} onRetry={earnings.retry} /></div>
                : !monthly.length || monthly.every((m) => !m.total) ? (
                  <div className="mt-3"><Empty title="No earnings yet" body="When a student buys your video or test, the paid amount will appear here grouped by month for the last 5 months." /></div>
                ) : (
                  <>
                    <EarningsChart monthly={monthly} />
                    <p className="mt-2 text-xs text-muted">
                      Collected revenue from paid purchases of your content, grouped by month. Hover or tap a bar to see the amount and sale count.
                    </p>
                  </>
                )}
            </section>

            {(videos.data && videos.data.total > videoItems.length) || (tests.data && tests.data.total > testItems.length) ? (
              <p className="mt-3 text-xs text-muted">Counts and activity chart cover your 100 most recent items per source, exactly as returned by the server.</p>
            ) : null}
          </>
        )}
    </div>
  );
}
