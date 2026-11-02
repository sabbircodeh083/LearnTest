"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Purchase } from "@/lib/types";

export const purchaseKey = (contentType: string, contentId: string) => `${contentType}:${contentId}`;

/** Paid purchases as `type:id` → purchasedAt. Drives the Purchased lists (recent first). */
export function usePurchasedIds() {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<Purchase[]>("/api/v1/purchases/me")
      .then((list) => {
        if (!alive) return;
        const m = new Map<string, string>();
        for (const p of list ?? []) {
          if (p.status !== "paid") continue;
          const key = purchaseKey(String(p.contentType), String(p.contentId));
          const at = String(p.createdAt);
          if (!m.has(key) || +new Date(at) > +new Date(m.get(key) ?? "")) m.set(key, at);
        }
        setMap(m);
      })
      .catch(() => { /* section falls back to its empty state */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { map, loading };
}
