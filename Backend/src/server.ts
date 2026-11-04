import { toNodeHandler } from "better-auth/node";
import { createApp } from "./app.js";
import {
  connectDatabase,
  closeDatabase,
  getMongoDb,
} from "./config/database.js";
import { createAuth } from "./auth/auth.js";
import { defaultResolver } from "./auth/guards.js";
import { env } from "./config/env.js";
import { logger } from "./common/logger.js";

async function main() {
  let authHandler: any;
  let sessionResolver: any;
  let getAuthDb: any;
  if (env.MONGODB_URI) {
    const db = await connectDatabase();
    const auth = createAuth(db);
    authHandler = toNodeHandler(auth.handler as any);
    getAuthDb = () => getMongoDb();  // Define BEFORE using it
    sessionResolver = defaultResolver(auth as any, getAuthDb);
  } else {
    logger.warn(
      "MONGODB_URI not set — auth/DB routes will return 503/NOT_READY. Set it in .env (MongoDB Atlas).",
    );
  }
  const app = createApp({ authHandler, sessionResolver, getAuthDb });
  const server = app.listen(env.PORT, () =>
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      "LearnTest API listening",
    ),
  );
  const shutdown = (signal: string) => {
    logger.info({ signal }, "graceful shutdown");
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
main().catch((e) => {
  logger.error({ err: (e as Error).message }, "startup failed");
  process.exit(1);
});
