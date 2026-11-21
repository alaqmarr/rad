import { eq } from "drizzle-orm";
import { brands, categories, db, divisions, products } from "../src/db";

interface RawDmcItem {
  sku: string;
  name: string;
  urlKey: string;
  shortDesc: string;
  description: string;
  imageUrl: string | null;
  categoryPaths: string[];
  categoryNames: string[];
}

const SKIP_EXACT_SLUGS = new Set([
  "products",
  "resources",
  "tool-selection-search",
  "about",
  "contact",
  "privacy-policy-cookie-restriction-mode",
  "service-unavailable",
  "private-sales",
  "reward-points",
  "access-denied-page",
  "test-page",
  "custom-form-test-page",
  "warranty-and-returns",
  "terms-conditions",
  "test-qa-page",
  "payment-terms",
  "history",
  "patents",
  "power-tool-equivalents",
  "safe-t-cable-resources",
  "wire-to-tool-cross-reference",
  "lacelok-resources",
  "lacelok-standards-and-classifications",
  "tensile-testing-cross-reference",
  "custom-tool-kit-request-form",
  "website-technical-issues-form",
  "wesupply-store-locator",
  "wesupply-store-details",
  "amc",
  "emc3300ad",
  "torqueconversions",
  "conversionadaptertoolsad",
  "toolingguiderequest",
  "dmc-europe-team",
  "techexchange",
  "lead-scanner",
]);

function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&deg;/gi, "°")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function normalizeImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const decoded = decodeEntities(rawUrl).replace(/\\\//g, "/").trim();
  if (!decoded || decoded.includes("/placeholder/")) return null;
  // Strip Adobe Commerce resize/canvas parameters for crisp original full-res catalog image
  const cleanBase = decoded.split("?")[0];
  if (!cleanBase.startsWith("https://dmctools.com/media/catalog/product/")) return null;
  return cleanBase;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"*®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchJsonWithRetry(url: string, body: unknown, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function fetchHtmlProduct(urlKey: string): Promise<RawDmcItem | null> {
  const url = `https://dmctools.com/${encodeURIComponent(urlKey)}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
      });
      if (!res.ok) return null;
      const html = await res.text();
      if (!html.includes("catalog-product-view")) return null;

      const h1 = html
        .match(/<h1[^>]*class="page-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .trim();
      const titleTag = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      const rawName = decodeEntities((h1 || titleTag || urlKey).replace(/\s+/g, " ").trim());

      const skuMatch =
        html.match(/"sku"\s*:\s*"([^"]+)"/)?.[1] ||
        html.match(/itemprop="sku"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
        urlKey.toUpperCase();

      const ogDesc = decodeEntities(
        html.match(/name="description"\s+content="([^"]*)"/i)?.[1] || ""
      ).trim();
      const descBlock = html.match(
        /class="product attribute description"[\s\S]*?<div class="value"[^>]*>([\s\S]*?)<\/div>/i
      )?.[1];
      const fullText = htmlToPlainText(descBlock) || ogDesc;

      const fullGalleryImg = html.match(
        /"full"\s*:\s*"(https:[^"]+dmctools\.com\/media\/catalog\/product\/[^"]+)"/i
      )?.[1];
      const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1];
      const imageUrl = normalizeImageUrl(fullGalleryImg || ogImg);

      const catNames: string[] = [];
      const catPaths: string[] = [];
      const breadcrumbBlock = html.match(/<div[^>]*class="breadcrumbs"[\s\S]*?<\/div>/i)?.[0] || "";
      if (breadcrumbBlock.includes("/products/merch-store")) {
        catPaths.push("products/merch-store");
      }
      for (const m of breadcrumbBlock.matchAll(/<a[^>]+href="https:\/\/dmctools\.com\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const pathPart = m[1];
        const label = decodeEntities(m[2].replace(/<[^>]+>/g, "").trim());
        if (pathPart.startsWith("products/") && label && label !== "Products") {
          catPaths.push(pathPart);
          catNames.push(label);
        }
      }

      return {
        sku: skuMatch.trim(),
        name: rawName,
        urlKey,
        shortDesc: ogDesc || fullText.slice(0, 180),
        description: fullText,
        imageUrl,
        categoryPaths: catPaths,
        categoryNames: catNames,
      };
    } catch {
      if (attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return null;
}

async function ensureDmcBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "dmc-tools"));
  const brandData = {
    slug: "dmc-tools",
    name: "DMC Tools",
    countryOfOrigin: "USA",
    sourcingType: "independent",
    sourcingNote:
      "We are not an official authorized dealer yet; we source genuine items directly against your order.",
    description:
      "Daniels Manufacturing Corporation (DMC) aerospace, defense & industrial wiring harness crimping tools, turret heads, positioners, insertion/removal tools, Safe-T-Cable, LaceLok, gages, and EWIS tool kits.",
    websiteUrl: "https://dmctools.com",
    isFeatured: true,
    sortOrder: 33,
    seoTitle: "DMC Tools (Daniels Manufacturing) Wholesale Supply | Radiant Industrial Co.",
    seoDescription:
      "Source genuine DMC Tools aerospace crimpers, positioners, turret heads, I/R tools, Safe-T-Cable, and connector tooling in India through Radiant Industrial Co.",
    isActive: true,
  };

  if (existing) {
    await db.update(brands).set(brandData).where(eq(brands.id, existing.id));
    return existing.id;
  }

  await db.insert(brands).values(brandData).onConflictDoNothing({ target: brands.slug });
  const [created] = await db.select().from(brands).where(eq(brands.slug, "dmc-tools"));
  if (!created) {
    throw new Error("Failed to create or retrieve 'dmc-tools' brand.");
  }
  return created.id;
}

function isPrecisionInstrument(item: RawDmcItem): boolean {
  const paths = item.categoryPaths.join(" ").toLowerCase();
  const title = item.name.toLowerCase();
  return (
    paths.includes("gaging-verification") ||
    paths.includes("tensile-testing") ||
    paths.includes("contact-retention") ||
    paths.includes("/gages") ||
    title.includes("go/no-go") ||
    title.includes("go no-go") ||
    title.includes("pull tester") ||
    title.includes("tensile tester") ||
    title.includes("retention tester")
  );
}

function isMerchOnly(item: RawDmcItem): boolean {
  if (item.categoryPaths.length === 0) return false;
  const hasMerch = item.categoryPaths.some((p) => p.startsWith("products/merch-store"));
  const hasToolCat = item.categoryPaths.some(
    (p) => p.startsWith("products/") && p !== "products" && !p.startsWith("products/merch-store")
  );
  return hasMerch && !hasToolCat;
}

async function main() {
  console.log("Fetching DMC Tools catalog from dmctools.com (non-destructive upsert)...");

  const smRes = await fetch("https://dmctools.com/sitemap.xml", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
  });
  if (!smRes.ok) {
    throw new Error(`Failed to fetch sitemap.xml: HTTP ${smRes.status}`);
  }
  const xml = await smRes.text();
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const candidates = [
    ...new Set(
      locs
        .map((u) => u.replace(/^https:\/\/dmctools\.com\//, ""))
        .filter((p) => p && !p.includes("/") && !SKIP_EXACT_SLUGS.has(p))
    ),
  ];

  console.log(`Found ${candidates.length} candidate URL keys in sitemap.xml. Querying GraphQL...`);

  const gqlQuery = `query($keys: [String!]) {
    products(filter: { url_key: { in: $keys } }, pageSize: 100) {
      items {
        sku
        name
        url_key
        image { url label }
        categories { name url_path }
        short_description { html }
        description { html }
      }
    }
  }`;

  const collected: RawDmcItem[] = [];
  const matchedUrlKeys = new Set<string>();
  const BATCH = 100;
  const CONCURRENCY = 6;

  for (let i = 0; i < candidates.length; i += BATCH * CONCURRENCY) {
    const jobs: Array<Promise<any[]>> = [];
    for (let c = 0; c < CONCURRENCY; c++) {
      const start = i + c * BATCH;
      if (start >= candidates.length) break;
      const keys = candidates.slice(start, start + BATCH);
      jobs.push(
        fetchJsonWithRetry("https://dmctools.com/graphql", {
          query: gqlQuery,
          variables: { keys },
        }).then((d) => d?.data?.products?.items || [])
      );
    }
    const batches = await Promise.all(jobs);
    for (const items of batches) {
      for (const it of items) {
        if (!it?.sku || !it?.name) continue;
        matchedUrlKeys.add(it.url_key);
        const catPaths = (it.categories || [])
          .map((c: any) => c.url_path || "")
          .filter(Boolean);
        const catNames = (it.categories || [])
          .map((c: any) => decodeEntities(c.name || ""))
          .filter((n: string) => n && n !== "Products" && !n.endsWith("All Products"));

        const shortPlain = htmlToPlainText(it.short_description?.html);
        const fullPlain = htmlToPlainText(it.description?.html);

        collected.push({
          sku: String(it.sku).trim(),
          name: decodeEntities(String(it.name).trim()),
          urlKey: String(it.url_key).trim(),
          shortDesc: shortPlain || fullPlain,
          description: fullPlain || shortPlain,
          imageUrl: normalizeImageUrl(it.image?.url),
          categoryPaths: catPaths,
          categoryNames: catNames,
        });
      }
    }
  }

  const remainingKeys = candidates.filter((k) => !matchedUrlKeys.has(k));
  console.log(
    `GraphQL fetched ${collected.length} products. Checking ${remainingKeys.length} remaining sitemap URLs via HTML fallback...`
  );

  const HTML_CONCURRENCY = 12;
  let htmlFoundCount = 0;
  for (let i = 0; i < remainingKeys.length; i += HTML_CONCURRENCY) {
    const chunk = remainingKeys.slice(i, i + HTML_CONCURRENCY);
    const results = await Promise.all(chunk.map((k) => fetchHtmlProduct(k)));
    for (const item of results) {
      if (item) {
        collected.push(item);
        htmlFoundCount++;
      }
    }
  }
  console.log(`HTML fallback recovered ${htmlFoundCount} additional products.`);

  // Deduplicate by normalized SKU and filter out Merch items
  const uniqueBySku = new Map<string, RawDmcItem>();
  for (const item of collected) {
    if (isMerchOnly(item)) continue;
    const key = item.sku.toUpperCase();
    if (!uniqueBySku.has(key)) {
      uniqueBySku.set(key, item);
    }
  }

  const finalItems = [...uniqueBySku.values()];
  console.log(`Prepared ${finalItems.length} unique industrial DMC Tools products for DB upsert.`);

  const brandId = await ensureDmcBrand();
  const allDivisions = await db.select().from(divisions);
  const allCategories = await db.select().from(categories);

  const divBySlug: Record<string, number> = {};
  for (const d of allDivisions) divBySlug[d.slug] = d.id;

  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCategories) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const toolsCat = catBySlug["tools-cutting-machining"];
  const precisionCat = catBySlug["precision-instruments"];
  if (!toolsCat || !precisionCat) {
    throw new Error("Missing 'tools-cutting-machining' or 'precision-instruments' category in DB.");
  }

  const existingRows = await db
    .select({ id: products.id, sku: products.sku, slug: products.slug })
    .from(products);
  const existingBySku = new Map(existingRows.map((r) => [r.sku, r]));
  const takenSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  let updatedCount = 0;
  let withImageCount = 0;

  for (const item of finalItems) {
    const dbSku = `DMC-${item.sku}`;
    const alreadyInName = item.name.toLowerCase().includes(item.sku.toLowerCase());
    const displayName = alreadyInName
      ? `DMC Tools ${item.name}`
      : `DMC Tools ${item.sku} — ${item.name}`;

    const isPrecision = isPrecisionInstrument(item);
    const targetCat = isPrecision ? precisionCat : toolsCat;

    const categorySummary =
      item.categoryNames.length > 0
        ? [...new Set(item.categoryNames)].slice(0, 3).join(" / ")
        : isPrecision
          ? "Gaging & Verification"
          : "Aerospace & Industrial Tooling";

    const cleanShort = (
      item.shortDesc ||
      `${displayName} (${categorySummary}). Genuine Daniels Manufacturing Corporation tooling.`
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const fullDesc = [
      item.description || `${displayName} — genuine DMC Tools aerospace and MRO connector tooling (${categorySummary}).`,
      "",
      "Before Ordering: Please confirm exact MIL-spec / connector contact compatibility, wire AWG range, turret/positioner pairing, and calibration certificate requirement before placing your order.",
    ].join("\n");

    const specificationsJson = JSON.stringify([
      { label: "Brand", value: "DMC Tools (Daniels Manufacturing)" },
      { label: "Part No. / SKU", value: item.sku },
      { label: "Category", value: categorySummary },
      { label: "Origin", value: "USA" },
    ]);

    if (item.imageUrl) withImageCount++;

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
          leadTime: "7–14 Working Days",
          hsnCode: "",
          specificationsJson,
          primaryImageUrl: item.imageUrl,
          inStockStatus: "Sourced on Order",
          isActive: true,
          seoTitle: `${displayName} (${item.sku}) | Radiant Industrial Co.`,
          seoDescription: cleanShort,
        })
        .where(eq(products.id, match.id));
      updatedCount++;
      continue;
    }

    let baseSlug = toSlug(`dmc-tools-${item.urlKey || item.sku}`);
    if (!baseSlug) baseSlug = toSlug(`dmc-tools-${dbSku}`);
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
      leadTime: "7–14 Working Days",
      hsnCode: "",
      specificationsJson,
      primaryImageUrl: item.imageUrl,
      inStockStatus: "Sourced on Order",
      isFeatured: ["AF8*", "AFM8*", "MH860*", "GMT232"].includes(item.sku.toUpperCase()),
      isActive: true,
      seoTitle: `${displayName} (${item.sku}) | Radiant Industrial Co.`,
      seoDescription: cleanShort,
    });
  }

  const DB_CHUNK = 50;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += DB_CHUNK) {
    const chunk = toInsert.slice(i, i + DB_CHUNK);
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
        fetchedUniqueDmcProducts: finalItems.length,
        withImageUrls: withImageCount,
        insertedDmcProducts: insertedCount,
        updatedDmcProducts: updatedCount,
        totalProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load DMC Tools catalog:", err);
  process.exit(1);
});
