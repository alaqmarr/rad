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
      {
        protocol: "https",
        hostname: "karamonline.com",
      },
      {
        protocol: "https",
        hostname: "assets.udyogisafety.com",
      },
      {
        protocol: "https",
        hostname: "udyogisafety.com",
      },
      {
        protocol: "https",
        hostname: "assets.stanleytools.com",
      },
      {
        protocol: "https",
        hostname: "www.stanleytools.com",
      },
      {
        protocol: "https",
        hostname: "media.toolbuy.com",
      },
      {
        protocol: "https",
        hostname: "havells.com",
      },
      {
        protocol: "https",
        hostname: "static.godrejenterprises.com",
      },
      {
        protocol: "https",
        hostname: "www.supreme.co.in",
      },
      {
        protocol: "https",
        hostname: "www.jindalstainless.com",
      },
      {
        protocol: "https",
        hostname: "www.bostik.com",
      },
      {
        protocol: "https",
        hostname: "www.festo.com",
      },
      {
        protocol: "https",
        hostname: "cms.polycab.com",
      },
      {
        protocol: "https",
        hostname: "dm.henkel-dam.com",
      },
    ],
  },
  serverExternalPackages: ["@libsql/client", "bcryptjs", "nodemailer"],
};

export default nextConfig;
