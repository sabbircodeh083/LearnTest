import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, validate } from "../common/middleware.js";
import { Profile } from "../models/index.js";
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
  const safe = (user: any, profile: any) => ({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: profile?.name ?? "",
    role: user.role,
    roleSelected: Boolean(user.roleSelected || profile?.roleSelected),
    bio: profile?.bio ?? "",
    avatarUploadId: profile?.avatarUploadId ?? null,
    coverUploadId: profile?.coverUploadId ?? null,
    joinedAt: profile?.createdAt ? new Date(profile.createdAt).toISOString() : null,
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
      const profile = await Profile.findOne({ userId: req.user!.id }).lean();
      ok(res, safe(req.user, profile));
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
          username: z.string().max(40).regex(/^[A-Za-z0-9_]*$/, "Letters, numbers and underscores only").optional(),
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
      if (typeof req.body?.payout?.accountNumber === "string" && req.body.payout.accountNumber.includes("•")) {
        delete req.body.payout.accountNumber;
      }
      const profile = await Profile.findOneAndUpdate(
        { userId: req.user!.id },
        { $set: req.body },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
      );
      ok(res, safe(req.user, profile?.toObject()));
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
        return res
          .status(409)
          .json({
            success: false,
            data: null,
            error: { code: "CONFLICT", message: "Role already selected" },
            requestId: req.requestId,
          });
      const profile: any = await Profile.findOne({ userId: req.user!.id });
      if (profile?.roleSelected && !req.user!.roleSelected) {
        // Legacy onboarding flag lives on the profile only — still counts as selected.
        return res
          .status(409)
          .json({
            success: false,
            data: null,
            error: { code: "CONFLICT", message: "Role already selected" },
            requestId: req.requestId,
          });
      }
      // Primary write: user collection owns the role.
      await deps
        .authDb?.()
        ?.collection("user")
        .updateOne(
          { id: req.user!.id },
          { $set: { role: req.body.role, roleSelected: true } },
        );
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
      ok(
        res,
        safe(
          { ...req.user, role: req.body.role, roleSelected: true },
          updated?.toObject(),
        ),
      );
    }),
  );
  return r;
}
