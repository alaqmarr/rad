import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const SITEMAP_URL = "https://www.festo.com/in/en/sitemap-product.xml";

function decodeEntities(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
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
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "festo"));
  if (!brandRow) throw new Error("Brand 'festo' not found in DB.");

  const [targetCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "electrical-pneumatic-mro"));
  if (!targetCat) throw new Error("Category 'electrical-pneumatic-mro' not found.");

  const limitArg = Number(process.argv[2] || process.env.FESTO_LIMIT || 0);

  const xml = await fetchWithRetry(SITEMAP_URL);
  if (!xml) throw new Error("Failed to fetch Festo India product sitemap.");

  const allUrls = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => u.includes("/in/en/p/"))
    ),
  ];
  const urls = limitArg > 0 ? allUrls.slice(0, limitArg) : allUrls;
  console.log(`[Festo] Processing ${urls.length} (of ${allUrls.length}) official product families...`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 20;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchWithRetry(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;

      let ldProd: any = null;
      for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          const parsed = JSON.parse(m[1]);
          if (parsed?.["@type"] === "Product") {
            ldProd = parsed;
            break;
          }
        } catch {
          // ignore malformed script
        }
      }

      const rawName = decodeEntities(
        String(
          ldProd?.name ||
            html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ||
            ""
        ).trim()
      );
      if (!rawName) continue;

      const idMatch = url.match(/-id_([A-Za-z0-9_-]+)$/);
      const typeCode = (idMatch ? idMatch[1] : toSlug(rawName)).replace(/_/g, "-").toUpperCase();
      const sku = `FESTO-${typeCode.slice(0, 32)}`;
      if (existingSkus.has(sku)) continue;
      existingSkus.add(sku);

      const imgs = (Array.isArray(ldProd?.image) ? ldProd.image : ldProd?.image ? [ldProd.image] : [])
        .map((u: any) => String(u || "").trim())
        .filter((u: string) => u.startsWith("https://www.festo.com/media/"));

      if (imgs.length === 0) {
        const bodyImg = html.match(/https:\/\/www\.festo\.com\/media\/catalog\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/i)?.[0];
        if (bodyImg) imgs.push(bodyImg);
      }

      const plainDesc = decodeEntities(String(ldProd?.description || "").trim());
      const name = rawName.toLowerCase().includes("festo") ? rawName : `Festo ${rawName}`;
      const shortDesc = `${name} (${typeCode}). Confirm bore/stroke, port thread, operating pressure, and voltage before ordering.`.slice(0, 220);
      const fullDesc = [
        plainDesc || `${name} — genuine Festo industrial pneumatic & automation series.`,
        "",
        "Before Ordering: Please verify exact Festo part number, port size, stroke length, coil voltage, and mounting configuration with our team before confirming your order.",
      ].join("\n");

      let safeSlug = toSlug(`festo-${rawName}-${typeCode}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const specs = [
        { label: "Brand", value: "Festo" },
        { label: "Type Series Code", value: typeCode },
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
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "8481",
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

    if ((i / CONCURRENCY) % 25 === 0) {
      console.log(`[Festo] Progress: ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length} -> ${toInsert.length} items`);
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "festo",
        processedUrls: urls.length,
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
    console.error("[load-festo] Error:", err);
    process.exit(1);
  });
