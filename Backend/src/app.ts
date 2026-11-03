import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import rateLimit from "express-rate-limit";
import { corsOrigins, env } from "./config/env.js";
import { errorHandler, notFoundHandler, ok, requestId } from "./common/middleware.js";
import { isDbReady } from "./config/database.js";
import { makeOptionalAuth, makeRequireAuth, requireEmailVerified, requireRoleSelected, type SessionResolver } from "./auth/guards.js";
import { contentRouter } from "./modules/content.routes.js";
import { learningRouter } from "./modules/learning.routes.js";
import { engagementRouter } from "./modules/engagement.routes.js";
import { uploadsRouter } from "./modules/uploads.routes.js";
import { entitlementsRouter, paymentsRouter, purchasesRouter } from "./modules/payments/payments.routes.js";
import { adminRouter } from "./modules/admin.routes.js";
import { profileRouter } from "./modules/profile.routes.js";
import { SUPPORTED_CURRENCIES } from "./common/schemas.js";
import { openapi } from "./openapi.js";

export interface AppDeps { authHandler?: (req: any, res: any) => unknown; sessionResolver?: SessionResolver; getAuthDb?: () => any }

export function createApp(deps: AppDeps = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || corsOrigins.includes(origin)), credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" })); // SSLCOMMERZ callbacks are form-encoded

  // Rate limiting (brute-force / spam / gateway-abuse protection).
  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const apiLimiter = rateLimit({ windowMs, limit: Math.max(env.RATE_LIMIT_MAX_REQUESTS, 1000), standardHeaders: "draft-7", legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs, limit: 100, standardHeaders: "draft-7", legacyHeaders: false });
  app.use("/api/v1", apiLimiter);

  // CSRF: cookie-authenticated state-changing requests from a browser must
  // come from a trusted frontend origin. Requests without an Origin header
  // (non-browser clients, provider callbacks) are unaffected; the payment
  // provider's own callback posts are exempt (they are validated server-side
  // and never trusted for settlement on their own).
  const trusted = new Set([...corsOrigins, env.FRONTEND_URL, env.API_BASE_URL].map((o) => { try { return new URL(o).origin; } catch { return o; } }));
  app.use((req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (req.path.startsWith("/api/v1/payments/sslcommerz/")) return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    let ok = false;
    try { ok = trusted.has(new URL(origin).origin); } catch { /* malformed Origin header — blocked below */ }
    if (!ok) return res.status(403).json({ success: false, data: null, error: { code: "FORBIDDEN", message: "Cross-site request blocked" }, requestId: (req as any).requestId });
    return next();
  });

  // Better Auth (mounted by server.ts once Mongo is connected; 503 until then, never a fake auth)
  app.use("/api/auth", authLimiter);
  app.all("/api/auth/*", (req, res) => (deps.authHandler ? deps.authHandler(req, res) : res.status(503).json({ success: false, data: null, error: { code: "AUTH_UNAVAILABLE", message: "Auth service unavailable (database not connected)" }, requestId: (req as any).requestId })));

  const resolver: SessionResolver = deps.sessionResolver ?? (async () => null);
  const requireAuth = makeRequireAuth(resolver);
  const optionalAuth = makeOptionalAuth(resolver);
  const verified = [requireEmailVerified, requireRoleSelected];

  const v1 = express.Router();
  v1.get("/health", (_req, res) => ok(res, { status: "ok", timestamp: new Date().toISOString() }));
  v1.get("/ready", (_req, res) => (isDbReady() ? ok(res, { status: "ready", database: "connected" }) : res.status(503).json({ success: false, data: null, error: { code: "NOT_READY", message: "Database not connected" }, requestId: (_req as any).requestId })));
  // Public client configuration. Single source of truth for values the
  // frontend must mirror: upload limits and pricing currencies all come from
  // .env (via env.*) — the frontend must never hardcode these numbers.
  v1.get("/config", (_req, res) => ok(res, {
    uploadLimits: {
      pdf: { sizeMB: env.MAX_PDF_SIZE_MB, files: env.MAX_PDF_FILES },
      zip: { sizeMB: env.MAX_ZIP_SIZE_MB, files: env.MAX_ZIP_FILES },
      video: { sizeMB: env.MAX_VIDEO_SIZE_MB, files: env.MAX_VIDEO_FILES },
      image: { sizeMB: env.MAX_IMAGE_SIZE_MB, files: env.MAX_IMAGE_FILES },
    },
    currencies: [...SUPPORTED_CURRENCIES],
    defaultCurrency: env.PAYMENT_CURRENCY,
  }));
  v1.use("/me", profileRouter({ requireAuth, authDb: deps.getAuthDb }));
  v1.use(contentRouter({ requireAuth, verified, optionalAuth }));
  v1.use(learningRouter({ requireAuth, verified, optionalAuth }));
  v1.use(engagementRouter({ requireAuth, verified, optionalAuth, authDb: deps.getAuthDb }));
  v1.use("/uploads", uploadsRouter({ requireAuth, verified }));
  v1.use("/payments/sslcommerz", paymentsRouter({ requireAuth, verified }));
  v1.use("/purchases", purchasesRouter({ requireAuth, verified, authDb: deps.getAuthDb }));
  v1.use("/entitlements", entitlementsRouter({ requireAuth }));
  v1.use("/admin", adminRouter({ requireAuth, verified, authDb: deps.getAuthDb }));
  app.use("/api/v1", v1);
  // API docs are a development aid — never publish the full API map in production.
  if (env.NODE_ENV !== "production") {
    app.get("/api/docs/openapi.json", (_req, res) => res.json(openapi));
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi as any));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
