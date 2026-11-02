"use client";
import { useEffect, useState } from "react";
import { ApiError } from "./api";

export function useFetch<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    loader()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");
        setLoading(false);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, retry: () => setNonce((n) => n + 1), setData };
}

/** Returns `value` only after it stays unchanged for `delayMs`. Each new
 *  keystroke cancels the pending update, so filtering/rendering runs once
 *  per pause instead of once per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return settled;
}
