import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const CAT_SITEMAP_URL = "https://polycab.com/category-sitemap.xml";
const BASE_HOST = "https://polycab.com";

function decodeEntities(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
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
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "polycab"));
  if (!brandRow) throw new Error("Brand 'polycab' not found in DB.");

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const catXml = await fetchWithRetry(CAT_SITEMAP_URL);
  if (!catXml) throw new Error("Failed to fetch Polycab category sitemap.");

  const catUrls = [
    ...new Set(
      [...catXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => !u.includes("/kitchen-appliances") && !u.includes("/home-appliances"))
    ),
  ];
  console.log(`[Polycab] Scanning ${catUrls.length} electrical/cable/lighting/switchgear categories...`);

  const prodUrls = new Set<string>();
  const CONCURRENCY = 12;

  for (let i = 0; i < catUrls.length; i += CONCURRENCY) {
    const chunk = catUrls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map((u) => fetchWithRetry(u)));
    for (const html of pages) {
      if (!html) continue;
      for (const m of html.matchAll(/href="([^"]*\/p-\d+[^"]*)"/gi)) {
        const href = m[1].trim();
        if (href.startsWith("/")) prodUrls.add(`${BASE_HOST}${href}`);
        else if (href.startsWith("https://polycab.com/")) prodUrls.add(href);
      }
    }
  }

  const urls = [...prodUrls];
  console.log(`[Polycab] Discovered ${urls.length} product pages across category pages.`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchWithRetry(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const rawTitle = cleanText(html.match(/<title>([^<]+)<\/title>/i)?.[1] || "");
      if (!rawTitle || /page not found/i.test(rawTitle)) continue;

      const metaDesc = cleanText(
        html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1] || ""
      );

      const imgs = [
        ...new Set(
          [...html.matchAll(/https:\/\/cms\.polycab\.com\/media\/[^"'\s<>]+\.(?:png|jpg|jpeg|webp)/gi)]
            .map((m) => m[0])
            .filter((u) => !/certification-icon|logo|favicon|banner|header/i.test(u))
        ),
      ];

      const pIdMatch = url.match(/\/p-(\d+)/);
      const pid = pIdMatch ? pIdMatch[1] : toSlug(rawTitle).slice(0, 16);
      const sku = `POLY-${pid}`;
      if (existingSkus.has(sku)) continue;
      existingSkus.add(sku);

      const lower = `${url} ${rawTitle}`.toLowerCase();
      const targetCat =
        (/fan|light|led|luminaire|batten|bulb/i.test(lower)
          ? catBySlug["facility-lighting-fans"]
          : catBySlug["electrical-pneumatic-mro"]) || Object.values(catBySlug)[0];

      const name = rawTitle.toLowerCase().includes("polycab") ? rawTitle : `Polycab ${rawTitle}`;
      let safeSlug = toSlug(`polycab-${pid}-${rawTitle}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const shortDesc = `${name}. Confirm core count, cross-section (sq.mm), voltage grade, armouring, and drum/coil length before ordering.`.slice(0, 220);
      const fullDesc = [
        metaDesc || `${name} — genuine Polycab industrial electrical product.`,
        "",
        "Before Ordering: Please verify exact conductor material (Cu/Al), core configuration, voltage grade, armouring/sheath specification, and standard drum/coil length with our team before confirming your order.",
      ].join("\n");

      const specs = [
        { label: "Brand", value: "Polycab" },
        { label: "Model / Product ID", value: pid },
      ];

      toInsert.push({
        slug: safeSlug,
        sku,
        name: name.slice(0, 180),
        shortDescription: shortDesc,
        description: fullDesc,
        divisionId: targetCat.divisionId,
        categoryId: targetCat.id,
        brandId: brandRow.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: /cable|wire/i.test(lower) ? "MTR" : "NOS",
        gstPercent: 18,
        moq: /cable|wire/i.test(lower) ? "100 MTR" : "1 NOS",
        leadTime: "3–7 Working Days",
        hsnCode: /cable|wire/i.test(lower) ? "8544" : "8536",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: imgs[0] || null,
        galleryJson: JSON.stringify(imgs.slice(1, 5)),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }

    if ((i / CONCURRENCY) % 10 === 0) {
      console.log(`[Polycab] Progress: ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length} -> ${toInsert.length} items`);
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "polycab",
        scannedCategories: catUrls.length,
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
    console.error("[load-polycab] Error:", err);
    process.exit(1);
  });
