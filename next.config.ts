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
      {
        protocol: "https",
        hostname: "dmctools.com",
      },
      {
        protocol: "https",
        hostname: "www.gazelleindustrial.com",
      },
      {
        protocol: "https",
        hostname: "gazelleindustrial.com",
      },
    ],
  },
  serverExternalPackages: ["@libsql/client", "bcryptjs", "nodemailer"],
};

export default nextConfig;
