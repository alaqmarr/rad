import { NextResponse } from "next/server";
import { getActiveProductCount } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { getDetectedSiteOrigin } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PRODUCTS_PER_SITEMAP = 8000;

function escXml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [settings, productCount] = await Promise.all([
    getSiteSettings(),
    getActiveProductCount(),
  ]);
  const baseUrl = await getDetectedSiteOrigin(settings);
  const nowIso = new Date().toISOString();
  const productChunks = Math.max(1, Math.ceil(productCount / PRODUCTS_PER_SITEMAP));

  const entries: string[] = [`${baseUrl}/sitemap/core.xml`];
  for (let i = 0; i < productChunks; i++) {
    entries.push(`${baseUrl}/sitemap/products-${i}.xml`);
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (loc) =>
        `  <sitemap>\n    <loc>${escXml(loc)}</loc>\n    <lastmod>${nowIso}</lastmod>\n  </sitemap>`
    ),
    "</sitemapindex>",
  ].join("\n");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
