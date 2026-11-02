"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Page } from "@/lib/types";

/** Teachers the signed-in user blocked — their content is hidden everywhere. */
export function useBlockedIds() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<Page<{ teacherId: string }>>("/api/v1/blocks/me?limit=100")
      .then((d) => { if (alive) { setIds(new Set((d.items ?? []).map((b) => String(b.teacherId)))); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nonce]);

  return { ids, loading, refresh: () => setNonce((n) => n + 1) };
}
