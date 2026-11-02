import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().optional().default(""),
  MONGODB_DB_NAME: z.string().min(1).default("learntest"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be >=32 chars (openssl rand -base64 32)")
    .optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GITHUB_CLIENT_ID: z.string().optional().default(""),
  GITHUB_CLIENT_SECRET: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  EMAIL_FROM: z
    .string()
    .default("noreply@example.com")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), {
      message: "EMAIL_FROM must be a single valid address like noreply@yourdomain.com",
    }),
  SSLCOMMERZ_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  SSLCOMMERZ_STORE_ID: z.string().optional().default(""),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional().default(""),
  SSLCOMMERZ_INIT_URL: z
    .string()
    .url()
    .default("https://sandbox.sslcommerz.com/gwprocess/v4/api.php"),
  SSLCOMMERZ_VALIDATION_URL: z
    .string()
    .url()
    .default(
      "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php",
    ),
  SSLCOMMERZ_IPN_URL: z
    .string()
    .url()
    .default("http://localhost:4000/api/v1/payments/sslcommerz/ipn"),
  PAYMENT_SUCCESS_URL: z
    .string()
    .url()
    .default("http://localhost:3000/payment/result"),
  PAYMENT_FAIL_URL: z
    .string()
    .url()
    .default("http://localhost:3000/payment/result"),
  PAYMENT_CANCEL_URL: z
    .string()
    .url()
    .default("http://localhost:3000/payment/result"),
  PAYMENT_CURRENCY: z.string().length(3).default("BDT"),
  UPLOAD_STORAGE: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("./private-uploads"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(100).default(10),
  MAX_UPLOAD_FILES: z.coerce.number().int().min(1).max(10).default(3),
  OBJECT_STORAGE_ENDPOINT: z.string().optional().default(""),
  OBJECT_STORAGE_REGION: z.string().default("auto"),
  OBJECT_STORAGE_BUCKET: z.string().optional().default(""),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional().default(""),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(""),
  MALWARE_SCAN_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  MALWARE_SCAN_PROVIDER: z.enum(["bouncer"]).default("bouncer"),
  BOUNCER_API_KEY: z.string().optional().default(""),
  BOUNCER_API_BASE_URL: z.string().url().default("https://api.usebouncer.dev"),
  MALWARE_SCAN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(15000),
  MALWARE_SCAN_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(2000),
  MALWARE_SCAN_POLL_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(15),
  MALWARE_SCAN_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  LOG_LEVEL: z.string().default("info"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}
if (parsed.data.NODE_ENV === "production") {
  const missing = (["MONGODB_URI", "BETTER_AUTH_SECRET"] as const).filter(
    (k) => !parsed.data[k],
  );
  if (missing.length)
    throw new Error(`Missing required production env: ${missing.join(",")}`);
  if (
    parsed.data.SSLCOMMERZ_MODE === "live" &&
    parsed.data.SSLCOMMERZ_INIT_URL.includes("sandbox")
  )
    throw new Error("Live mode must not use sandbox SSLCOMMERZ endpoints");
  if (parsed.data.MALWARE_SCAN_ENABLED && !parsed.data.BOUNCER_API_KEY)
    throw new Error(
      "MALWARE_SCAN_ENABLED=true requires BOUNCER_API_KEY (fail closed; never start unscanned-clean)",
    );
}
export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const trustedOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
