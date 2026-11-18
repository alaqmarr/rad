import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "radiantindustrial.in",
      },
    ],
  },
  serverExternalPackages: ["@libsql/client", "bcryptjs", "nodemailer"],
};

export default nextConfig;
