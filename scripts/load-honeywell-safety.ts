import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";

const SITEMAP_URL = "https://www.honeywellstore.com/sitemap.xml";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchText(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch {
      if (attempt === retries) return null;
      await new Promise((res) => setTimeout(res, 300 * attempt));
    }
  }
  return null;
}

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "honeywell-safety"));
  if (!brandRow) throw new Error("Brand 'honeywell-safety' not found in DB.");

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };
  const targetCat = catBySlug["safety-ppe"] || Object.values(catBySlug)[0];

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const smXml = await fetchText(SITEMAP_URL);
  if (!smXml) throw new Error("Failed to fetch honeywellstore sitemap.");

  const urls = [...smXml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => m[1].trim())
    .filter(
      (u) =>
        /\/store\/products\//i.test(u) &&
        /safety|mask|respirator|glove|goggle|eyewear|hearing|ear|boot|shoe|helmet|harness|detector|alarm|ppe|protection|first-aid|eyewash|vest|apron/i.test(
          u
        )
    );

  console.log(`[Honeywell Safety] Found ${urls.length} safety & PPE product URLs. Fetching...`);

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 12;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(
      batch.map(async (url) => ({ url, html: await fetchText(url) }))
    );

    for (const { url, html } of pages) {
      if (!html) continue;

      const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], true);
      const titleTag = htmlToCleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], true);
      const name = h1 || titleTag;
      if (!name || name.length < 4) continue;

      const ogImg =
        html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
        null;
      const imageUrl = ogImg && ogImg.startsWith("http") ? ogImg.trim() : null;

      const metaDesc = htmlToCleanText(
        html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1],
        false
      );

      // Extract model code from image filename or URL end
      const rawCode =
        ogImg?.match(/\/([^/]+)\.(?:jpg|jpeg|png|webp)/i)?.[1] ||
        url.match(/\/([^/]+)\.htm$/i)?.[1]?.split("-").slice(-2).join("-") ||
        toSlug(name).slice(0, 24);
      const normCode = rawCode.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const dbSku = `HNY-${normCode}`.slice(0, 56);
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`honeywell-${normCode}-${name.slice(0, 30)}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const shortDesc = `${name} — Honeywell Safety & PPE gear. Confirm size/certification & MOQ on order.`.slice(
        0,
        220
      );
      const fullDesc = [
        metaDesc || `${name} — industrial safety & personal protective equipment by Honeywell.`,
        "",
        "Before Ordering: Confirm applicable ANSI/EN/IS safety certification, size, and pack quantity with our desk.",
      ].join("\n");

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name,
        shortDescription: shortDesc,
        description: fullDesc,
        divisionId: targetCat.divisionId,
        categoryId: targetCat.id,
        brandId: brandRow.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: /mask|respirator/i.test(name) ? "6307" : /glove/i.test(name) ? "4015" : "9004",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "Honeywell Safety" },
          { label: "Model / Code", value: normCode },
          { label: "Segment", value: "Industrial PPE & Safety" },
        ]),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "honeywell-safety",
        discoveredUrls: urls.length,
        inserted: toInsert.length,
        withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-honeywell-safety] Error:", err);
    process.exit(1);
  });
