"use client";
import { useEffect, useState } from "react";
import { safeExternalUrl } from "@/lib/url";
import { apiBlobUrl } from "@/lib/api";

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

function useBlobUrl(uploadId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!uploadId) { setUrl(null); return; }
    let alive = true;
    let obj: string | null = null;
    apiBlobUrl(`/api/v1/uploads/${uploadId}/download`)
      .then((u) => { if (alive) { obj = u; setUrl(u); } })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [uploadId]);
  return url;
}

export function AvatarImg({ uploadId, name, className }: {
  uploadId: string | null | undefined; name: string; className?: string;
}) {
  const url = useBlobUrl(uploadId);
  const cls = className ?? "h-full w-full";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`${name}'s profile photo`} className={`${cls} object-cover`} />;
  }
  return (
    <span aria-hidden className={`flex items-center justify-center bg-[#e8f1fe] font-bold text-[#1d6ce0] ${cls}`}>
      {initialsOf(name)}
    </span>
  );
}

export function CoverBanner({ uploadId, className }: {
  uploadId: string | null | undefined; className?: string;
}) {
  const url = useBlobUrl(uploadId);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" aria-hidden={false} className={`${className ?? "h-full w-full"} object-cover`} />;
  }
  return (
    <div aria-hidden className={`bg-gradient-to-r from-[#3b5bdb] via-[#748ffc] to-[#9775fa] ${className ?? "h-full w-full"}`}>
      <div aria-hidden className="h-full w-full opacity-30 [background:radial-gradient(60%_90%_at_20%_100%,#fff_0%,transparent_60%),radial-gradient(50%_80%_at_80%_20%,#fff_0%,transparent_55%)]" />
    </div>
  );
}

export function joinedLabel(iso: string | null | undefined) {
  if (!iso) return "Joined LearnTest";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Joined LearnTest";
  return `Joined LearnTest in ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

export const SOCIAL_TILES = [
  { key: "github", label: "GitHub", badge: "bg-[#111827] text-white", mark: "GH" },
  { key: "youtube", label: "YouTube", badge: "bg-[#dc2626] text-white", mark: "YT" },
  { key: "linkedin", label: "LinkedIn", badge: "bg-[#0a66c2] text-white", mark: "in" },
  { key: "dev", label: "DEV", badge: "bg-black text-white", mark: "DEV" },
  { key: "website", label: "Website", badge: "bg-[#1d6ce0] text-white", mark: "✦" },
] as const;

export type SocialKey = (typeof SOCIAL_TILES)[number]["key"];

export function SocialTile({ tile, href, size = "md" }: {
  tile: (typeof SOCIAL_TILES)[number]; href?: string; size?: "md" | "sm";
}) {
  const cls = size === "sm"
    ? "flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-black"
    : "flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black";
  const inner = (
    <span aria-hidden className={`${cls} ${tile.badge}`}>
      {tile.mark}
    </span>
  );
  const safeHref = safeExternalUrl(href);
  if (!safeHref) return <span title={tile.label}>{inner}</span>;
  return (
    <a href={safeHref} target="_blank" rel="noreferrer" title={`${tile.label}: ${href}`} aria-label={`${tile.label} profile`}>
      {inner}
    </a>
  );
}

export function handleOf(user: { username?: string; email?: string }) {
  if (user.username) return `@${user.username}`;
  return user.email ? `@${user.email.split("@")[0]}` : "@teacher";
}

export const cameraIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
);

export const pencilIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
);

export function EditLink({ href, children }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-1.5 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]">
      {pencilIcon}
      {children ?? "Edit"}
    </a>
  );
}
