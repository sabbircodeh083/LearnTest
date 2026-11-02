/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
