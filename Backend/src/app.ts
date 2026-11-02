import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
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

  // Rate limiting removed for testing — unlimited requests (re-add express-rate-limit here to restore).

  // Better Auth (mounted by server.ts once Mongo is connected; 503 until then, never a fake auth)
  app.all("/api/auth/*", (req, res) => (deps.authHandler ? deps.authHandler(req, res) : res.status(503).json({ success: false, data: null, error: { code: "AUTH_UNAVAILABLE", message: "Auth service unavailable (database not connected)" }, requestId: (req as any).requestId })));

  const resolver: SessionResolver = deps.sessionResolver ?? (async () => null);
  const requireAuth = makeRequireAuth(resolver);
  const optionalAuth = makeOptionalAuth(resolver);
  const verified = [requireEmailVerified, requireRoleSelected];

  const v1 = express.Router();
  v1.get("/health", (_req, res) => ok(res, { status: "ok", timestamp: new Date().toISOString() }));
  v1.get("/ready", (_req, res) => (isDbReady() ? ok(res, { status: "ready", database: "connected" }) : res.status(503).json({ success: false, data: null, error: { code: "NOT_READY", message: "Database not connected" }, requestId: (_req as any).requestId })));
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
  app.get("/api/docs/openapi.json", (_req, res) => res.json(openapi));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi as any));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
