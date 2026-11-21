import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const UDYOGI_ORIGIN = "https://udyogisafety.com";

function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&deg;/gi, "°")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#x26;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"*®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapUdyogiCategorySlug(categoryPath: string, name: string): string {
  const hay = `${categoryPath} ${name}`.toLowerCase();
  if (hay.includes("gas detector") || hay.includes("breathalyzer") || hay.includes("calibration")) {
    return "precision-instruments";
  }
  if (hay.includes("welding")) {
    return "welding-fabrication";
  }
  return "safety-ppe";
}

function extractSpecsFromHtml(html: string): Array<{ label: string; value: string }> {
  const specs: Array<{ label: string; value: string }> = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    );
    if (cells.length === 2 && cells[0] && cells[1] && cells[0].length <= 60 && cells[1].length <= 180) {
      if (/^(attribute|parameter|specification|feature)$/i.test(cells[0])) continue;
      specs.push({ label: cells[0].replace(/:$/, ""), value: cells[1] });
    } else if (cells.length >= 3 && cells[0] && !/^(gas|model|size|sr\.?\s*no)/i.test(cells[0])) {
      specs.push({
        label: cells[0].replace(/:$/, ""),
        value: cells.slice(1).filter(Boolean).join(" | ").slice(0, 180),
      });
    }
  }
  return specs.slice(0, 16);
}

interface ParsedUdyogiProduct {
  urlSlug: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  specs: Array<{ label: string; value: string }>;
}

async function fetchUdyogiProductPage(url: string, retries = 3): Promise<ParsedUdyogiProduct | null> {
  const urlSlug = new URL(url).pathname.replace(/^\/products\//, "").replace(/\/$/, "");
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      const html = await res.text();

      const jsonLdMatches = [
        ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
      ].map((m) => m[1]);

      let prodJson: any = null;
      for (const rawJson of jsonLdMatches) {
        if (rawJson.includes('"@type":"Product"') || rawJson.includes('"@type": "Product"')) {
          try {
            prodJson = JSON.parse(rawJson);
            break;
          } catch {
            // ignore malformed ld+json block
          }
        }
      }

      if (!prodJson || !prodJson.name) return null;

      const rawName = decodeEntities(String(prodJson.name).trim());
      const rawSku = prodJson.sku
        ? decodeEntities(String(prodJson.sku).trim())
        : urlSlug.toUpperCase();
      const rawDesc = decodeEntities(String(prodJson.description || "").trim());
      const rawCat = decodeEntities(String(prodJson.category || "Industrial Safety PPE").trim());

      const rawImgs: string[] = Array.isArray(prodJson.image)
        ? prodJson.image
        : typeof prodJson.image === "string"
          ? [prodJson.image]
          : [];

      const validImgs = [
        ...new Set(
          rawImgs
            .map((u) => String(u || "").trim())
            .filter(
              (u) =>
                u.startsWith("https://") &&
                !u.includes("main-logo") &&
                !u.includes("og-image") &&
                !u.includes("coming-soon")
            )
        ),
      ];

      const specs = extractSpecsFromHtml(html);

      return {
        urlSlug,
        sku: rawSku,
        name: rawName,
        description: rawDesc,
        category: rawCat,
        images: validImgs,
        specs,
      };
    } catch {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  return null;
}

async function ensureUdyogiBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "udyogi"));
  if (existing) {
    if (!existing.isFeatured) {
      await db.update(brands).set({ isFeatured: true }).where(eq(brands.id, existing.id));
    }
    return existing.id;
  }

  await db
    .insert(brands)
    .values({
      slug: "udyogi",
      name: "Udyogi",
      countryOfOrigin: "India",
      sourcingType: "independent",
      sourcingNote:
        "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      description:
        "Certified industrial safety eyewear, helmets, respiratory masks, gloves, safety footwear, gas detectors, and fall protection PPE.",
      websiteUrl: "https://udyogisafety.com",
      isFeatured: true,
      sortOrder: 6,
      seoTitle: "Udyogi Safety PPE Wholesale Supply | Radiant Industrial Co.",
      seoDescription: "Source genuine Udyogi PPE and safety equipment in India through Radiant Industrial Co.",
      isActive: true,
    })
    .onConflictDoNothing({ target: brands.slug });

  const [created] = await db.select().from(brands).where(eq(brands.slug, "udyogi"));
  if (!created) throw new Error("Failed to find or create 'udyogi' brand.");
  return created.id;
}

async function main() {
  console.log("Fetching Udyogi Safety PPE catalog from udyogisafety.com (non-destructive upsert)...");

  const smRes = await fetch(`${UDYOGI_ORIGIN}/sitemap.xml`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
  });
  if (!smRes.ok) throw new Error(`Failed to fetch udyogisafety sitemap: HTTP ${smRes.status}`);
  const smXml = await smRes.text();
  const productUrls = [
    ...new Set(
      [...smXml.matchAll(/<loc>(.*?)<\/loc>/g)]
        .map((m) => m[1])
        .filter((u) => u.startsWith(`${UDYOGI_ORIGIN}/products/`))
    ),
  ];

  console.log(`Found ${productUrls.length} product URLs in Udyogi sitemap. Fetching pages...`);

  const parsedItems: ParsedUdyogiProduct[] = [];
  const CONCURRENCY = 12;
  for (let i = 0; i < productUrls.length; i += CONCURRENCY) {
    const chunk = productUrls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((u) => fetchUdyogiProductPage(u)));
    for (const r of results) {
      if (r) parsedItems.push(r);
    }
  }

  console.log(`Parsed ${parsedItems.length} Udyogi Safety product pages.`);

  const brandId = await ensureUdyogiBrand();
  const allCategories = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCategories) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const safetyCat = catBySlug["safety-ppe"];
  if (!safetyCat) throw new Error("Missing 'safety-ppe' category in DB.");

  const existingRows = await db
    .select({ id: products.id, sku: products.sku, slug: products.slug })
    .from(products);
  const existingBySku = new Map(existingRows.map((r) => [r.sku, r]));
  const takenSlugs = new Set(existingRows.map((r) => r.slug));
  const seenDbSkus = new Set<string>();

  const toInsert: Array<typeof products.$inferInsert> = [];
  let updatedCount = 0;
  let withImagesCount = 0;

  for (const item of parsedItems) {
    let dbSku = `UDY-${item.sku.toUpperCase()}`;
    if (seenDbSkus.has(dbSku)) {
      dbSku = `UDY-${item.urlSlug.toUpperCase()}`;
    }
    if (seenDbSkus.has(dbSku)) continue;
    seenDbSkus.add(dbSku);

    const displayName = item.name.toLowerCase().startsWith("udyogi")
      ? item.name
      : `Udyogi ${item.name}`;

    const targetSlug = mapUdyogiCategorySlug(item.category, item.name);
    const targetCat = catBySlug[targetSlug] || safetyCat;

    const cleanShort = (
      item.description ||
      `${displayName} (${item.category}). Certified industrial PPE supplied by Radiant Industrial Co.`
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const fullDesc = [
      item.description || `${displayName} (${item.category}).`,
      "",
      "Before Ordering: Please confirm exact EN/IS/ANSI standard compliance, size/capacity variant, and pack quantity before placing your order.",
    ].join("\n");

    const specRows = [
      { label: "Brand", value: "Udyogi" },
      { label: "Model / SKU", value: item.sku },
      { label: "Category", value: item.category },
      ...item.specs,
    ];

    const primaryImageUrl = item.images[0] || null;
    const galleryJson = JSON.stringify(item.images.slice(1));
    if (primaryImageUrl) withImagesCount++;

    const match = existingBySku.get(dbSku);
    if (match) {
      await db
        .update(products)
        .set({
          name: displayName,
          shortDescription: cleanShort,
          description: fullDesc,
          divisionId: targetCat.divisionId,
          categoryId: targetCat.id,
          brandId,
          pricingMode: "rfq_only",
          basePrice: null,
          priceUnit: "NOS",
          gstPercent: 18,
          moq: "1 NOS",
          leadTime: "Confirmed Upon Order",
          hsnCode: "",
          specificationsJson: JSON.stringify(specRows),
          primaryImageUrl,
          galleryJson,
          inStockStatus: "Available to Order",
          isActive: true,
          seoTitle: `${displayName} (${item.sku}) | Radiant Industrial Co.`,
          seoDescription: cleanShort,
        })
        .where(eq(products.id, match.id));
      updatedCount++;
      continue;
    }

    let baseSlug = toSlug(`udyogi-${item.urlSlug || item.sku}`);
    if (!baseSlug) baseSlug = toSlug(`udyogi-${dbSku}`);
    let safeSlug = baseSlug;
    if (takenSlugs.has(safeSlug)) {
      let suffix = 2;
      while (takenSlugs.has(`${baseSlug}-${suffix}`)) suffix++;
      safeSlug = `${baseSlug}-${suffix}`;
    }
    takenSlugs.add(safeSlug);

    toInsert.push({
      slug: safeSlug,
      sku: dbSku,
      name: displayName,
      shortDescription: cleanShort,
      description: fullDesc,
      divisionId: targetCat.divisionId,
      categoryId: targetCat.id,
      brandId,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: "1 NOS",
      leadTime: "Confirmed Upon Order",
      hsnCode: "",
      specificationsJson: JSON.stringify(specRows),
      primaryImageUrl,
      galleryJson,
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${displayName} (${item.sku}) | Radiant Industrial Co.`,
      seoDescription: cleanShort,
    });
  }

  const CHUNK = 50;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    await db.insert(products).values(chunk);
    insertedCount += chunk.length;
  }

  const totalAfter = await db.select({ id: products.id }).from(products);
  console.log(
    JSON.stringify(
      {
        status: "ok",
        brandId,
        existingProductsBefore: existingRows.length,
        fetchedUniqueUdyogiProducts: seenDbSkus.size,
        withImageUrls: withImagesCount,
        insertedUdyogiProducts: insertedCount,
        updatedUdyogiProducts: updatedCount,
        totalProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Udyogi Safety catalog:", err);
  process.exit(1);
});
