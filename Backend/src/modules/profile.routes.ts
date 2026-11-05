import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, validate } from "../common/middleware.js";
import {
  badRequest,
  conflict,
  invalidPassword,
  notFound,
} from "../common/errors.js";
import { requireEmailVerified } from "../auth/guards.js";
import {
  findCredentialAccount,
  verifyPassword,
} from "../auth/credentials.js";
import { ObjectId } from "mongodb";
import { findUserByUserId } from "../services/user-roles.js";
import {
  Bookmark,
  Block,
  Comment,
  Entitlement,
  Exam,
  ExamAttempt,
  Follow,
  Purchase,
  Question,
  Rating,
  Reaction,
  Video,
  Playlist,
  Profile,
} from "../models/index.js";
import { httpUrl } from "../common/schemas.js";
const socialUrl = httpUrl.or(z.literal(""));
import { audit } from "../services/audit.js";

export function profileRouter(deps: { requireAuth: any; authDb?: () => any }) {
  const r = Router();
  const { requireAuth } = deps;
  // Role always comes from the Better Auth `user` collection (req.user);
  // profiles never store it — a legacy `profile.role` is ignored.
  const maskAccount = (v: unknown) => {
    const s = typeof v === "string" ? v : "";
    return s ? `••••${s.slice(-4)}` : "";
  };
  const safe = (user: any, profile: any, hasPassword = false) => ({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: profile?.name ?? "",
    role: user.role,
    roleSelected: Boolean(user.roleSelected),
    // Whether account deletion must ask for a password. OAuth-only accounts
    // have no credential account and therefore no password to verify.
    hasPassword,
    bio: profile?.bio ?? "",
    avatarUploadId: profile?.avatarUploadId ?? null,
    coverUploadId: profile?.coverUploadId ?? null,
    joinedAt: profile?.createdAt
      ? new Date(profile.createdAt).toISOString()
      : null,
    status: profile?.status ?? "active",
    username: profile?.username ?? "",
    subject: profile?.subject ?? "",
    university: profile?.university ?? "",
    degree: profile?.degree ?? "",
    location: profile?.location ?? "",
    skills: profile?.skills ?? [],
    socials: {
      github: profile?.socials?.github ?? "",
      youtube: profile?.socials?.youtube ?? "",
      linkedin: profile?.socials?.linkedin ?? "",
      dev: profile?.socials?.dev ?? "",
      website: profile?.socials?.website ?? "",
    },
    payout: {
      accountType: profile?.payout?.accountType ?? "",
      holderName: profile?.payout?.holderName ?? "",
      bankName: profile?.payout?.bankName ?? "",
      accountNumber: maskAccount(profile?.payout?.accountNumber),
      branchName: profile?.payout?.branchName ?? "",
      routingNumber: profile?.payout?.routingNumber ?? "",
      provider: profile?.payout?.provider ?? "",
      mobileNumber: profile?.payout?.mobileNumber ?? "",
    },
  });
  r.get(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
      const [profile, credential] = await Promise.all([
        Profile.findOne({ userId: req.user!.id }).lean(),
        findCredentialAccount(deps.authDb, req.user!.id),
      ]);
      ok(res, safe(req.user, profile, Boolean(credential?.password)));
    }),
  );
  r.patch(
    "/",
    requireAuth,
    validate(
      z
        .object({
          name: z.string().min(1).max(120).optional(),
          bio: z.string().max(1000).optional(),
          avatarUploadId: z.string().max(100).nullable().optional(),
          coverUploadId: z.string().max(100).nullable().optional(),
          username: z
            .string()
            .max(40)
            .regex(/^[A-Za-z0-9_]*$/, "Letters, numbers and underscores only")
            .optional(),
          subject: z.string().max(80).optional(),
          university: z.string().max(160).optional(),
          degree: z.string().max(160).optional(),
          location: z.string().max(120).optional(),
          skills: z.array(z.string().min(1).max(40)).max(20).optional(),
          socials: z
            .object({
              github: socialUrl.optional(),
              youtube: socialUrl.optional(),
              linkedin: socialUrl.optional(),
              dev: socialUrl.optional(),
              website: socialUrl.optional(),
            })
            .partial()
            .optional(),
          payout: z
            .object({
              accountType: z.enum(["bank", "mobile"]).optional(),
              holderName: z.string().max(120).optional(),
              bankName: z.string().max(160).optional(),
              accountNumber: z.string().max(32).optional(),
              branchName: z.string().max(160).optional(),
              routingNumber: z.string().max(32).optional(),
              provider: z.string().max(40).optional(),
              mobileNumber: z.string().max(20).optional(),
            })
            .partial()
            .optional(),
        })
        .strict(),
    ),
    asyncHandler(async (req, res) => {
      // Role is deliberately NOT patchable here — role changes are admin/bootstrap workflows only.
      // A masked account number echoed back by a client is display-only.
      if (
        typeof req.body?.payout?.accountNumber === "string" &&
        req.body.payout.accountNumber.includes("•")
      ) {
        delete req.body.payout.accountNumber;
      }
      const [profile, credential] = await Promise.all([
        Profile.findOneAndUpdate(
          { userId: req.user!.id },
          { $set: req.body },
          { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
        ),
        findCredentialAccount(deps.authDb, req.user!.id),
      ]);
      ok(res, safe(req.user, profile?.toObject(), Boolean(credential?.password)));
    }),
  );
  r.delete(
    "/",
    requireAuth,
    requireEmailVerified,
    // Password is required only for credential (email/password) accounts;
    // OAuth-only accounts have nothing to verify.
    validate(z.object({ password: z.string().max(128).optional() })),
    asyncHandler(async (req, res) => {
      const userId = req.user!.id;

      const userCol = deps.authDb?.()?.collection("user");
      if (!userCol)
        throw badRequest(
          "Account deletion not available (auth database unavailable)",
        );

      let authUser = await findUserByUserId(deps.authDb, userId);
      if (!authUser && /^[0-9a-fA-F]{24}$/.test(userId)) {
        authUser =
          (await userCol
            .findOne({ _id: new ObjectId(userId) })
            .catch(() => null)) ?? authUser;
      }
      if (!authUser) {
        authUser =
          (await userCol
            .findOne({ email: req.user!.email })
            .catch(() => null)) ?? authUser;
      }
      if (!authUser) throw notFound("Account not found");

      // Re-verify the current password before any destructive work. A stolen
      // session alone must not be enough to delete the account. Password
      // hashes live in the `account` collection (related by userId), not in
      // `user`. OAuth-only accounts have no credential record, so they delete
      // with the authenticated session alone.
      const canonicalUserId = String(
        authUser.id ?? authUser._id ?? userId,
      );
      const credential = await findCredentialAccount(
        deps.authDb,
        canonicalUserId,
      );
      if (credential?.password) {
        const password = req.body.password ?? "";
        if (!password) throw invalidPassword("Password is required.");
        const matches = await verifyPassword(credential.password, password);
        if (!matches) throw invalidPassword();
      }

      // Teacher precondition: block if they own content with paid purchases
      // (students paid for access — their entitlements must be preserved).
      if (req.user!.role === "teacher") {
        const ownedContent: any[] = await Promise.all([
          Video.find({ ownerId: userId }).select("_id").lean(),
          Playlist.find({ ownerId: userId }).select("_id").lean(),
          Question.find({ ownerId: userId }).select("_id").lean(),
          Exam.find({ ownerId: userId }).select("_id").lean(),
        ]);
        const contentIds = ownedContent.flat().map((d: any) => String(d._id));
        if (contentIds.length) {
          const paidPurchase = await Purchase.findOne({
            contentType: { $in: ["video", "playlist", "question", "exam"] },
            contentId: { $in: contentIds },
            status: "paid",
          })
            .select("_id")
            .lean();
          if (paidPurchase) {
            throw conflict(
              "Cannot delete account: you have content with paid purchases. Students paid for access and their entitlements must be preserved.",
            );
          }
        }
      }

      const uid = userId;

      // Delete user-scoped data (both roles).
      await Promise.all([
        Bookmark.deleteMany({ userId: uid }).catch(() => undefined),
        Block.deleteMany({ userId: uid }).catch(() => undefined),
        Follow.deleteMany({ followerId: uid }).catch(() => undefined),
        Rating.deleteMany({ authorId: uid }).catch(() => undefined),
        Comment.deleteMany({ authorId: uid }).catch(() => undefined),
        Reaction.deleteMany({ authorId: uid }).catch(() => undefined),
        ExamAttempt.deleteMany({ studentId: uid }).catch(() => undefined),
        Purchase.deleteMany({ userId: uid }).catch(() => undefined),
        Entitlement.deleteMany({ userId: uid }).catch(() => undefined),
        // Reverse references: others who followed this user / rated this user as teacher.
        Follow.deleteMany({ teacherId: uid }).catch(() => undefined),
        Rating.deleteMany({ targetType: "teacher", targetId: uid }).catch(
          () => undefined,
        ),
      ]);

      // Teacher-owned content: soft-delete to preserve purchase records.
      if (req.user!.role === "teacher") {
        await Promise.all([
          Video.updateMany({ ownerId: uid }, { status: "hidden" }).catch(
            () => undefined,
          ),
          Playlist.updateMany({ ownerId: uid }, { status: "hidden" }).catch(
            () => undefined,
          ),
          Question.updateMany({ ownerId: uid }, { status: "hidden" }).catch(
            () => undefined,
          ),
          Exam.updateMany({ ownerId: uid }, { status: "hidden" }).catch(
            () => undefined,
          ),
        ]);
      }

      // Delete profile.
      await Profile.deleteOne({ userId: uid }).catch(() => undefined);

      // Delete the auth user record.
      await userCol.deleteOne({ id: uid }).catch(() => undefined);
      if (/^[0-9a-fA-F]{24}$/.test(uid)) {
        await userCol
          .deleteOne({ _id: new ObjectId(uid) })
          .catch(() => undefined);
      }

      // Delete connected account records (credential password + OAuth links).
      const accountCol = deps.authDb?.()?.collection("account");
      if (accountCol) {
        await accountCol.deleteMany({ userId: uid }).catch(() => undefined);
        if (/^[0-9a-fA-F]{24}$/.test(uid)) {
          await accountCol
            .deleteMany({ userId: new ObjectId(uid) })
            .catch(() => undefined);
        }
      }

      // Delete session records tied to this user.
      const sessionCol = deps.authDb?.()?.collection("session");
      if (sessionCol) {
        await sessionCol.deleteMany({ userId: uid }).catch(() => undefined);
        if (/^[0-9a-fA-F]{24}$/.test(uid)) {
          await sessionCol
            .deleteMany({ userId: new ObjectId(uid) })
            .catch(() => undefined);
        }
      }

      await audit(
        req.user!.id,
        "user.account.delete",
        "user",
        uid,
        req.requestId,
        "Account deleted by owner",
      );

      ok(res, { message: "Account deleted successfully" });
    }),
  );
  r.post(
    "/select-role",
    requireAuth,
    validate(z.object({ role: z.enum(["student", "teacher"]) })),
    asyncHandler(async (req, res) => {
      // Onboarding: only users who have not selected a role may choose; never admin, never overwrite an established role.
      // The Better Auth `user` collection is authoritative for role + roleSelected.
      if (req.user!.roleSelected)
        return res.status(409).json({
          success: false,
          data: null,
          error: { code: "CONFLICT", message: "Role already selected" },
          requestId: req.requestId,
        });
      // Primary write: user collection owns the role.
      // Better Auth mongodb adapter keys by `id`; try `_id` fallback for compatibility.
      const userCol = deps.authDb?.()?.collection("user");
      if (!userCol) throw badRequest("User database unavailable");
      
      let result = await userCol.updateOne(
        { id: req.user!.id },
        { $set: { role: req.body.role, roleSelected: true } },
      );
      
      // If no document matched with `id`, try `_id` field
      if (result.matchedCount === 0) {
        const HEX24 = /^[0-9a-fA-F]{24}$/;
        if (HEX24.test(req.user!.id)) {
          const r1 = await userCol.updateOne(
            { _id: new ObjectId(req.user!.id) },
            { $set: { role: req.body.role, roleSelected: true } },
          );
          if (r1.matchedCount > 0) result = r1;
        }
        if (result.matchedCount === 0) {
          const r2 = await userCol.updateOne(
            { _id: req.user!.id as any },
            { $set: { role: req.body.role, roleSelected: true } },
          );
          if (r2.matchedCount > 0) result = r2;
        }
      }
      
      if (result.matchedCount === 0) {
        throw badRequest("User not found in database");
      }
      
      const updated = await Profile.findOneAndUpdate(
        { userId: req.user!.id },
        {
          $set: {
            roleSelected: true,
            email: req.user!.email,
          },
          $unset: { role: "" },
        },
        { returnDocument: "after", upsert: true },
      );
      await audit(
        req.user!.id,
        "user.role.select",
        "user",
        req.user!.id,
        req.requestId,
      );
      const credential = await findCredentialAccount(
        deps.authDb,
        req.user!.id,
      );
      ok(
        res,
        safe(
          { ...req.user, role: req.body.role, roleSelected: true },
          updated?.toObject(),
          Boolean(credential?.password),
        ),
      );
    }),
  );
  return r;
}
