"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { Badge, Btn, Loading, Notice, statusTone } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { fmtMoney, type Purchase } from "@/lib/types";
import { safeReturnTo } from "@/lib/url";

function ResultInner() {
  const params = useSearchParams();
  const tranId = params.get("tran_id") || "";
  const back = safeReturnTo(params.get("return"));
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [state, setState] = useState<"checking" | "done" | "signed-out" | "error">("checking");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const list = await apiGet<Purchase[]>("/api/v1/purchases/me");
        if (!alive) return;
        const found = tranId ? list.find((p) => p.tranId === tranId) : list[0];
        setPurchase(found ?? null);
        if (found && found.status === "pending" && tries < 5) {
          timer = setTimeout(() => setTries((t) => t + 1), 3000);
        } else setState("done");
      } catch (e) {
        if (!alive) return;
        const status = (e as { status?: number }).status;
        setState(status === 401 ? "signed-out" : "error");
      }
    };
    void check();
    return () => { alive = false; clearTimeout(timer); };
  }, [tranId, tries]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Payment status</h1>
      <p className="mt-2 text-sm text-muted">
        This page never unlocks content by itself. Access is granted only after the server validates the payment with SSLCOMMERZ.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 card-hover">
        {state === "checking" && <Loading label="Checking your payment with the server…" />}
        {state === "signed-out" && (
          <>
            <Notice>Sign in to see the server-confirmed status of this payment.</Notice>
            <Btn href="/sign-in" className="mt-4">Sign in</Btn>
          </>
        )}
        {state === "error" && <Notice tone="red">We could not reach the API. Your payment has not been changed by this page — check Purchased Content in a moment.</Notice>}
        {state === "done" && !purchase && <Notice>No purchase was found for this transaction yet. If money left your account, wait a moment and open Purchased Content.</Notice>}
        {state === "done" && purchase && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(purchase.status)}>{purchase.status.replace("_", " ")}</Badge>
              <span className="text-sm font-semibold">{fmtMoney(purchase.amount, purchase.currency)}</span>
              <span className="text-sm capitalize text-muted">{purchase.contentType}</span>
            </div>
            <p className="text-sm text-muted">Transaction: {purchase.tranId}</p>
            {purchase.status === "paid" && <Notice tone="blue">Payment validated by the server. Your content is now unlocked where entitlement applies.</Notice>}
            {purchase.status === "pending" && <Notice>Still being verified. This can take a short while — do not pay again.</Notice>}
            {(purchase.status === "failed" || purchase.status === "cancelled") && <Notice tone="red">This payment did not complete. No access was granted. You can try again from the content page.</Notice>}
            {purchase.status === "risk_hold" && <Notice>This payment is under review. Access is held until review finishes.</Notice>}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {back && <Btn href={back}>Back to test</Btn>}
        <Btn href="/student/purchases" variant={back ? "ghost" : undefined}>View my purchases</Btn>
        <Btn href="/student" variant="ghost">Back to learning</Btn>
      </div>
      <p className="mt-4 text-xs text-muted">Final status always comes from <Link className="underline" href="/student/purchases">your purchases</Link>, not from this return URL.</p>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <Suspense fallback={<div className="p-8 text-sm text-muted">Loading payment status…</div>}>
        <ResultInner />
      </Suspense>
    </div>
  );
}
