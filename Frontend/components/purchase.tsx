"use client";
import { useEffect, useState } from "react";
import { Badge, Btn, useToast } from "./ui";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { ContentType } from "@/lib/types";

/** Shows entitlement state and, when needed, starts an SSLCOMMERZ payment.
 *  Price always comes from the backend record; this never sends an amount. */
export async function startCheckout(contentType: ContentType, contentId: string, returnTo?: string): Promise<string | null> {
  const res = await apiPost<{ purchaseId: string; tranId: string; gatewayUrl: string | null; note?: string }>(
    "/api/v1/payments/sslcommerz/initiate", { contentType, contentId, returnTo });
  return res.gatewayUrl;
}
export function BuyPanel({ contentType, contentId, price, currency }: {
  contentType: ContentType; contentId: string; price: number; currency: string;
}) {
  const toast = useToast();
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    apiGet<{ entitled: boolean }>(`/api/v1/entitlements/${contentType}/${contentId}`)
      .then((d) => { if (alive) setEntitled(d.entitled); })
      .catch(() => { if (alive) setEntitled(false); });
    return () => { alive = false; };
  }, [contentType, contentId]);

  if (price <= 0) return <Badge tone="green">Free access</Badge>;
  if (entitled === null) return <span className="text-sm text-muted">Checking access…</span>;
  if (entitled) return <Badge tone="green">Purchased — you have access</Badge>;

  const buy = async () => {
    setBusy(true); setNote("");
    try {
      const gatewayUrl = await startCheckout(contentType, contentId);
      if (gatewayUrl) {
        toast("Taking you to SSLCOMMERZ to complete payment…");
        window.location.href = gatewayUrl;
      } else {
        setNote("A pending order was created. Payment gateway credentials are not configured yet, so checkout cannot continue.");
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not start payment.", "err");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Btn onClick={buy} disabled={busy}>{busy ? "Starting checkout…" : `Buy for ${currency} ${price}`}</Btn>
      <span className="text-xs text-muted">You will pay on SSLCOMMERZ. Access unlocks only after server validation.</span>
      {note && <p role="note" className="w-full rounded-lg bg-warnsoft px-3 py-2 text-sm text-warn">{note}</p>}
    </div>
  );
}

export function Engagement({ targetType, targetId }: { targetType: ContentType; targetId: string }) {
  const toast = useToast();
  const [comments, setComments] = useState<{ _id: string; authorId: string; content: string; createdAt: string }[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [mine, setMine] = useState<"like" | "dislike" | null>(null);
  const [reactBusy, setReactBusy] = useState(false);

  const load = () =>
    apiGet<{ items: typeof comments }>(`/api/v1/comments?targetType=${targetType}&targetId=${targetId}&limit=20`)
      .then((d) => { setComments(d.items); setLoaded(true); })
      .catch(() => setLoaded(true));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [targetType, targetId]);

  const loadReactions = () =>
    apiGet<{ likes: number; dislikes: number; mine: "like" | "dislike" | null }>(
      `/api/v1/reactions/summary?targetType=${targetType}&targetId=${targetId}`)
      .then((d) => { setLikes(d.likes); setDislikes(d.dislikes); setMine(d.mine); })
      .catch(() => { /* counts stay at 0 */ });
  useEffect(() => { void loadReactions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [targetType, targetId]);

  const post = async () => {
    if (!text.trim()) return;
    try {
      await apiPost("/api/v1/comments", { targetType, targetId, content: text.trim() });
      setText(""); void load(); toast("Comment posted.");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not post comment.", "err"); }
  };
  const react = async (value: "like" | "dislike") => {
    if (reactBusy) return;
    setReactBusy(true);
    try {
      const res = await apiPost<{ value: "like" | "dislike" | null }>("/api/v1/reactions", { targetType, targetId, value });
      setMine(res.value);
      // Refresh counts from the server (single source of truth).
      await loadReactions();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save reaction.", "err"); }
    finally { setReactBusy(false); }
  };
  return (
    <section aria-label="Discussion" className="mt-8 border-t border-line pt-6">
      <h2 className="font-display text-xl font-bold">Discussion</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => react("like")} disabled={reactBusy}
          aria-pressed={mine === "like"} aria-label={mine === "like" ? "Unlike this video" : "Like this video"}
          title={mine === "like" ? "Unlike" : "Like"}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${mine === "like" ? "text-[#1d6ce0]" : "text-muted hover:bg-soft hover:text-ink"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={mine === "like" ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 10v12H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-7c1.5 0 2.5 1.5 2 3l-.8 3h6.3a2 2 0 0 1 2 2.4l-1.5 7a2 2 0 0 1-2 1.6H7" />
          </svg>
          <span>{likes}</span>
        </button>
        <button type="button" onClick={() => react("dislike")} disabled={reactBusy}
          aria-pressed={mine === "dislike"} aria-label={mine === "dislike" ? "Remove dislike" : "Dislike this video"}
          title={mine === "dislike" ? "Remove dislike" : "Dislike"}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${mine === "dislike" ? "text-danger" : "text-muted hover:bg-soft hover:text-ink"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={mine === "dislike" ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 14V2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm0 0-4 7c-1.5 0-2.5-1.5-2-3l.8-3H5.5a2 2 0 0 1-2-2.4l1.5-7a2 2 0 0 1 2-1.6H17" />
          </svg>
          <span>{dislikes}</span>
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor={`comment-${targetId}`}>Add a comment</label>
        <input id={`comment-${targetId}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or answer something helpful…"
          className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm" />
        <Btn onClick={post}>Post</Btn>
      </div>
      <div className="mt-4 space-y-3">
        {!loaded ? <p className="text-sm text-muted">Loading comments…</p> :
          comments.length === 0 ? <p className="text-sm text-muted">No comments yet. Be the first to ask a question.</p> :
          comments.map((c) => (
            <article key={c._id} className="rounded-lg border border-line bg-card p-3">
              <p className="text-sm">{c.content}</p>
              <p className="mt-1 text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</p>
            </article>
          ))}
      </div>
    </section>
  );
}

/** Star rating for a playlist (individual videos are not rateable). */
export function PlaylistRating({ playlistId }: { playlistId: string }) {
  const toast = useToast();
  const [value, setValue] = useState(5);
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () =>
    apiGet<{ items: { targetId: string; avg: number; count: number }[] }>(
      `/api/v1/ratings/summary?targetType=playlist&targetIds=${encodeURIComponent(playlistId)}`)
      .then((d) => {
        const s = d.items[0];
        setAvg(s ? s.avg : null);
        setCount(s ? s.count : 0);
      })
      .catch(() => { /* average stays hidden */ });
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [playlistId]);

  const save = async () => {
    setBusy(true);
    try {
      await apiPost("/api/v1/ratings", { targetType: "playlist", targetId: playlistId, value });
      toast(`Rated ${value}/5.`);
      await load();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save rating.", "err"); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 border-t border-line pt-3" aria-label="Rate this playlist">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <span aria-hidden className="text-[#d97706]">★</span>
        Playlist rating
        {avg !== null && <span className="font-normal text-muted">· {avg}/5 from {count} rating{count === 1 ? "" : "s"}</span>}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="sr-only">Rating out of 5</span>
          <select value={value} onChange={(e) => setValue(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm" aria-label="Rating out of 5">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select>
        </label>
        <Btn variant="soft" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save rating"}</Btn>
      </div>
    </div>
  );
}
