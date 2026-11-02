import { z } from "zod";
export const idParam = z.object({ id: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/) });
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(), status: z.string().max(30).optional(),
});
export const paginate = (query: any) => ({ skip: (query.page - 1) * query.limit, limit: query.limit, page: query.page });
export const httpUrl = z.string().url().max(2048).refine((u) => /^https?:$/.test(new URL(u).protocol), "Only http(s) URLs allowed");
export const contentBody = z.object({
  title: z.string().min(1).max(200), description: z.string().max(5000).optional().default(""),
  tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  visibility: z.enum(["public", "private", "unlisted"]).optional().default("public"),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  price: z.number().min(0).max(1_000_000).optional().default(0), currency: z.string().length(3).optional().default("BDT"),
});
export const stripPrivateQuestion = (doc: any, authorized: boolean) => {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  if (!authorized) { delete o.answer; delete o.rubric; delete o.correctOptions; delete o.explanation; }
  return o;
};
