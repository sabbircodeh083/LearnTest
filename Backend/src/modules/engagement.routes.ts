import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, p, q, validate } from "../common/middleware.js";
import { conflict, notFound } from "../common/errors.js";
import { idParam, pagination, paginate } from "../common/schemas.js";
import { CONTENT_TYPES, Block, Bookmark, Comment, Follow, Profile, Rating, Reaction, Report } from "../models/index.js";
import { requireRole } from "../auth/guards.js";
import { listUserIdsByRole, roleMapForUserIds } from "../services/user-roles.js";

const target = { targetType: z.enum([...CONTENT_TYPES, "comment"]), targetId: z.string().min(1).max(100) };
export function engagementRouter(deps: { requireAuth: any; verified: any[]; authDb?: () => any; optionalAuth?: any }) {
  const r = Router(); const { requireAuth, verified } = deps; const optionalAuth = deps.optionalAuth ?? requireAuth;
  r.get("/comments", validate(z.object({ targetType: z.enum(CONTENT_TYPES), targetId: z.string().min(1).max(100), ...pagination.shape }), "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const filter = { targetType: query.targetType, targetId: query.targetId, moderationState: "visible" };
    const [items, total] = await Promise.all([Comment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Comment.countDocuments(filter)]);
    ok(res, { items, total });
  }));
  r.post("/comments", requireAuth, ...verified, validate(z.object({ ...target, targetType: z.enum(CONTENT_TYPES), content: z.string().min(1).max(2000) })), asyncHandler(async (req, res) =>
    ok(res, await Comment.create({ ...req.body, authorId: req.user!.id }), 201)));
  r.delete("/comments/:id", requireAuth, validate(idParam, "params"), asyncHandler(async (req, res) => {
    const c = await Comment.findById(p(req).id); if (!c) return ok(res, { deleted: false });
    if (c.authorId !== req.user!.id && req.user!.role !== "admin") return res.status(403).json({ success: false, data: null, error: { code: "FORBIDDEN", message: "Forbidden" }, requestId: req.requestId });
    c.moderationState = "hidden"; await c.save(); ok(res, { id: c.id, moderationState: c.moderationState });
  }));
  // One reaction per user per target (unique index). Tapping the active value
  // again removes it (unlike); tapping the other value switches to it.
  r.post("/reactions", requireAuth, ...verified, validate(z.object({ ...target, value: z.enum(["like", "dislike"]) })), asyncHandler(async (req, res) => {
    const filter = { authorId: req.user!.id, targetType: req.body.targetType, targetId: req.body.targetId };
    const existing: any = await Reaction.findOne(filter).select("value").lean();
    if (existing && existing.value === req.body.value) {
      await Reaction.deleteOne({ _id: existing._id });
      return ok(res, { value: null });
    }
    const doc: any = await Reaction.findOneAndUpdate(filter, { $set: { value: req.body.value } }, { upsert: true, returnDocument: "after" });
    ok(res, { value: doc.value }, existing ? 200 : 201);
  }));
  // Public counts + the caller's own reaction (null when signed out).
  r.get("/reactions/summary", optionalAuth, validate(z.object({ ...target }), "query"), asyncHandler(async (req, res) => {
    const query = q(req);
    const base = { targetType: query.targetType, targetId: query.targetId };
    const [likes, dislikes, mine]: any = await Promise.all([
      Reaction.countDocuments({ ...base, value: "like" }),
      Reaction.countDocuments({ ...base, value: "dislike" }),
      req.user ? Reaction.findOne({ ...base, authorId: req.user.id }).select("value").lean() : Promise.resolve(null),
    ]);
    ok(res, { likes, dislikes, mine: mine?.value ?? null });
  }));
  r.post("/ratings", requireAuth, ...verified, validate(z.object({ targetType: z.enum([...CONTENT_TYPES, "teacher"]), targetId: z.string().min(1).max(100), value: z.number().min(1).max(5) })), asyncHandler(async (req, res) =>
    ok(res, await Rating.findOneAndUpdate({ authorId: req.user!.id, targetType: req.body.targetType, targetId: req.body.targetId }, { $set: { value: req.body.value } }, { upsert: true, returnDocument: "after" }), 201)));
  // Rating aggregates per content item (averages shown on the teacher dashboard).
  r.get("/ratings/summary", requireAuth, validate(z.object({ targetType: z.enum([...CONTENT_TYPES, "teacher"]), targetIds: z.string().min(1).max(2000) }), "query"), asyncHandler(async (req, res) => {
    const query = q(req);
    const ids = String(query.targetIds).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
    const stats = ids.length ? await Rating.aggregate([
      { $match: { targetType: query.targetType, targetId: { $in: ids } } },
      { $group: { _id: "$targetId", avg: { $avg: "$value" }, count: { $sum: 1 } } },
    ]) : [];
    ok(res, { items: stats.map((s: any) => ({ targetId: String(s._id), avg: Math.round(s.avg * 10) / 10, count: s.count })) });
  }));
  r.post("/follows", requireAuth, ...verified, validate(z.object({ teacherId: z.string().min(1).max(100) })), asyncHandler(async (req, res) => {
    if (req.body.teacherId === req.user!.id) return res.status(400).json({ success: false, data: null, error: { code: "BAD_REQUEST", message: "Cannot follow yourself" }, requestId: req.requestId });
    ok(res, await Follow.findOneAndUpdate({ followerId: req.user!.id, teacherId: req.body.teacherId }, {}, { upsert: true, returnDocument: "after" }), 201);
  }));
  r.delete("/follows/:id", requireAuth, validate(z.object({ id: z.string().min(1).max(100) }), "params"), asyncHandler(async (req, res) => {
    await Follow.deleteOne({ followerId: req.user!.id, teacherId: p(req).id }); ok(res, { following: false });
  }));
  // Frontend sync: list own follows + discover teachers (safe profile fields only)
  // Teacher view: people following me, with safe profile fields attached.
  // Join Date = when the follow happened (follow.createdAt).
  r.get("/follows/followers", requireAuth, ...verified, requireRole("teacher", "admin"),
    validate(pagination.extend({
      from: z.string().datetime().optional(), to: z.string().datetime().optional(),
      teacherId: z.string().max(100).optional(),
    }), "query"), asyncHandler(async (req, res) => {
      const query = q(req); const { skip, limit } = paginate(query);
      const teacherId = req.user!.role === "admin" && query.teacherId ? String(query.teacherId) : req.user!.id;
      const filter: any = { teacherId };
      if (query.from || query.to) {
        filter.createdAt = {};
        if (query.from) filter.createdAt.$gte = new Date(query.from);
        if (query.to) filter.createdAt.$lte = new Date(query.to);
      }
      if (query.search) {
        const safe = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matched = await Profile.find({
          $or: [{ name: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }],
        }).select("userId").limit(200).lean();
        const ids = matched.map((x: any) => String(x.userId));
        if (!ids.length) return ok(res, { items: [], total: 0, page: query.page, limit });
        filter.followerId = { $in: ids };
      }
      const [follows, total] = await Promise.all([
        Follow.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Follow.countDocuments(filter),
      ]);
      const ids = [...new Set(follows.map((f: any) => String(f.followerId)))];
      const profiles = ids.length
        ? await Profile.find({ userId: { $in: ids } }).select("userId name email bio avatarUploadId createdAt").lean()
        : [];
      const byId = new Map(profiles.map((x: any) => [String(x.userId), x]));
      const items = follows.map((f: any) => {
        const pr: any = byId.get(String(f.followerId));
        const email = pr?.email ?? "";
        return {
          _id: String(f._id),
          followerId: String(f.followerId),
          name: pr?.name || "Unnamed follower",
          email,
          username: email ? `@${email.split("@")[0]}` : "",
          bio: pr?.bio ?? "",
          avatarUploadId: pr?.avatarUploadId ?? null,
          followedAt: f.createdAt,
        };
      });
      ok(res, { items, total, page: query.page, limit });
    }));
  r.get("/follows/me", requireAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const [items, total] = await Promise.all([Follow.find({ followerId: req.user!.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Follow.countDocuments({ followerId: req.user!.id })]);
    ok(res, { items, total, page: query.page, limit });
  }));
  // Saved content: bookmark any content item; list/remove your own bookmarks.
  r.get("/bookmarks/me", requireAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const [items, total] = await Promise.all([Bookmark.find({ userId: req.user!.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Bookmark.countDocuments({ userId: req.user!.id })]);
    ok(res, { items, total, page: query.page, limit });
  }));
  r.post("/bookmarks", requireAuth, ...verified, validate(z.object({ targetType: z.enum(CONTENT_TYPES), targetId: z.string().min(1).max(100) })), asyncHandler(async (req, res) =>
    ok(res, await Bookmark.findOneAndUpdate({ userId: req.user!.id, targetType: req.body.targetType, targetId: req.body.targetId }, {}, { upsert: true, returnDocument: "after" }), 201)));
  r.delete("/bookmarks/:targetType/:targetId", requireAuth, validate(z.object({ targetType: z.enum(CONTENT_TYPES), targetId: idParam.shape.id }), "params"), asyncHandler(async (req, res) => {
    await Bookmark.deleteOne({ userId: req.user!.id, targetType: p(req).targetType, targetId: p(req).targetId }); ok(res, { saved: false });
  }));
  // Blocked teachers: hide a teacher's content; list/unblock your own blocks.
  r.get("/blocks/me", requireAuth, validate(pagination, "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    const [items, total] = await Promise.all([Block.find({ userId: req.user!.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Block.countDocuments({ userId: req.user!.id })]);
    ok(res, { items, total, page: query.page, limit });
  }));
  r.post("/blocks", requireAuth, ...verified, validate(z.object({ teacherId: z.string().min(1).max(100) })), asyncHandler(async (req, res) => {
    if (req.body.teacherId === req.user!.id) return res.status(400).json({ success: false, data: null, error: { code: "BAD_REQUEST", message: "Cannot block yourself" }, requestId: req.requestId });
    ok(res, await Block.findOneAndUpdate({ userId: req.user!.id, teacherId: req.body.teacherId }, {}, { upsert: true, returnDocument: "after" }), 201);
  }));
  r.delete("/blocks/:teacherId", requireAuth, validate(z.object({ teacherId: z.string().max(100) }), "params"), asyncHandler(async (req, res) => {
    await Block.deleteOne({ userId: req.user!.id, teacherId: p(req).teacherId }); ok(res, { blocked: false });
  }));
  r.get("/teachers", validate(pagination, "query"), asyncHandler(async (req, res) => {
    const query = q(req); const { skip, limit } = paginate(query);
    // Teachers resolve via the `user` collection (profiles store no role).
    const teacherIds = await listUserIdsByRole(deps.authDb, "teacher");
    const filter: any = { status: "active" };
    if (query.search) filter.$or = [{ name: { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { email: { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }];
    if (deps.authDb) {
      if (teacherIds.length === 0) return ok(res, { items: [], total: 0, page: query.page, limit });
      filter.userId = { $in: teacherIds };
    }
    const [profiles, total] = await Promise.all([Profile.find(filter).select("userId email name bio avatarUploadId coverUploadId username subject university degree location skills socials createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Profile.countDocuments(filter)]);
    const roles = await roleMapForUserIds(deps.authDb, profiles.map((p: any) => String(p.userId)));
    const items = profiles.map((p: any) => {
      const u = roles.get(String(p.userId));
      const { role, ...rest } = p;
      void role; // ignore any legacy profile.role lingering in old documents
      return { ...rest, role: u?.role ?? "teacher" };
    });
    ok(res, { items, total, page: query.page, limit });
  }));
  // Public teacher profile (safe fields only) for the student-facing profile page.
  r.get("/teachers/:id", validate(z.object({ id: z.string().min(1).max(100) }), "params"), asyncHandler(async (req, res) => {
    const teacherId = p(req).id;
    if (deps.authDb) {
      const teacherIds = await listUserIdsByRole(deps.authDb, "teacher");
      if (!teacherIds.includes(teacherId)) throw notFound("Teacher not found");
    }
    const profile: any = await Profile.findOne({ userId: teacherId, status: "active" })
      .select("userId email name bio avatarUploadId coverUploadId username subject university degree location skills socials createdAt").lean();
    if (!profile) throw notFound("Teacher not found");
    const { role, ...rest } = profile;
    void role;
    ok(res, { ...rest, role: "teacher" });
  }));
  r.post("/reports", requireAuth, ...verified, validate(z.object({ targetType: z.string().min(1).max(50), targetId: z.string().min(1).max(100), reason: z.string().min(3).max(1000) })), asyncHandler(async (req, res) => {
    // One report per user per item — repeats are rejected, not stored twice.
    const existing = await Report.findOne({ reporterId: req.user!.id, targetType: req.body.targetType, targetId: req.body.targetId }).select("_id").lean();
    if (existing) throw conflict("You have already reported this item.");
    try {
      ok(res, await Report.create({ ...req.body, reporterId: req.user!.id }), 201);
    } catch (e: any) {
      if (e?.code === 11000) throw conflict("You have already reported this item.");
      throw e;
    }
  }));
  return r;
}
