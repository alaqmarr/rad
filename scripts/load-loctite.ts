import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const SITEMAP_URL = "https://next.henkel-adhesives.com/in/en.sitemap.products-sitemap.xml";

function decodeEntities(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
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

async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 1; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch {
      if (i === retries) return null;
      await new Promise((res) => setTimeout(res, 300 * i));
    }
  }
  return null;
}

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "loctite-henkel"));
  if (!brandRow) throw new Error("Brand 'loctite-henkel' not found in DB.");

  const [targetCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "lubricants-adhesives-abrasives"));
  if (!targetCat) throw new Error("Category 'lubricants-adhesives-abrasives' not found.");

  const xml = await fetchWithRetry(SITEMAP_URL);
  if (!xml) throw new Error("Failed to fetch Henkel India products sitemap.");

  const urls = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => /loctite/i.test(u) && !u.includes("/variation/"))
    ),
  ];
  console.log(`[Loctite] Discovered ${urls.length} base Loctite India product pages.`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 16;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchWithRetry(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1 = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
      const metaDesc = cleanText(
        html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1] || ""
      );
      if (!h1) continue;

      const imgs = [
        ...new Set(
          [...html.matchAll(/https:\/\/dm\.henkel-dam\.com\/is\/image\/henkel\/[^"'\s<>]+/gi)]
            .map((m) => decodeEntities(m[0]))
            .filter((u) => !/favicon|logo|icon|placeholder/i.test(u))
        ),
      ];
      // Prefer product/application shots with larger width
      const preferredImg = imgs.find((u) => /wid=(480|640|800|1024|1200)/i.test(u)) || imgs[0] || null;

      const segs = new URL(url).pathname.split("/").filter(Boolean);
      const idRaw = segs[segs.length - 1]?.replace(/\.html$/i, "") || toSlug(h1);
      const prodSlug = segs[segs.length - 2] || toSlug(h1);
      const sku = `LOC-${idRaw.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 34)}`;
      if (existingSkus.has(sku)) continue;
      existingSkus.add(sku);

      let safeSlug = toSlug(`loctite-${prodSlug}-${idRaw}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const categorySeg = segs.find((s) => s.startsWith("industrial-") || s === "equipment") || "industrial-adhesives";
      const categoryLabel = categorySeg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      const shortDesc = `${h1} (${categoryLabel}). Confirm bottle/cartridge pack size, cure strength, and substrate compatibility before ordering.`.slice(0, 220);
      const fullDesc = [
        metaDesc || `${h1} — genuine Henkel LOCTITE industrial engineering adhesive/sealant.`,
        "",
        "Before Ordering: Please verify exact LOCTITE grade, IDH pack volume (e.g. 50ml, 250ml, 300ml, 1L), viscosity/strength, and fixture cure time with our team before confirming your order.",
      ].join("\n");

      const specs = [
        { label: "Brand", value: "Loctite (Henkel)" },
        { label: "Grade / Model", value: h1 },
        { label: "Product Family", value: categoryLabel },
        { label: "Catalogue ID", value: idRaw },
      ];

      toInsert.push({
        slug: safeSlug,
        sku,
        name: h1.slice(0, 180),
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
        hsnCode: "3506",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: preferredImg,
        galleryJson: JSON.stringify(imgs.slice(1, 4)),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${h1} | Radiant Industrial Co.`,
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
        brand: "loctite-henkel",
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
    console.error("[load-loctite] Error:", err);
    process.exit(1);
  });
