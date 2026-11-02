import { createHash, randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler, ok, q, validate } from "../../common/middleware.js";
import { pagination, paginate } from "../../common/schemas.js";
import { badRequest, forbidden, notFound } from "../../common/errors.js";
import { requireRole } from "../../auth/guards.js";
import { CONTENT_TYPES, Entitlement, PaymentEvent, Payout, Playlist, Profile, Purchase, Question, Exam, Assignment, Video } from "../../models/index.js";
import { evaluateValidation, canTransition } from "./payment-state.js";
import { logger } from "../../common/logger.js";

const MODELS: Record<string, any> = { video: Video, playlist: Playlist, question: Question, exam: Exam, assignment: Assignment };

async function fetchWithTimeout(url: string, init: RequestInit, ms = 15000): Promise<any> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text.slice(0, 500), httpStatus: res.status }; }
  } finally { clearTimeout(t); }
}
export const sslcommerz = {
  async initiate(order: any, user: any, returnTo = ""): Promise<any> {
    const body = new URLSearchParams({
      store_id: env.SSLCOMMERZ_STORE_ID, store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
      total_amount: String(order.amount), currency: order.currency, tran_id: order.tranId,
      success_url: `${env.API_BASE_URL}/api/v1/payments/sslcommerz/success`, fail_url: `${env.API_BASE_URL}/api/v1/payments/sslcommerz/fail`,
      cancel_url: `${env.API_BASE_URL}/api/v1/payments/sslcommerz/cancel`, ipn_url: env.SSLCOMMERZ_IPN_URL,
      product_name: `${order.contentType}:${order.contentId}`, product_category: "digital", product_profile: "non-physical-goods",
      cus_name: (user.name || "Customer").slice(0, 50), cus_email: user.email, cus_add1: "N/A", cus_city: "Dhaka", cus_country: "Bangladesh", cus_phone: "01700000000",
      shipping_method: "NO", num_of_item: "1", value_a: order.contentType, value_b: order.contentId, value_c: order.userId,
      ...(returnTo ? { value_d: returnTo } : {}),
    });
    return fetchWithTimeout(env.SSLCOMMERZ_INIT_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  },
  async validate(valId: string): Promise<any> {
    const qs = new URLSearchParams({ val_id: valId, store_id: env.SSLCOMMERZ_STORE_ID, store_passwd: env.SSLCOMMERZ_STORE_PASSWORD, format: "json" });
    return fetchWithTimeout(`${env.SSLCOMMERZ_VALIDATION_URL}?${qs}`, {});
  },
};

/** Where to send the student after gateway return. Relative paths only (never open redirects). */
export function sanitizeReturnTo(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.length > 500) return "";
  if (/[\s\\]/.test(s)) return "";
  return s;
}

/** Idempotent, validation-gated settlement. Grants entitlement at most once. */
export async function settleFromValidation(tranId: string, valId: string, source: string) {
  const order: any = await Purchase.findOne({ tranId }); if (!order) return { outcome: "unknown_order" as const };
  if (order.status === "paid") return { outcome: "already_paid" as const, order }; // duplicate IPN: no duplicate entitlement
  const validated = await sslcommerz.validate(valId);
  const { decision, reason } = evaluateValidation(order, validated ?? {});
  logger.info({ tranId, decision, reason, source }, "payment validation evaluated"); // no credentials / card data logged
  if (decision === "paid") {
    if (!canTransition(order.status, "paid")) return { outcome: "invalid_transition" as const, order };
    const updated = await Purchase.findOneAndUpdate(
      { _id: order._id, status: { $ne: "paid" } },
      { $set: { status: "paid", gatewayTranId: String(validated.tran_id ?? ""), valId }, $push: { statusHistory: { status: "paid", source } } },
      { returnDocument: "after" });
    if (!updated) return { outcome: "already_paid" as const, order };
    await Entitlement.updateOne(
      { userId: order.userId, contentType: order.contentType, contentId: order.contentId, sourcePurchaseId: String(order._id) },
      { $setOnInsert: { grantedAt: new Date(), active: true } }, { upsert: true }); // unique index prevents duplicates
    return { outcome: "paid" as const, order: updated };
  }
  const next = decision === "rejected" || decision === "pending" ? order.status : decision;
  if (next !== order.status && canTransition(order.status, next)) {
    order.status = next; order.statusHistory.push({ status: next, source }); await order.save();
  }
  return { outcome: decision, order, reason };
}

export function paymentsRouter(deps: { requireAuth: any; verified: any[] }) {
  const r = Router(); const { requireAuth, verified } = deps;
  r.post("/initiate", requireAuth, ...verified, validate(z.object({ contentType: z.enum(CONTENT_TYPES), contentId: z.string().min(1).max(100), returnTo: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
    const Model = MODELS[req.body.contentType]; const doc: any = await Model.findById(req.body.contentId);
    if (!doc || doc.status !== "published") throw notFound("Content not found");
    if (!doc.price || doc.price <= 0) throw badRequest("Content is free; no purchase needed");
    if (await Entitlement.exists({ userId: req.user!.id, contentType: req.body.contentType, contentId: req.body.contentId, active: true })) throw badRequest("Already entitled");
    const tranId = `LT-${Date.now()}-${randomUUID().slice(0, 8)}`;
    // Amount/currency come ONLY from the stored content record — never from the client.
    const order = await Purchase.create({ userId: req.user!.id, contentType: req.body.contentType, contentId: req.body.contentId, amount: doc.price, currency: doc.currency || env.PAYMENT_CURRENCY, tranId, statusHistory: [{ status: "pending", source: "initiate" }] });
    if (!env.SSLCOMMERZ_STORE_ID) { ok(res, { purchaseId: order.id, tranId, gatewayUrl: null, note: "SSLCOMMERZ credentials not configured; pending order created (sandbox setup required)" }); return; }
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    const gw = await sslcommerz.initiate(order, req.user, returnTo).catch((e) => { logger.error({ paymentError: (e as Error).message, tranId }, "gateway initiate failed"); return null; });
    if (!gw?.GatewayPageURL) { order.statusHistory.push({ status: "pending", source: "gateway_initiate_failed" }); await order.save(); throw badRequest("Payment gateway initiation failed"); }
    order.gatewaySessionId = gw.sessionkey ?? ""; await order.save();
    ok(res, { purchaseId: order.id, tranId, gatewayUrl: gw.GatewayPageURL }, 201);
  }));

  const callback = (source: string) => asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const tranId = String(body.tran_id ?? ""); const valId = String(body.val_id ?? "");
    if (!tranId) throw badRequest("tran_id required");
    // Gateway echoes our custom value_d back — only reuse it when it is a safe relative path.
    const back = sanitizeReturnTo(body.value_d ?? "");
    const withBack = (url: string) => (back ? `${url}${url.includes("?") ? "&" : "?"}return=${encodeURIComponent(back)}` : url);
    const payloadHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const idempotencyKey = `${tranId}:${valId || payloadHash.slice(0, 16)}:${source}`;
    const dup = await PaymentEvent.findOneAndUpdate({ idempotencyKey }, { $setOnInsert: { tranId, payloadHash, processingState: "received" } }, { upsert: true, returnDocument: "before" }).catch(() => null);
    // Browser success/fail/cancel NEVER grants access by itself — only validated IPN/settlement does.
    if (source !== "ipn" && source !== "success") {
      const order: any = await Purchase.findOne({ tranId });
      if (order && source === "fail" && order.status === "pending") { order.status = "failed"; order.statusHistory.push({ status: "failed", source }); await order.save(); }
      if (order && source === "cancel" && order.status === "pending") { order.status = "cancelled"; order.statusHistory.push({ status: "cancelled", source }); await order.save(); }
    }
    if (valId && (source === "ipn" || source === "success")) {
      const result = await settleFromValidation(tranId, valId, source);
      await PaymentEvent.updateOne({ idempotencyKey }, { processingState: result.outcome === "paid" || result.outcome === "already_paid" ? "validated" : "rejected" }).catch(() => undefined);
      void dup;
      if (source === "success") return res.redirect(303, withBack(`${env.PAYMENT_SUCCESS_URL}?tran_id=${encodeURIComponent(tranId)}&status=${result.outcome}`));
      return ok(res, { received: true, outcome: result.outcome });
    }
    if (source === "success") return res.redirect(303, withBack(`${env.PAYMENT_SUCCESS_URL}?tran_id=${encodeURIComponent(tranId)}&status=unverified`));
    if (source === "fail") return res.redirect(303, withBack(`${env.PAYMENT_FAIL_URL}?tran_id=${encodeURIComponent(tranId)}`));
    if (source === "cancel") return res.redirect(303, withBack(`${env.PAYMENT_CANCEL_URL}?tran_id=${encodeURIComponent(tranId)}`));
    ok(res, { received: true, outcome: "recorded_unverified" }); // IPN without val_id: recorded, no state grant
  });
  r.post("/ipn", callback("ipn"));
  r.post("/success", callback("success"));
  r.post("/fail", callback("fail"));
  r.post("/cancel", callback("cancel"));
  return r;
}

export function purchasesRouter(deps: { requireAuth: any; verified?: any[]; authDb?: () => any }) {
  const r = Router(); const { requireAuth } = deps;
  const verified: any[] = deps.verified ?? [];
  const teacherOrAdmin = requireRole("teacher", "admin");
  // Teacher sales: every purchase of content owned by the signed-in teacher,
  // enriched with buyer identity + content title. Defined BEFORE "/:purchaseId"
  // so "sales/me" is never captured as a purchase id.
  r.get("/sales/me", requireAuth, ...verified, teacherOrAdmin,
    validate(pagination.extend({
      status: z.string().max(30).optional(),
      contentType: z.string().max(30).optional(),
      tranId: z.string().max(100).optional(),
    }), "query"),
    asyncHandler(async (req, res) => {
      const query = q(req); const { skip, limit } = paginate(query);
      const teacherId = String(req.user!.id);
      // All content owned by this teacher across every purchasable type.
      const owned = await Promise.all(
        (Object.entries(MODELS) as [string, any][]).map(async ([type, Model]) => {
          const docs: any[] = await Model.find({ ownerId: teacherId }).select("_id title").lean().catch(() => []);
          return docs.map((d) => ({ contentType: type, contentId: String(d._id), title: String(d.title ?? "") }));
        }),
      );
      const flat = owned.flat();
      const titleByKey = new Map(flat.map((c) => [`${c.contentType}:${c.contentId}`, c.title]));
      if (flat.length === 0) return ok(res, { items: [], total: 0, page: query.page, limit });
      // Scope purchases to this teacher's content per (type, id) pair so the
      // count and page match exactly.
      const idsByType = new Map<string, string[]>();
      for (const c of flat) {
        const arr = idsByType.get(c.contentType) ?? [];
        arr.push(c.contentId);
        idsByType.set(c.contentType, arr);
      }
      let typeEntries = [...idsByType.entries()];
      if (query.contentType && (CONTENT_TYPES as readonly string[]).includes(query.contentType)) {
        typeEntries = typeEntries.filter(([t]) => t === query.contentType);
      }
      if (typeEntries.length === 0) return ok(res, { items: [], total: 0, page: query.page, limit });
      const or = typeEntries.map(([t, ids]) => ({ contentType: t, contentId: { $in: [...new Set(ids)] } }));
      const filter: any = or.length === 1 ? or[0] : { $or: or };
      const STATUSES = ["pending", "paid", "failed", "cancelled", "expired", "risk_hold", "refunded"];
      if (query.status && STATUSES.includes(query.status)) filter.status = query.status;
      if (query.tranId) filter.tranId = { $regex: String(query.tranId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const [orders, total] = await Promise.all([
        Purchase.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Purchase.countDocuments(filter),
      ]);
      // Buyers: authoritative name/email from the `user` collection, Profile fallback.
      const buyerIds = [...new Set(orders.map((o: any) => String(o.userId)))];
      const buyerMap = new Map<string, { name: string; email: string }>();
      const userCol = deps.authDb?.()?.collection("user");
      if (userCol && buyerIds.length) {
        const udocs: any[] = await userCol.find({ id: { $in: buyerIds } }).project({ id: 1, name: 1, email: 1 }).toArray().catch(() => []);
        for (const u of udocs) buyerMap.set(String(u.id ?? u._id), { name: String(u.name ?? ""), email: String(u.email ?? "") });
      }
      const missingBuyers = buyerIds.filter((id) => !buyerMap.has(id));
      if (missingBuyers.length) {
        const pdocs: any[] = await Profile.find({ userId: { $in: missingBuyers } }).select("userId name email").lean().catch(() => []);
        for (const p of pdocs) buyerMap.set(String(p.userId), { name: String(p.name ?? ""), email: String(p.email ?? "") });
      }
      const items = orders.map((o: any) => {
        const buyer = buyerMap.get(String(o.userId)) ?? { name: "", email: "" };
        return {
          purchaseId: String(o._id),
          tranId: o.tranId,
          amount: o.amount,
          currency: o.currency,
          status: o.status,
          createdAt: o.createdAt ?? null,
          student: { userId: String(o.userId), name: buyer.name, email: buyer.email },
          content: {
            contentType: o.contentType,
            contentId: String(o.contentId),
            title: titleByKey.get(`${o.contentType}:${String(o.contentId)}`) ?? "",
          },
        };
      });
      ok(res, { items, total, page: query.page, limit });
    }));
  // Teacher payout summary: what the signed-in teacher earned from paid sales,
  // what the admin has already paid out, what is still due, plus the payout
  // history recorded by admins. Defined BEFORE "/:purchaseId" so "payouts/me"
  // is never captured as a purchase id.
  r.get("/payouts/me", requireAuth, ...verified, teacherOrAdmin,
    asyncHandler(async (req, res) => {
      const teacherId = String(req.user!.id);
      const owned = await Promise.all(
        (Object.entries(MODELS) as [string, any][]).map(async ([type, Model]) => {
          const docs: any[] = await Model.find({ ownerId: teacherId }).select("_id").lean().catch(() => []);
          return docs.map((d) => ({ contentType: type, contentId: String(d._id) }));
        }),
      );
      const flat = owned.flat();
      let totalEarned = 0;
      let salesCount = 0;
      if (flat.length) {
        const idsByType = new Map<string, string[]>();
        for (const c of flat) {
          const arr = idsByType.get(c.contentType) ?? [];
          arr.push(c.contentId);
          idsByType.set(c.contentType, arr);
        }
        const or = [...idsByType.entries()].map(([t, ids]) => ({ contentType: t, contentId: { $in: [...new Set(ids)] } }));
        const filter: any = or.length === 1 ? or[0] : { $or: or };
        const agg: any[] = await Purchase.aggregate([
          { $match: { ...filter, status: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" }, sales: { $sum: 1 } } },
        ]).catch(() => []);
        totalEarned = Number(agg[0]?.total) || 0;
        salesCount = Number(agg[0]?.sales) || 0;
      }
      const paidAgg: any[] = await Payout.aggregate([
        { $match: { teacherId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).catch(() => []);
      const totalPaidOut = Number(paidAgg[0]?.total) || 0;
      const history: any[] = await Payout.find({ teacherId }).sort({ createdAt: -1 }).limit(100).lean().catch(() => []);
      const round = (n: number) => Math.round(n * 100) / 100;
      // Monthly earnings for the last 5 months (including the current month),
      // from PAID purchases of this teacher's content. Always 5 entries so the
      // Analysis chart can render without extra requests.
      const now = new Date();
      const monthKeys: string[] = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      let monthly = monthKeys.map((month) => ({ month, total: 0, sales: 0 }));
      if (flat.length) {
        const idsByType = new Map<string, string[]>();
        for (const c of flat) {
          const arr = idsByType.get(c.contentType) ?? [];
          arr.push(c.contentId);
          idsByType.set(c.contentType, arr);
        }
        const or = [...idsByType.entries()].map(([t, ids]) => ({ contentType: t, contentId: { $in: [...new Set(ids)] } }));
        const scope: any = or.length === 1 ? or[0] : { $or: or };
        const start = new Date(now.getFullYear(), now.getMonth() - 4, 1);
        const mAgg: any[] = await Purchase.aggregate([
          { $match: { ...scope, status: "paid", createdAt: { $gte: start } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: "$amount" }, sales: { $sum: 1 } } },
        ]).catch(() => []);
        const byMonth = new Map(mAgg.map((r: any) => [String(r._id), { total: Number(r.total) || 0, sales: Number(r.sales) || 0 }]));
        monthly = monthKeys.map((month) => ({ month, total: round(byMonth.get(month)?.total ?? 0), sales: byMonth.get(month)?.sales ?? 0 }));
      }
      ok(res, {
        totalEarned: round(totalEarned),
        totalPaidOut: round(totalPaidOut),
        duePayout: round(totalEarned - totalPaidOut),
        currency: "BDT",
        salesCount,
        monthly,
        history: history.map((p: any) => ({
          id: String(p._id), amount: p.amount, currency: p.currency ?? "BDT",
          note: p.note ?? "", createdBy: p.createdBy, createdAt: p.createdAt ?? null,
        })),
      });
    }));
  r.get("/me", requireAuth, asyncHandler(async (req, res) => ok(res, await Purchase.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(100).lean())));
  // Student purchase statements: own orders enriched with content title +
  // teacher id for the statements table and details modal. Defined BEFORE
  // "/:purchaseId" so "statement" is never captured as a purchase id.
  r.get("/statement", requireAuth,
    validate(pagination.extend({
      search: z.string().max(100).optional(),
      type: z.string().max(30).optional(),
    }), "query"),
    asyncHandler(async (req, res) => {
      const query = q(req); const { limit } = paginate(query);
      const page = query.page;
      const type = String(query.type ?? "").toLowerCase();
      const KINDS = ["quiz", "written", "problem", "project"];
      const kindFilter = KINDS.includes(type) ? type : "";
      // Narrow at the DB level where possible (kinds need an exam join, so
      // they load exam (+assignment for project) orders and filter below).
      const dbTypeFilter: any = type === "video" || type === "playlist" || type === "question"
        ? { contentType: type }
        : kindFilter
          ? { contentType: { $in: kindFilter === "project" ? ["exam", "assignment"] : ["exam"] } }
          : {};
      const orders: any[] = await Purchase.find({ userId: req.user!.id, ...dbTypeFilter })
        .sort({ createdAt: -1 }).lean().catch(() => []);
      // Resolve content title + owner (teacher) per (type, id) pair, plus the
      // exam kind (assignments always count as project).
      const byType = new Map<string, Set<string>>();
      for (const o of orders) {
        if (!MODELS[o.contentType]) continue;
        if (!byType.has(o.contentType)) byType.set(o.contentType, new Set());
        byType.get(o.contentType)!.add(String(o.contentId));
      }
      const meta = new Map<string, { title: string; teacherId: string; kind: string }>();
      await Promise.all([...byType.entries()].map(async ([ctype, ids]) => {
        const docs: any[] = await MODELS[ctype].find({ _id: { $in: [...ids] } }).select("_id title ownerId kind").lean().catch(() => []);
        for (const d of docs) meta.set(`${ctype}:${String(d._id)}`, {
          title: String(d.title ?? ""),
          teacherId: String(d.ownerId ?? ""),
          kind: ctype === "assignment" ? "project" : String(d.kind ?? (ctype === "exam" ? "quiz" : "")),
        });
      }));
      const search = String(query.search ?? "").trim().toLowerCase();
      const filtered = orders.filter((o) => {
        const m = meta.get(`${o.contentType}:${String(o.contentId)}`);
        if (kindFilter && (m?.kind ?? "") !== kindFilter) return false;
        if (search && !(m?.title ?? "").toLowerCase().includes(search)) return false;
        return true;
      });
      const total = filtered.length;
      const start = (page - 1) * limit;
      const items = filtered.slice(start, start + limit).map((o: any) => {
        const m = meta.get(`${o.contentType}:${String(o.contentId)}`);
        return {
          purchaseId: String(o._id),
          tranId: o.tranId,
          amount: o.amount,
          currency: o.currency ?? "BDT",
          status: o.status,
          createdAt: o.createdAt ?? null,
          studentId: String(o.userId),
          content: {
            contentType: o.contentType,
            contentId: String(o.contentId),
            title: m?.title ?? "",
            teacherId: m?.teacherId ?? "",
            kind: m?.kind ?? "",
          },
        };
      });
      ok(res, { items, total, page: query.page, limit });
    }));
  r.get("/:purchaseId", requireAuth, validate(z.object({ purchaseId: z.string().min(1).max(100) }), "params"), asyncHandler(async (req, res) => {
    const doc: any = await Purchase.findById((req as any).validated_params?.purchaseId ?? req.params.purchaseId);
    if (!doc) throw notFound();
    if (doc.userId !== req.user!.id && req.user!.role !== "admin") throw forbidden();
    ok(res, doc);
  }));
  return r;
}
export function entitlementsRouter(deps: { requireAuth: any }) {
  const r = Router(); const { requireAuth } = deps;
  r.get("/:contentType/:contentId", requireAuth, validate(z.object({ contentType: z.enum(CONTENT_TYPES), contentId: z.string().min(1).max(100) }), "params"), asyncHandler(async (req, res) => {
    const prm = (req as any).validated_params ?? req.params;
    const ent = await Entitlement.findOne({ userId: req.user!.id, contentType: prm.contentType, contentId: prm.contentId, active: true }).lean();
    ok(res, { entitled: Boolean(ent), entitlement: ent });
  }));
  return r;
}
