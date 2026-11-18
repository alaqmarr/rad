import type { Metadata } from "next";
import { headers } from "next/headers";

const DEFAULT_PRODUCTION_URL = "https://radiantindustrial.in";

/**
 * Automatically resolves the live request origin (protocol + host) behind reverse proxies
 * like Nginx/Cloudflare, falling back cleanly to DB site_url / NEXTAUTH_URL during builds.
 */
export async function getDetectedSiteOrigin(
  settings?: Record<string, string>
): Promise<string> {
  const configuredUrl = (
    settings?.["site_url"] ||
    process.env.NEXTAUTH_URL ||
    DEFAULT_PRODUCTION_URL
  )
    .trim()
    .replace(/\/+$/, "");

  try {
    const h = await headers();
    const rawHost = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.trim();
    const rawProto = (h.get("x-forwarded-proto") || "").split(",")[0]?.trim();

    if (rawHost) {
      const lower = rawHost.toLowerCase();
      const isLocalHost =
        lower.startsWith("localhost") ||
        lower.startsWith("127.0.0.1") ||
        lower.startsWith("0.0.0.0");

      if (!isLocalHost) {
        const proto = rawProto === "http" || rawProto === "https" ? rawProto : "https";
        return `${proto}://${rawHost}`;
      }

      // On local dev/server loopback, keep configuredUrl if it is non-local, or use actual local origin
      if (!configuredUrl || configuredUrl.includes("localhost")) {
        const proto = rawProto === "https" ? "https" : "http";
        return `${proto}://${rawHost}`;
      }
    }
  } catch {
    // Outside request context (e.g., build-time static metadata)
  }

  return configuredUrl || DEFAULT_PRODUCTION_URL;
}

export function buildAbsoluteUrl(origin: string, path: string): string {
  const cleanOrigin = origin.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanPath === "/" ? cleanOrigin : `${cleanOrigin}${cleanPath}`;
}

export function buildSeoMetadata(params: {
  origin: string;
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  settings?: Record<string, string>;
  imageUrl?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const companyName = params.settings?.["company_name"] || "Radiant Industrial Co.";
  const canonical = buildAbsoluteUrl(params.origin, params.path);
  const rawImg = params.imageUrl || params.settings?.["logo_primary"] || "/images/hero-industrial.jpg";
  const ogImage = rawImg.startsWith("http") ? rawImg : buildAbsoluteUrl(params.origin, rawImg);

  const globalKeywords = (params.settings?.["seo_keywords"] || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const mergedKeywords = Array.from(
    new Set([...(params.keywords || []), ...globalKeywords].filter(Boolean))
  ).slice(0, 20);

  return {
    title: params.title,
    description: params.description,
    keywords: mergedKeywords.length ? mergedKeywords : undefined,
    alternates: {
      canonical,
    },
    openGraph: {
      type: params.type || "website",
      locale: "en_IN",
      url: canonical,
      siteName: companyName,
      title: params.title,
      description: params.description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: params.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: params.title,
      description: params.description,
      images: [ogImage],
    },
    robots: params.noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}
