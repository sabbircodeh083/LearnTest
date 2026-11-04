import pino from "pino";
import { env } from "../config/env.js";
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "req.headers['x-api-key']",
      "password",
      "*.password",
      "token",
      "*.token",
      "store_passwd",
      "SMTP_PASSWORD",
      "BOUNCER_API_KEY",
      "*.BOUNCER_API_KEY",
      "*.apiKey",
    ],
    censor: "[REDACTED]",
  },
});
