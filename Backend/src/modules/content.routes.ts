import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, p, q, validate } from "../common/middleware.js";
import { contentBody, idParam, pagination, paginate, stripPrivateQuestion } from "../common/schemas.js";
import { badRequest, forbidden, notFound } from "../common/errors.js";
import { requireRole, isOwnerOrAdmin } from "../auth/guards.js";
import { Video, Playlist, Question, Purchase, Entitlement, Upload } from "../models/index.js";
import { storage } from "../services/storage.js";
import { canAccessPaid } from "../services/entitlement.js";

export function contentRouter(deps: { requireAuth: any; verified: any[]; optionalAuth?: any }) {
  const r = Router();
  const { requireAuth, verified } = deps; const optionalAuth = deps.optionalAuth ?? requireAuth;
  const teacherOrAdmin = requireRole("teacher", "admin");

  const list = (Model: any, strip?: (d: any, a: boolean) => any) => asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const filter: any = req.user && (req as any).mine ? { ownerId: req.user.id } : { status: "published", visibility: "public" };
    if (query.search) filter.title = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [items, total] = await Promise.all([Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Model.countDocuments(filter)]);
    ok(res, { items: strip ? items.map((d: any) => strip(d, false)) : items, total, page: query.page, limit });
  });
  const getOne = (Model: any, type: string, strip?: (d: any, a: boolean) => any) => asyncHandler(async (req, res) => {
    const doc = await Model.findById(p(req).id);
    if (!doc) throw notFound();
    const owner = req.user && isOwnerOrAdmin(req.user, doc.ownerId);
    if (!owner && (doc.status !== "published" || doc.visibility === "private")) throw notFound();
    if (!owner && doc.price > 0 && (!req.user || !(await canAccessPaid(req.user, doc, type, doc.id)))) throw forbidden("Purchase required");
    ok(res, strip ? strip(doc, Boolean(owner)) : doc);
  });
  const remove = (Model: any) => asyncHandler(async (req, res) => {
    const doc = await Model.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
    doc.status = "hidden"; await doc.save(); ok(res, { id: doc.id, status: doc.status }); // soft delete
  });

  // Optional-auth listing: handlers work anonymously when no session (public only)
  const optionalList = (Model: any, strip?: any) => [optionalAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    (req as any).mine = req.query.mine === "1" && req.user;
    if (req.query.mine === "1" && !req.user) throw forbidden("Authentication required");
    return list(Model, strip)(req, res, () => undefined);
  })];

  r.get("/videos", ...optionalList(Video));
  r.get("/videos/:id", optionalAuth, validate(idParam, "params"), getOne(Video, "video")); // paid check needs user; public free still requires auth per guard stack below
  // Locked preview for paid videos: safe metadata + price + entitlement, so an
  // unpaid student sees a pay gate (title/price/Buy button) instead of a bare
  // 403. Playback identifiers (youtubeId/assetUploadId) are never included.
  r.get("/videos/:id/preview", optionalAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc: any = await Video.findById(p(req).id).lean(); if (!doc) throw notFound();
    const owner = req.user && isOwnerOrAdmin(req.user, doc.ownerId);
    if (!owner && (doc.status !== "published" || doc.visibility === "private")) throw notFound();
    const entitled = Boolean(owner) || Number(doc.price ?? 0) <= 0 ||
      (req.user ? await canAccessPaid(req.user, doc, "video", String(doc._id)) : false);
    ok(res, {
      _id: String(doc._id), ownerId: doc.ownerId, title: doc.title, description: doc.description ?? "",
      tags: doc.tags ?? [], visibility: doc.visibility, status: doc.status,
      price: doc.price ?? 0, currency: doc.currency ?? "USD",
      sourceType: doc.sourceType ?? "upload", entitled: Boolean(entitled), createdAt: doc.createdAt ?? null,
    });
  }));
  // Product rule: YouTube videos are always free for students — price must stay 0.
  const youtubePriceFree = (sourceType: unknown, price: unknown) => {
    if (sourceType === "youtube" && price !== undefined && Number(price) > 0)
      throw badRequest("YouTube videos are always free for students — price must be 0. Upload your own file to sell a video.");
  };
  r.post("/videos", requireAuth, ...verified, teacherOrAdmin, validate(contentBody.extend({ sourceType: z.enum(["youtube", "upload"]), youtubeId: z.string().max(32).optional().default(""), assetUploadId: z.string().max(100).nullable().optional() })), asyncHandler(async (req, res) => {
    youtubePriceFree(req.body.sourceType, req.body.price);
    if (req.body.sourceType === "youtube" && req.body.youtubeId && !/^[A-Za-z0-9_-]{11}$/.test(req.body.youtubeId))
      throw badRequest("Invalid YouTube video ID.");
    // An attached file must belong to the caller and be video content —
    // otherwise deleting this video later could destroy someone else's file.
    if (req.body.assetUploadId) {
      const up: any = await Upload.findById(req.body.assetUploadId).select("ownerId purpose detectedMime").lean();
      if (!up || (String(up.ownerId) !== req.user!.id && req.user!.role !== "admin") || up.purpose !== "content" || !String(up.detectedMime).startsWith("video/"))
        throw badRequest("Attached file is not your uploaded video content.");
    }
    const doc = await Video.create({ ...req.body, ownerId: req.user!.id });
    ok(res, doc, 201);
  }));
  r.patch("/videos/:id", requireAuth, ...verified, validate(idParam, "params"), validate(contentBody.partial()), asyncHandler(async (req, res) => {
    const doc: any = await Video.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
    youtubePriceFree(doc.sourceType, (req.body as any).price);
    if (doc.sourceType === "youtube") (req.body as any).price = 0; // normalize: free, always
    Object.assign(doc, req.body); await doc.save(); ok(res, doc);
  }));
  r.delete("/videos/:id", requireAuth, ...verified, validate(idParam, "params"),
    validate(z.object({ hard: z.enum(["true", "1"]).optional() }), "query"), asyncHandler(async (req, res) => {
      const doc: any = await Video.findById(p(req).id); if (!doc) throw notFound();
      if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
      if (q(req).hard === undefined) {
        doc.status = "hidden"; await doc.save(); return ok(res, { id: doc.id, status: doc.status }); // soft delete (default)
      }
      // Hard delete: only when nobody holds access. Students who paid keep their rights.
      const [purchase, entitlement] = await Promise.all([
        Purchase.findOne({ contentType: "video", contentId: doc.id, status: { $in: ["pending", "paid", "risk_hold"] } }).select("_id").lean(),
        Entitlement.findOne({ contentType: "video", contentId: doc.id, active: true }).select("_id").lean(),
      ]);
      if (purchase || entitlement) throw forbidden("This video has paying students — it can only be hidden, not permanently deleted.");
      await Playlist.updateMany({ videoIds: doc.id }, { $pull: { videoIds: doc.id } });
      if (doc.assetUploadId) {
        const up: any = await Upload.findById(doc.assetUploadId).lean();
        // Only ever delete a file the video owner actually owns.
        if (up && String(up.ownerId) === String(doc.ownerId)) {
          await storage.delete(up.storageKey).catch(() => undefined);
          await Upload.deleteOne({ _id: up._id }).catch(() => undefined);
        }
      }
      await Video.deleteOne({ _id: doc._id });
      ok(res, { id: doc.id, deleted: true });
    }));

  r.get("/playlists", ...optionalList(Playlist));
  r.get("/playlists/:id", optionalAuth, validate(idParam, "params"), getOne(Playlist, "playlist"));
  // Product rule: playlists are always free for students — price must stay 0.
  const playlistPriceFree = (price: unknown) => {
    if (price !== undefined && Number(price) > 0)
      throw badRequest("Playlists are always free for students — price must be 0.");
  };
  r.post("/playlists", requireAuth, ...verified, teacherOrAdmin, validate(contentBody.extend({ videoIds: z.array(z.string().max(100)).max(200).default([]) })), asyncHandler(async (req, res) => {
    playlistPriceFree(req.body.price);
    const doc = await Playlist.create({ ...req.body, price: 0, ownerId: req.user!.id });
    ok(res, doc, 201);
  }));
  r.patch("/playlists/:id", requireAuth, ...verified, validate(idParam, "params"), validate(contentBody.partial().extend({ videoIds: z.array(z.string().max(100)).max(200).optional() })), asyncHandler(async (req, res) => {
    const doc: any = await Playlist.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
    playlistPriceFree((req.body as any).price);
    (req.body as any).price = 0; // normalize: free, always
    Object.assign(doc, req.body); await doc.save(); ok(res, doc);
  }));
  r.delete("/playlists/:id", requireAuth, ...verified, validate(idParam, "params"),
    validate(z.object({ hard: z.enum(["true", "1"]).optional() }), "query"), asyncHandler(async (req, res) => {
      const doc: any = await Playlist.findById(p(req).id); if (!doc) throw notFound();
      if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
      if (q(req).hard === undefined) {
        doc.status = "hidden"; await doc.save(); return ok(res, { id: doc.id, status: doc.status }); // soft delete (default)
      }
      // Hard delete: only when nobody holds access. Students who paid keep their rights.
      const [purchase, entitlement] = await Promise.all([
        Purchase.findOne({ contentType: "playlist", contentId: doc.id, status: { $in: ["pending", "paid", "risk_hold"] } }).select("_id").lean(),
        Entitlement.findOne({ contentType: "playlist", contentId: doc.id, active: true }).select("_id").lean(),
      ]);
      if (purchase || entitlement) throw forbidden("This playlist has paying students — it can only be hidden, not permanently deleted.");
      await Playlist.deleteOne({ _id: doc._id });
      ok(res, { id: doc.id, deleted: true });
    }));

  r.get("/questions", ...optionalList(Question, stripPrivateQuestion));
  r.get("/questions/:id", optionalAuth, validate(idParam, "params"), getOne(Question, "question", stripPrivateQuestion));
  // Locked preview for paid questions: stripped metadata + price + entitlement,
  // so an unpaid student sees a pay gate instead of a bare 403.
  r.get("/questions/:id/preview", optionalAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const doc: any = await Question.findById(p(req).id); if (!doc) throw notFound();
    const owner = req.user && isOwnerOrAdmin(req.user, doc.ownerId);
    if (!owner && (doc.status !== "published" || doc.visibility === "private")) throw notFound();
    const entitled = Boolean(owner) || Number(doc.price ?? 0) <= 0 ||
      (req.user ? await canAccessPaid(req.user, doc, "question", doc.id) : false);
    ok(res, { ...stripPrivateQuestion(doc, Boolean(owner)), entitled: Boolean(entitled) });
  }));
  // MCQ authoring: options + correctOptions (indexes) + marks + explanation.
  // correctOptions must be exact indexes into options; single-answer takes exactly one.
  const questionExtras = {
    options: z.array(z.string().min(1).max(500)).max(10).optional().default([]),
    correctOptions: z.array(z.number().int().min(0)).max(10).optional().default([]),
    multiple: z.boolean().optional().default(false),
    marks: z.number().min(0).max(1000).optional().default(1),
    explanation: z.string().max(5000).optional().default(""),
  };
  const checkMcq = (v: { type: string; options: string[]; correctOptions: number[]; multiple: boolean }) => {
    if (v.type !== "mcq") {
      if (v.options.length || v.correctOptions.length) throw badRequest("Options and correct answers are only for MCQ questions.");
      return;
    }
    if (v.options.length < 2) throw badRequest("MCQ needs at least 2 options.");
    if (!v.multiple && v.correctOptions.length !== 1) throw badRequest("Single-answer MCQ needs exactly one correct option.");
    if (v.multiple && v.correctOptions.length < 1) throw badRequest("Multiple-answer MCQ needs at least one correct option.");
    if (new Set(v.correctOptions).size !== v.correctOptions.length) throw badRequest("Correct options contain duplicates.");
    if (v.correctOptions.some((i) => i >= v.options.length)) throw badRequest("A correct option points outside the options list.");
  };
  const questionBody = contentBody.extend({
    type: z.enum(["mcq", "short", "code"]), prompt: z.string().min(1).max(5000),
    answer: z.string().max(10000).optional().default(""), rubric: z.string().max(10000).optional().default(""),
    linkedContentId: z.string().max(100).nullable().optional(), ...questionExtras,
  });
  r.post("/questions", requireAuth, ...verified, teacherOrAdmin, validate(questionBody), asyncHandler(async (req, res) => {
    checkMcq(req.body);
    const doc = await Question.create({ ...req.body, ownerId: req.user!.id });
    ok(res, doc, 201);
  }));
  r.patch("/questions/:id", requireAuth, ...verified, validate(idParam, "params"), validate(questionBody.partial()), asyncHandler(async (req, res) => {
    const doc: any = await Question.findById(p(req).id); if (!doc) throw notFound();
    if (!isOwnerOrAdmin(req.user!, doc.ownerId)) throw forbidden();
    const merged = {
      type: String(req.body.type ?? doc.type),
      options: (req.body.options ?? doc.options ?? []).map(String),
      correctOptions: (req.body.correctOptions ?? doc.correctOptions ?? []).map(Number),
      multiple: Boolean(req.body.multiple ?? doc.multiple ?? false),
    };
    checkMcq(merged);
    Object.assign(doc, req.body); await doc.save(); ok(res, doc);
  }));
  r.delete("/questions/:id", requireAuth, ...verified, validate(idParam, "params"), remove(Question));
  return r;
}
