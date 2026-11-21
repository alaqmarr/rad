import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const SITEMAP_URL = "https://www.bostik.com/india/en/sitemap.xml";
const BASE_HOST = "https://www.bostik.com";

function decodeEntities(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&deg;/gi, "°")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanText(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureBostikBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "bostik"));
  if (existing) return existing.id;

  await db
    .insert(brands)
    .values({
      slug: "bostik",
      name: "Bostik",
      logoUrl: "/logos/brands/bostik.svg",
      websiteUrl: "https://www.bostik.com/india/en",
      countryOfOrigin: "France / India",
      isFeatured: true,
      sortOrder: 50,
      sourcingType: "independent",
      sourcingNote:
        "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      description:
        "Industrial adhesives, hot-melt assembly glues, structural sealants, and industrial bonding systems.",
      seoTitle: "Bostik Wholesale Supply | Radiant Industrial Co.",
      seoDescription: "Source genuine Bostik industrial adhesives in India through Radiant Industrial Co.",
      isActive: true,
    })
    .onConflictDoNothing({ target: brands.slug });

  const [created] = await db.select().from(brands).where(eq(brands.slug, "bostik"));
  if (!created) throw new Error("Failed to ensure bostik brand.");
  return created.id;
}

async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 1; i <= retries; i++) {
    try {
      const r = await fetch(url.replace(/\s+/g, ""), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch {
      if (i === retries) return null;
      await new Promise((res) => setTimeout(res, 350 * i));
    }
  }
  return null;
}

function resolveImg(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (
    !s ||
    s.includes("Bostik_Logo") ||
    s.includes("logo-bostik-default") ||
    s.includes("icon") ||
    s.includes("flag")
  ) {
    return null;
  }
  if (s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${BASE_HOST}${s}`;
  return null;
}

async function main() {
  const brandId = await ensureBostikBrand();
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "lubricants-adhesives-abrasives"));
  const fallbackCats = await db.select().from(categories);
  const targetCat = cat || fallbackCats[0];

  const xml = await fetchWithRetry(SITEMAP_URL);
  if (!xml) throw new Error("Failed to fetch Bostik India sitemap");

  const urls = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim().replace(/\s+/g, ""))
        .filter((u) => u.includes("/catalog/product/"))
    ),
  ];
  console.log(`[Bostik] Discovered ${urls.length} product pages in India sitemap.`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 12;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchWithRetry(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1 = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
      if (!h1) continue;

      const ogImg = resolveImg(
        html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1]
      );
      const firstBodyImg = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => resolveImg(m[1]))
        .find(Boolean);
      const imageUrl = ogImg || firstBodyImg || null;

      const mainIdx = html.indexOf("<main") !== -1 ? html.indexOf("<main") : html.indexOf("<h1");
      const mainSlice = html.slice(Math.max(0, mainIdx), mainIdx + 25000);
      const lines = mainSlice
        .replace(/<script[\s\S]*?<\/script>/gi, "\n")
        .replace(/<style[\s\S]*?<\/style>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .split("\n")
        .map((l) => cleanText(l))
        .filter((l) => l.length > 2 && !/^(Product|Contact our experts|Read more|Read less|Share|Discover)$/i.test(l));

      const descIdx = lines.findIndex((l) => /^DESCRIPTION$/i.test(l));
      const subtitle = lines[1] && lines[1].length < 90 ? lines[1] : "";
      const bodyDesc =
        descIdx !== -1
          ? lines.slice(descIdx + 1, descIdx + 6).filter((l) => !/^METHOD OF APPLICATION$/i.test(l)).join(" ")
          : lines.slice(1, 5).join(" ");

      const segs = new URL(url).pathname.split("/").filter(Boolean);
      const slugPart = segs[segs.length - 1] || toSlug(h1);
      const marketSlug = segs[segs.indexOf("product") + 1] || "industrial-bonding";
      const marketName = marketSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      const sku = `BSTK-${h1.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32)}`;
      if (existingSkus.has(sku)) continue;
      existingSkus.add(sku);

      let safeSlug = toSlug(`bostik-${slugPart}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const title = subtitle && !h1.includes(subtitle) && subtitle.length < 70 ? `Bostik ${h1} — ${subtitle}` : `Bostik ${h1}`;
      const shortDesc = `${title} (${marketName}). Confirm substrate compatibility, cure schedule, and pack size before ordering.`.slice(0, 220);
      const fullDesc = [
        bodyDesc || `${title} industrial adhesive / sealant solution from Bostik.`,
        "",
        "Before Ordering: Please verify exact grade, viscosity/open time, substrate compatibility, and pack size with our team before confirming your order.",
      ].join("\n");

      const specs = [
        { label: "Brand", value: "Bostik" },
        { label: "Product Code", value: h1 },
        { label: "Application Segment", value: marketName },
      ];
      if (subtitle) specs.push({ label: "Product Type", value: subtitle });

      toInsert.push({
        slug: safeSlug,
        sku,
        name: title.slice(0, 180),
        shortDescription: shortDesc,
        description: fullDesc,
        divisionId: targetCat.divisionId,
        categoryId: targetCat.id,
        brandId,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "3–7 Working Days",
        hsnCode: "3506",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${title} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "bostik",
        discoveredUrls: urls.length,
        inserted: toInsert.length,
        withImages: toInsert.filter((p) => Boolean(p.primaryImageUrl)).length,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-bostik] Error:", err);
    process.exit(1);
  });
