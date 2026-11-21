import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const STANLEY_ORIGIN = "https://www.stanleytools.com";

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

function mapStanleyCategorySlug(breadcrumbs: string[], category: string, name: string): string {
  const tax = `${breadcrumbs.join(" ")} ${category}`.toLowerCase();
  const hay = `${tax} ${name}`.toLowerCase();
  if (
    tax.includes("storage") ||
    tax.includes("cabinet") ||
    tax.includes("chest") ||
    tax.includes("organizer") ||
    hay.includes("tool bag") ||
    hay.includes("tool box") ||
    hay.includes("toolbox") ||
    hay.includes("sawhorse")
  ) {
    return "storage-material-handling";
  }
  if (
    hay.includes("measuring") ||
    hay.includes("tape measure") ||
    hay.includes("long tape") ||
    hay.includes("level") ||
    hay.includes("square") ||
    hay.includes("plumb bob") ||
    hay.includes("chalk") ||
    hay.includes("laser") ||
    hay.includes("caliper")
  ) {
    return "precision-instruments";
  }
  if (hay.includes("lighting") || hay.includes("flashlight") || hay.includes("work light")) {
    return "facility-lighting-fans";
  }
  if (hay.includes("safety glasses") || hay.includes("work glove") || hay.includes("ppe")) {
    return "safety-ppe";
  }
  return "tools-cutting-machining";
}

interface ParsedStanleyProduct {
  urlSlug: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  breadcrumbs: string[];
  images: string[];
  specs: Array<{ label: string; value: string }>;
}

async function fetchStanleyProduct(url: string, retries = 3): Promise<ParsedStanleyProduct | null> {
  const urlPath = new URL(url).pathname.replace(/^\/en-us\/product\//, "").replace(/\/$/, "");
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

      let prodJson: any = null;
      let breadcrumbs: string[] = [];

      for (const m of html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
      )) {
        try {
          const parsed = JSON.parse(m[1]);
          if (parsed?.["@type"] === "Product") {
            prodJson = parsed;
          } else if (parsed?.["@type"] === "BreadcrumbList" && Array.isArray(parsed.itemListElement)) {
            breadcrumbs = parsed.itemListElement
              .map((el: any) => decodeEntities(String(el?.item?.name || el?.name || "").trim()))
              .filter((n: string) => n && n !== "Home");
          }
        } catch {
          // ignore invalid ld+json
        }
      }

      if (!prodJson || !prodJson.name) return null;

      const rawName = decodeEntities(String(prodJson.name).trim());
      const rawSku = prodJson.sku
        ? decodeEntities(String(prodJson.sku).trim())
        : urlPath.split("/")[0].toUpperCase();
      const rawDesc = decodeEntities(String(prodJson.description || "").trim());
      const rawCat = decodeEntities(
        String(prodJson.category || breadcrumbs[breadcrumbs.length - 2] || "Hand Tools").trim()
      );

      // Stanley serves high-res WebP assets (_1_1280.webp etc.); raw JSON-LD .jpg URLs can 404
      const webpMatches = [
        ...new Set(
          [
            ...html.matchAll(
              /https:\/\/assets\.stanleytools\.com\/[^"'\\<\s)]+?_(?:1280|1680)\.webp/gi
            ),
          ].map((m) => m[0])
        ),
      ];

      // Prioritize _1_1280 / _1_1680 primary shots before auxiliary angle shots (_2_, _A1_, etc.)
      const sortedWebps = [...webpMatches].sort((a, b) => {
        const aIsOne = /_1_(?:1280|1680)\.webp$/i.test(a) ? 0 : 1;
        const bIsOne = /_1_(?:1280|1680)\.webp$/i.test(b) ? 0 : 1;
        if (aIsOne !== bIsOne) return aIsOne - bIsOne;
        const aIs1280 = /_1280\.webp$/i.test(a) ? 0 : 1;
        const bIs1280 = /_1280\.webp$/i.test(b) ? 0 : 1;
        return aIs1280 - bIs1280;
      });

      // Deduplicate same shot index across 1280/1680 resolutions
      const seenShotPrefix = new Set<string>();
      const galleryImgs: string[] = [];
      for (const u of sortedWebps) {
        const prefix = u.replace(/_(?:1280|1680)\.webp$/i, "");
        if (!seenShotPrefix.has(prefix)) {
          seenShotPrefix.add(prefix);
          galleryImgs.push(u);
        }
      }

      // Extract additionalProperty specs + rendered accordion spec rows
      const specs: Array<{ label: string; value: string }> = [];
      const seenSpecLabels = new Set<string>();

      for (const m of html.matchAll(
        /<div class="prose-label-medium-sm[^"]*">([^<]+)<\/div>\s*<div class="prose-label-bold-sm[^"]*">([^<]+)<\/div>/gi
      )) {
        const label = decodeEntities(m[1]).trim();
        const value = decodeEntities(m[2]).trim();
        if (label && value && !seenSpecLabels.has(label.toLowerCase())) {
          seenSpecLabels.add(label.toLowerCase());
          specs.push({ label, value });
        }
      }

      if (Array.isArray(prodJson.additionalProperty)) {
        for (const prop of prodJson.additionalProperty) {
          const label = decodeEntities(String(prop?.name || "").trim());
          const value = decodeEntities(String(prop?.value || "").trim());
          if (label && value && !seenSpecLabels.has(label.toLowerCase())) {
            seenSpecLabels.add(label.toLowerCase());
            specs.push({ label, value });
          }
        }
      }

      return {
        urlSlug: toSlug(urlPath),
        sku: rawSku,
        name: rawName,
        description: rawDesc,
        category: rawCat,
        breadcrumbs,
        images: galleryImgs.slice(0, 6),
        specs: specs.slice(0, 12),
      };
    } catch {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }
  return null;
}

async function ensureStanleyBrand(): Promise<number> {
  const [existing] = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "stanley-black-decker"));
  if (existing) {
    if (!existing.isFeatured) {
      await db
        .update(brands)
        .set({ isFeatured: true, websiteUrl: "https://www.stanleytools.com" })
        .where(eq(brands.id, existing.id));
    }
    return existing.id;
  }

  await db
    .insert(brands)
    .values({
      slug: "stanley-black-decker",
      name: "Stanley Tools",
      countryOfOrigin: "USA",
      sourcingType: "independent",
      sourcingNote:
        "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      description:
        "Mechanics hand tools, measuring tapes, utility knives, blades, sockets, ratchets, levels, snips, and workshop storage.",
      websiteUrl: "https://www.stanleytools.com",
      isFeatured: true,
      sortOrder: 30,
      seoTitle: "Stanley Tools Wholesale Supply | Radiant Industrial Co.",
      seoDescription:
        "Source genuine Stanley Tools hand tools, tape measures, knives, sockets, and tool storage in India through Radiant Industrial Co.",
      isActive: true,
    })
    .onConflictDoNothing({ target: brands.slug });

  const [created] = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "stanley-black-decker"));
  if (!created) throw new Error("Failed to find or create 'stanley-black-decker' brand.");
  return created.id;
}

async function main() {
  console.log("Fetching Stanley Tools catalog from stanleytools.com/en-us (non-destructive upsert)...");

  const urlSet = new Set<string>();

  const pSm = await fetch(`${STANLEY_ORIGIN}/en-us/product/sitemap.xml`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
  });
  if (pSm.ok) {
    const px = await pSm.text();
    for (const m of px.matchAll(/<loc>(.*?)<\/loc>/g)) {
      urlSet.add(m[1].replace(/\/$/, ""));
    }
  }

  // Also scan listing pages in case products aren't listed in product/sitemap.xml
  const lpSm = await fetch(`${STANLEY_ORIGIN}/en-us/listing_page/sitemap.xml`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
  });
  if (lpSm.ok) {
    const lx = await lpSm.text();
    const listingUrls = [...lx.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    await Promise.all(
      listingUrls.map(async (lu) => {
        try {
          const lh = await (await fetch(lu)).text();
          for (const m of lh.matchAll(/\/en-us\/product\/([a-z0-9-]+\/[a-z0-9-]+)/gi)) {
            urlSet.add(`${STANLEY_ORIGIN}/en-us/product/${m[1]}`);
          }
        } catch {
          // ignore failed listing page
        }
      })
    );
  }

  const productUrls = [...urlSet];
  console.log(`Discovered ${productUrls.length} unique Stanley Tools product URLs. Fetching pages...`);

  const parsedItems: ParsedStanleyProduct[] = [];
  const CONCURRENCY = 10;
  for (let i = 0; i < productUrls.length; i += CONCURRENCY) {
    const chunk = productUrls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((u) => fetchStanleyProduct(u)));
    for (const r of results) {
      if (r) parsedItems.push(r);
    }
  }

  console.log(`Parsed ${parsedItems.length} Stanley Tools products.`);

  const brandId = await ensureStanleyBrand();
  const allCategories = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCategories) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const defaultCat = catBySlug["tools-cutting-machining"];
  if (!defaultCat) throw new Error("Missing 'tools-cutting-machining' category in DB.");

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
    const dbSku = `STL-${item.sku.toUpperCase()}`;
    if (seenDbSkus.has(dbSku)) continue;
    seenDbSkus.add(dbSku);

    const displayName = item.name.toLowerCase().includes("stanley")
      ? `${item.name} (${item.sku})`
      : `Stanley ${item.sku} — ${item.name}`;

    const targetSlug = mapStanleyCategorySlug(item.breadcrumbs, item.category, item.name);
    const targetCat = catBySlug[targetSlug] || defaultCat;

    const cleanShort = (
      item.description ||
      `${displayName} (${item.category}). Genuine industrial hand & workshop tooling.`
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const fullDesc = [
      item.description || `${displayName} (${item.category}).`,
      "",
      "Before Ordering: Please confirm exact model number, SAE vs. metric sizing, pack quantity, and spare blade/accessory compatibility before placing your order.",
    ].join("\n");

    const specRows = [
      { label: "Brand", value: "Stanley Tools" },
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
          seoTitle: `${displayName} | Radiant Industrial Co.`,
          seoDescription: cleanShort,
        })
        .where(eq(products.id, match.id));
      updatedCount++;
      continue;
    }

    let baseSlug = toSlug(`stanley-${item.urlSlug || item.sku}`);
    if (!baseSlug) baseSlug = toSlug(`stanley-${dbSku}`);
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
      seoTitle: `${displayName} | Radiant Industrial Co.`,
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
        fetchedUniqueStanleyProducts: seenDbSkus.size,
        withImageUrls: withImagesCount,
        insertedStanleyProducts: insertedCount,
        updatedStanleyProducts: updatedCount,
        totalProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Stanley Tools catalog:", err);
  process.exit(1);
});
