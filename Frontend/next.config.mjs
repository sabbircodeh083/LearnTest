import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const apiOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").origin; } catch { return "http://localhost:4000"; }
})();

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js development mode (Fast Refresh) requires eval(); it is
      // allowed in development only. Production never includes it.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com",
      "font-src 'self' data:",
      // Uploaded videos stream from the API origin (separate port/host); blob:
      // covers the authorized-download fallback used by the player.
      `media-src 'self' blob: ${apiOrigin}`,
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
      `connect-src 'self' ${apiOrigin}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectDir,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // /student/tests is only a detail route (/student/tests/[id]);
      // the listing lives at /student/my-exams.
      { source: "/student/tests", destination: "/student/my-exams", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};
export default nextConfig;
