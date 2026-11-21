import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const GAZELLE_ORIGIN = "https://www.gazelleindustrial.com";

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

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"*®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapGazelleCategorySlug(categoryPath: string | null | undefined): string {
  const p = (categoryPath || "").toLowerCase();
  if (p.startsWith("abrasives")) return "lubricants-adhesives-abrasives";
  if (
    p.startsWith("ladders-and-access") ||
    p.startsWith("material-handling-equipment") ||
    p.startsWith("tool-storage")
  ) {
    return "storage-material-handling";
  }
  if (
    p.startsWith("measuring-and-layout-tools") ||
    p.startsWith("testing-equipment") ||
    p.startsWith("surveying-equipment")
  ) {
    return "precision-instruments";
  }
  if (p.startsWith("electrical-tools")) return "electrical-pneumatic-mro";
  if (p.startsWith("safety-and-workwear")) return "safety-ppe";
  if (p.startsWith("cleaning-equipment")) return "janitorial-facility";
  return "tools-cutting-machining";
}

function extractImageUrls(images: any[] | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  for (const img of images) {
    const src =
      img?.localFile?.childImageSharp?.gatsbyImageData?.images?.fallback?.src ||
      img?.localFile?.publicURL;
    if (typeof src === "string" && src.trim()) {
      const full = src.startsWith("http")
        ? src.trim()
        : `${GAZELLE_ORIGIN}${src.startsWith("/") ? "" : "/"}${src.trim()}`;
      if (!out.includes(full)) out.push(full);
    }
  }
  return out;
}

async function fetchJsonWithRetry(url: string, retries = 3): Promise<any | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  return null;
}

async function ensureGazelleBrand(): Promise<number> {
  const [existing] = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "gazelle-industrial"));
  const brandData = {
    slug: "gazelle-industrial",
    name: "Gazelle Industrial",
    countryOfOrigin: "International",
    sourcingType: "independent",
    sourcingNote:
      "We are not an official authorized dealer yet; we source genuine items directly against your order.",
    description:
      "Gazelle Industrial high-performance power tools, hand tools, abrasives, ladders & access equipment, material handling gear, measuring/testing instruments, and workplace safety solutions.",
    websiteUrl: "https://www.gazelleindustrial.com",
    isFeatured: true,
    sortOrder: 34,
    seoTitle: "Gazelle Industrial Tools & Safety Supply | Radiant Industrial Co.",
    seoDescription:
      "Source Gazelle Industrial hand tools, power tools, abrasives, ladders, material handling, measuring instruments, and PPE in India through Radiant Industrial Co.",
    isActive: true,
  };

  if (existing) {
    await db.update(brands).set(brandData).where(eq(brands.id, existing.id));
    return existing.id;
  }

  await db
    .insert(brands)
    .values(brandData)
    .onConflictDoNothing({ target: brands.slug });
  const [created] = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "gazelle-industrial"));
  if (!created) {
    throw new Error("Failed to create or retrieve 'gazelle-industrial' brand.");
  }
  return created.id;
}

async function main() {
  console.log("Fetching Gazelle Industrial catalog from gazelleindustrial.com (non-destructive upsert)...");

  const smIndexRes = await fetch(`${GAZELLE_ORIGIN}/sitemap-index.xml`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
  });
  if (!smIndexRes.ok) {
    throw new Error(`Failed to fetch sitemap-index.xml: HTTP ${smIndexRes.status}`);
  }
  const indexXml = await smIndexRes.text();
  const childMaps = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  if (childMaps.length === 0) {
    childMaps.push(`${GAZELLE_ORIGIN}/sitemap-0.xml`);
  }

  const allUrls: string[] = [];
  for (const mapUrl of childMaps) {
    const smRes = await fetch(mapUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
    });
    if (!smRes.ok) continue;
    const smXml = await smRes.text();
    for (const m of smXml.matchAll(/<loc>(.*?)<\/loc>/g)) {
      allUrls.push(m[1]);
    }
  }

  // Products on gazelleindustrial.com live at single-segment paths (depth === 1)
  const candidatePaths = [
    ...new Set(
      allUrls
        .map((u) => new URL(u).pathname.replace(/\/$/, ""))
        .filter((p) => p && p.split("/").filter(Boolean).length === 1)
    ),
  ];

  console.log(`Found ${candidatePaths.length} depth-1 candidate URLs. Fetching Gatsby page-data...`);

  const productPayloads: any[] = [];
  const CONCURRENCY = 16;

  for (let i = 0; i < candidatePaths.length; i += CONCURRENCY) {
    const chunk = candidatePaths.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((pathPart) =>
        fetchJsonWithRetry(`${GAZELLE_ORIGIN}/page-data${pathPart}/page-data.json`)
      )
    );
    for (const pd of results) {
      if (
        pd?.componentChunkName === "component---src-templates-product-js" &&
        pd?.result?.data?.product?.model &&
        pd?.result?.data?.product?.searchTitle
      ) {
        productPayloads.push(pd.result.data.product);
      }
    }
  }

  console.log(`Fetched ${productPayloads.length} verified Gazelle Industrial product pages.`);

  const brandId = await ensureGazelleBrand();
  const allCategories = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCategories) {
    catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };
  }

  const existingRows = await db
    .select({ id: products.id, sku: products.sku, slug: products.slug })
    .from(products);
  const existingBySku = new Map(existingRows.map((r) => [r.sku, r]));
  const takenSlugs = new Set(existingRows.map((r) => r.slug));
  const seenModels = new Set<string>();

  const toInsert: Array<typeof products.$inferInsert> = [];
  let updatedCount = 0;
  let withImagesCount = 0;

  for (const item of productPayloads) {
    const rawModel = String(item.model).trim();
    const modelKey = rawModel.toUpperCase();
    if (seenModels.has(modelKey)) continue;
    seenModels.add(modelKey);

    const dbSku = `GZL-${modelKey}`;
    const rawTitle = decodeEntities(String(item.searchTitle).trim());
    const name = rawTitle.toUpperCase().includes(modelKey)
      ? `Gazelle Industrial ${rawTitle}`
      : `Gazelle Industrial ${rawModel} — ${rawTitle}`;

    const catSlug = mapGazelleCategorySlug(item.category?.path);
    const targetCat = catBySlug[catSlug] || catBySlug["tools-cutting-machining"];
    if (!targetCat) {
      throw new Error(`Missing target category '${catSlug}' or 'tools-cutting-machining' in DB.`);
    }

    const catLabel = item.category?.name
      ? decodeEntities(String(item.category.name).trim())
      : "Industrial Equipment";

    const rawPlainDesc = htmlToPlainText(item.description);
    const featuresPlain = htmlToPlainText(item.features?.childMarkdownRemark?.html);
    const keyFeaturesPlain = htmlToPlainText(item.keyFeatures?.childMarkdownRemark?.html);
    const appsPlain = htmlToPlainText(item.industryApplications?.childMarkdownRemark?.html);

    const specRows: Array<{ label: string; value: string }> = [
      { label: "Brand", value: "Gazelle Industrial" },
      { label: "Model / SKU", value: rawModel },
      { label: "Category", value: catLabel },
    ];

    const strapiSpecs = item.specifications?.strapi_json_value;
    if (Array.isArray(strapiSpecs)) {
      for (const s of strapiSpecs) {
        if (s?.attribute && s?.value != null && String(s.value).trim() !== "") {
          specRows.push({
            label: decodeEntities(String(s.attribute).trim()),
            value: decodeEntities(String(s.value).trim()),
          });
        }
      }
    }

    const shortSource =
      decodeEntities(item.metaDescription || "").trim() ||
      rawPlainDesc ||
      keyFeaturesPlain ||
      featuresPlain;
    const cleanShort = (
      shortSource ||
      `${name} (${catLabel}). Industrial-grade Gazelle® equipment supplied for workplace & jobsite operations.`
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const descSections: string[] = [];
    if (rawPlainDesc) descSections.push(rawPlainDesc);
    if (keyFeaturesPlain) descSections.push(`Key Specifications:\n${keyFeaturesPlain}`);
    if (featuresPlain) descSections.push(`Features:\n${featuresPlain}`);
    if (appsPlain) descSections.push(`Applications:\n${appsPlain}`);
    if (descSections.length === 0) {
      descSections.push(`${name} — industrial-grade Gazelle® equipment (${catLabel}).`);
    }
    descSections.push(
      "Before Ordering: Please confirm exact capacity, size/voltage rating, included accessories, and delivery schedule before placing your order."
    );
    const fullDescription = descSections.join("\n\n");

    const imgUrls = extractImageUrls(item.images);
    const primaryImageUrl = imgUrls[0] || null;
    const galleryJson = JSON.stringify(imgUrls.slice(1));
    if (primaryImageUrl) withImagesCount++;

    const match = existingBySku.get(dbSku);
    if (match) {
      await db
        .update(products)
        .set({
          name,
          shortDescription: cleanShort,
          description: fullDescription,
          divisionId: targetCat.divisionId,
          categoryId: targetCat.id,
          brandId,
          pricingMode: "rfq_only",
          basePrice: null,
          priceUnit: "NOS",
          gstPercent: 18,
          moq: "1 NOS",
          leadTime: "5–10 Working Days",
          hsnCode: "",
          specificationsJson: JSON.stringify(specRows),
          primaryImageUrl,
          galleryJson,
          inStockStatus: "Available to Order",
          isActive: true,
          seoTitle: `${name} (${rawModel}) | Radiant Industrial Co.`,
          seoDescription: cleanShort,
        })
        .where(eq(products.id, match.id));
      updatedCount++;
      continue;
    }

    let baseSlug = toSlug(`gazelle-${item.url || `${rawModel}-${item.slug || rawTitle}`}`);
    if (!baseSlug) baseSlug = toSlug(`gazelle-${rawModel}`);
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
      name,
      shortDescription: cleanShort,
      description: fullDescription,
      divisionId: targetCat.divisionId,
      categoryId: targetCat.id,
      brandId,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: "1 NOS",
      leadTime: "5–10 Working Days",
      hsnCode: "",
      specificationsJson: JSON.stringify(specRows),
      primaryImageUrl,
      galleryJson,
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${name} (${rawModel}) | Radiant Industrial Co.`,
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
        fetchedUniqueGazelleProducts: seenModels.size,
        withImageUrls: withImagesCount,
        insertedGazelleProducts: insertedCount,
        updatedGazelleProducts: updatedCount,
        totalProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Gazelle Industrial catalog:", err);
  process.exit(1);
});
