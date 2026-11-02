"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiDelete, apiGet, apiPost, qs } from "@/lib/api";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { BookmarkDoc, Page } from "@/lib/types";

export type SaveTargetType = "video" | "exam" | "assignment" | "playlist";
export const saveKey = (targetType: string, targetId: string) => `${targetType}:${targetId}`;

// A save tapped while signed out: completed right after the next sign-in.
const PENDING_KEY = "learntest-pending-save";

function readPendingSave(): { targetType: SaveTargetType; targetId: string } | null {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(PENDING_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { targetType?: unknown; targetId?: unknown };
    if ((p.targetType === "video" || p.targetType === "exam" || p.targetType === "assignment" || p.targetType === "playlist")
      && typeof p.targetId === "string" && p.targetId) {
      return { targetType: p.targetType, targetId: p.targetId };
    }
  } catch { /* malformed — cleared below */ }
  try { window.localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
  return null;
}

function clearPendingSave() {
  try { window.localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
}

interface SavedContextValue {
  ids: Set<string>;
  loading: boolean;
  toggle: (targetType: SaveTargetType, targetId: string) => Promise<void>;
  refresh: () => void;
}

const EMPTY: SavedContextValue = {
  ids: new Set<string>(),
  loading: false,
  toggle: () => Promise.resolve(),
  refresh: () => undefined,
};

const SavedContext = createContext<SavedContextValue>(EMPTY);

export function SavedProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<BookmarkDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<Page<BookmarkDoc>>(`/api/v1/bookmarks/me${qs({ limit: 100 })}`)
      .then((d) => { if (alive) { setItems(d.items ?? []); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nonce]);

  // Complete a save that was tapped while signed out, once the user is back in.
  useEffect(() => {
    if (!user) return;
    const pending = readPendingSave();
    if (!pending) return;
    const key = saveKey(pending.targetType, pending.targetId);
    apiPost<BookmarkDoc>("/api/v1/bookmarks", { targetType: pending.targetType, targetId: pending.targetId })
      .then((doc) => {
        setItems((prev) => (prev.some((b) => saveKey(b.targetType, String(b.targetId)) === key) ? prev : [...prev, doc]));
        toast("Saved. Find it in Saved Content.");
      })
      .catch(() => { setNonce((n) => n + 1); })
      .finally(clearPendingSave);
  }, [user, toast]);

  const toggle = useCallback(async (targetType: SaveTargetType, targetId: string) => {
    const key = saveKey(targetType, targetId);
    const isSaved = items.some((b) => saveKey(b.targetType, String(b.targetId)) === key);
    try {
      if (isSaved) {
        await apiDelete(`/api/v1/bookmarks/${targetType}/${encodeURIComponent(targetId)}`);
        setItems((prev) => prev.filter((b) => saveKey(b.targetType, String(b.targetId)) !== key));
      } else {
        const doc = await apiPost<BookmarkDoc>("/api/v1/bookmarks", { targetType, targetId });
        setItems((prev) => [...prev, doc]);
        toast("Saved. Find it in Saved Content.");
      }
    } catch {
      toast("Could not update saved items.", "err");
    }
  }, [items, toast]);

  const value = useMemo<SavedContextValue>(() => ({
    ids: new Set(items.map((b) => saveKey(b.targetType, String(b.targetId)))),
    loading,
    toggle,
    refresh: () => setNonce((n) => n + 1),
  }), [items, loading, toggle]);

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  return useContext(SavedContext);
}

export function SaveButton({ targetType, targetId }: {
  targetType: SaveTargetType; targetId: string;
}) {
  const { ids, toggle } = useSaved();
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const saved = ids.has(saveKey(targetType, targetId));

  const onClick = (e: { preventDefault(): void; stopPropagation(): void }) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || authLoading) return;
    if (!user) {
      const go = window.confirm("Please sign in to save this. Go to the sign-in page now?");
      if (!go) return;
      try {
        window.localStorage.setItem(PENDING_KEY, JSON.stringify({ targetType, targetId }));
      } catch { /* private mode — still return them back */ }
      const back = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/sign-in?returnTo=${encodeURIComponent(back)}`;
      return;
    }
    setBusy(true);
    void toggle(targetType, targetId).finally(() => setBusy(false));
  };

  return (
    <button type="button" onClick={onClick} disabled={busy || authLoading}
      aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save for later"}
      title={saved ? "Remove from saved" : "Save for later"}
      className={`rounded-lg p-1.5 transition disabled:opacity-50 ${saved ? "text-[#16a34a]" : "text-muted hover:bg-soft hover:text-ink"}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={saved ? "currentColor" : "none"}
        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    </button>
  );
}
