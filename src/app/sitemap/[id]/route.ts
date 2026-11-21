import { NextResponse } from "next/server";
import {
  getActiveBrands,
  getActiveCategories,
  getActiveDivisions,
  getSitemapProductBatch,
} from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, getDetectedSiteOrigin } from "@/lib/seo";

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

function renderUrlEntry(params: {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
  image?: string | null;
}) {
  const lines = [
    "  <url>",
    `    <loc>${escXml(params.loc)}</loc>`,
    ...(params.lastmod ? [`    <lastmod>${escXml(params.lastmod)}</lastmod>`] : []),
    `    <changefreq>${params.changefreq}</changefreq>`,
    `    <priority>${params.priority}</priority>`,
    ...(params.image
      ? [
          "    <image:image>",
          `      <image:loc>${escXml(params.image)}</image:loc>`,
          "    </image:image>",
        ]
      : []),
    "  </url>",
  ];
  return lines.join("\n");
}

function wrapUrlset(urls: string[]) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    "</urlset>",
  ].join("\n");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const settings = await getSiteSettings();
  const baseUrl = await getDetectedSiteOrigin(settings);
  const nowIso = new Date().toISOString();

  if (id === "core.xml") {
    const [divisions, categories, brands] = await Promise.all([
      getActiveDivisions(),
      getActiveCategories(),
      getActiveBrands(),
    ]);

    const urls: string[] = [
      renderUrlEntry({
        loc: baseUrl,
        lastmod: nowIso,
        changefreq: "daily",
        priority: "1.0",
        image: buildAbsoluteUrl(baseUrl, "/images/hero-industrial.jpg"),
      }),
      renderUrlEntry({
        loc: `${baseUrl}/products`,
        lastmod: nowIso,
        changefreq: "daily",
        priority: "0.9",
      }),
      renderUrlEntry({
        loc: `${baseUrl}/brands`,
        lastmod: nowIso,
        changefreq: "weekly",
        priority: "0.9",
      }),
      renderUrlEntry({
        loc: `${baseUrl}/about`,
        lastmod: nowIso,
        changefreq: "monthly",
        priority: "0.75",
      }),
      renderUrlEntry({
        loc: `${baseUrl}/contact`,
        lastmod: nowIso,
        changefreq: "monthly",
        priority: "0.8",
      }),
      renderUrlEntry({
        loc: `${baseUrl}/documents`,
        lastmod: nowIso,
        changefreq: "weekly",
        priority: "0.7",
      }),
    ];

    for (const d of divisions) {
      urls.push(
        renderUrlEntry({
          loc: `${baseUrl}/divisions/${d.slug}`,
          lastmod: nowIso,
          changefreq: "weekly",
          priority: "0.85",
          image: d.heroImageUrl ? buildAbsoluteUrl(baseUrl, d.heroImageUrl) : null,
        })
      );
    }

    for (const c of categories) {
      urls.push(
        renderUrlEntry({
          loc: `${baseUrl}/products?category=${encodeURIComponent(c.slug)}`,
          lastmod: nowIso,
          changefreq: "weekly",
          priority: "0.75",
        })
      );
    }

    for (const b of brands) {
      const img = b.thumbnailUrl || b.logoUrl;
      urls.push(
        renderUrlEntry({
          loc: `${baseUrl}/brands/${b.slug}`,
          lastmod: nowIso,
          changefreq: "weekly",
          priority: "0.8",
          image: img ? buildAbsoluteUrl(baseUrl, img) : null,
        })
      );
    }

    return wrapUrlset(urls);
  }

  const prodMatch = id.match(/^products-(\d+)\.xml$/);
  if (prodMatch) {
    const chunkIdx = Number(prodMatch[1]);
    if (!Number.isFinite(chunkIdx) || chunkIdx < 0) {
      return new NextResponse("Not Found", { status: 404 });
    }
    const items = await getSitemapProductBatch(
      PRODUCTS_PER_SITEMAP,
      chunkIdx * PRODUCTS_PER_SITEMAP
    );
    if (items.length === 0 && chunkIdx > 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const urls = items.map((row) => {
      const img = row.primaryImageUrl || row.divisionHeroUrl;
      const safeDate = row.updatedAt ? new Date(row.updatedAt) : new Date();
      return renderUrlEntry({
        loc: `${baseUrl}/products/${row.slug}`,
        lastmod: Number.isNaN(safeDate.getTime()) ? nowIso : safeDate.toISOString(),
        changefreq: "weekly",
        priority: "0.8",
        image: img ? buildAbsoluteUrl(baseUrl, img) : null,
      });
    });

    return wrapUrlset(urls);
  }

  return new NextResponse("Not Found", { status: 404 });
}
