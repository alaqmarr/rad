import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const KARAM_ORIGIN = "https://karamonline.com";

function decodeEntities(str: string): string {
  let out = str;
  // Run two passes for double-encoded Magento PageBuilder HTML (&lt;p&gt;)
  for (let pass = 0; pass < 2; pass++) {
    out = out
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&reg;/gi, "®")
      .replace(/&trade;/gi, "™")
      .replace(/&deg;/gi, "°")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&#x27;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return out;
}

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const decoded = decodeEntities(html);
  const stripped = decoded
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<a[^>]*class="[^"]*explore-more[^"]*"[^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<span[^>]*class="[^"]*(?:dots|read-more-btn)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/Explore More Products/gi, "")
    .replace(/\bRead More\b/gi, "")
    .replace(/\.\.\.\s*\n/g, ".\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractSpecsFromHtml(html: string | null | undefined): Array<{ label: string; value: string }> {
  if (!html) return [];
  const decoded = decodeEntities(html);
  const specs: Array<{ label: string; value: string }> = [];
  for (const m of decoded.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    );
    if (cells.length >= 2 && cells[0] && cells[1] && cells[0].length <= 60 && cells[1].length <= 160) {
      if (/^(specification|parameter|particular|feature)$/i.test(cells[0])) continue;
      specs.push({ label: cells[0].replace(/:$/, ""), value: cells[1] });
    }
  }
  return specs.slice(0, 12);
}

function normalizeImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const u = rawUrl.trim();
  if (!u || u.includes("/placeholder/")) return null;
  return u;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"*®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapKaramCategorySlug(catPaths: string[], catNames: string[], name: string): string {
  const hay = `${catPaths.join(" ")} ${catNames.join(" ")} ${name}`.toLowerCase();
  if (hay.includes("welding")) return "welding-fabrication";
  if (hay.includes("gas detector") || hay.includes("breathalyser")) return "precision-instruments";
  return "safety-ppe";
}

async function fetchGql(query: string, variables: Record<string, unknown> = {}, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${KARAM_ORIGIN}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)",
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

async function ensureKaramBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "karam"));
  if (existing) {
    if (!existing.isFeatured) {
      await db.update(brands).set({ isFeatured: true }).where(eq(brands.id, existing.id));
    }
    return existing.id;
  }

  await db
    .insert(brands)
    .values({
      slug: "karam",
      name: "Karam",
      countryOfOrigin: "India",
      sourcingType: "independent",
      sourcingNote:
        "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      description:
        "Full-body safety harnesses, helmets, welding shields, eyewear, hearing protection, safety shoes, gloves, LOTO, and fall arrest PPE.",
      websiteUrl: "https://karamonline.com",
      isFeatured: true,
      sortOrder: 10,
      seoTitle: "Karam Safety PPE Wholesale Supply | Radiant Industrial Co.",
      seoDescription: "Source genuine Karam safety gear & PPE in India through Radiant Industrial Co.",
      isActive: true,
    })
    .onConflictDoNothing({ target: brands.slug });

  const [created] = await db.select().from(brands).where(eq(brands.slug, "karam"));
  if (!created) throw new Error("Failed to find or create 'karam' brand.");
  return created.id;
}

async function main() {
  console.log("Fetching Karam Safety PPE catalog from karamonline.com (non-destructive upsert)...");

  const fields = `
    sku
    name
    url_key
    short_description { html }
    description { html }
    image { url }
    media_gallery { url }
    categories { name url_path }
    price_range {
      minimum_price {
        regular_price { value currency }
        final_price { value currency }
      }
    }
  `;

  const itemsBySku = new Map<string, any>();

  // 1. Paginate GraphQL catalog ASC & DESC to sweep past Magento's 500-result window
  for (const dir of ["ASC", "DESC"] as const) {
    const maxPages = dir === "ASC" ? 5 : 3;
    for (let page = 1; page <= maxPages; page++) {
      const q = `{
        products(filter: {}, sort: { name: ${dir} }, pageSize: 100, currentPage: ${page}) {
          total_count
          items { ${fields} }
        }
      }`;
      const res = await fetchGql(q);
      const list = res?.data?.products?.items || [];
      for (const it of list) {
        if (it?.sku && it?.name) itemsBySku.set(String(it.sku).trim().toUpperCase(), it);
      }
      if (list.length < 100) break;
    }
  }

  // 2. Also sweep product-sitemap.xml url_keys via GraphQL batches in case any visible item wasn't in sort windows
  const pxRes = await fetch(`${KARAM_ORIGIN}/product-sitemap.xml`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
  });
  if (pxRes.ok) {
    const pxXml = await pxRes.text();
    const keys = [
      ...new Set(
        [...pxXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
          new URL(m[1]).pathname.replace(/^\/|\/$/g, "")
        )
      ),
    ];
    const seenKeys = new Set([...itemsBySku.values()].map((i) => i.url_key));
    const missingKeys = keys.filter((k) => k && !seenKeys.has(k));
    const batchQuery = `query($keys: [String!]) {
      products(filter: { url_key: { in: $keys } }, pageSize: 100) {
        items { ${fields} }
      }
    }`;
    const BATCH = 100;
    const CONCURRENCY = 6;
    for (let i = 0; i < missingKeys.length; i += BATCH * CONCURRENCY) {
      const jobs: Array<Promise<any[]>> = [];
      for (let c = 0; c < CONCURRENCY; c++) {
        const slice = missingKeys.slice(i + c * BATCH, i + (c + 1) * BATCH);
        if (!slice.length) break;
        jobs.push(
          fetchGql(batchQuery, { keys: slice }).then((d) => d?.data?.products?.items || [])
        );
      }
      for (const arr of await Promise.all(jobs)) {
        for (const it of arr) {
          if (it?.sku && it?.name) itemsBySku.set(String(it.sku).trim().toUpperCase(), it);
        }
      }
    }
  }

  const finalItems = [...itemsBySku.values()];
  console.log(`Fetched ${finalItems.length} unique main Karam catalog products.`);

  const brandId = await ensureKaramBrand();
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

  const toInsert: Array<typeof products.$inferInsert> = [];
  let updatedCount = 0;
  let withImagesCount = 0;

  for (const item of finalItems) {
    const rawSku = String(item.sku).trim();
    const dbSku = `KRM-${rawSku.toUpperCase()}`;
    const rawName = decodeEntities(String(item.name).trim());
    const name = rawName.toLowerCase().startsWith("karam") ? rawName : `Karam ${rawName}`;

    const catPaths = (item.categories || []).map((c: any) => String(c.url_path || ""));
    const catNames = (item.categories || [])
      .map((c: any) => decodeEntities(String(c.name || "").trim()))
      .filter((n: string) => n && !/^(top selling|featured products|best seller)/i.test(n));

    const targetSlug = mapKaramCategorySlug(catPaths, catNames, rawName);
    const targetCat = catBySlug[targetSlug] || safetyCat;

    const categoryLabel =
      catNames.length > 0 ? [...new Set(catNames)].slice(0, 3).join(" / ") : "Industrial Safety PPE";

    const shortPlain = htmlToPlainText(item.short_description?.html);
    const fullPlain = htmlToPlainText(item.description?.html);
    const cleanShort = (
      shortPlain ||
      fullPlain ||
      `${name} (${categoryLabel}). Certified industrial PPE supplied by Radiant Industrial Co.`
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const descText = [
      fullPlain || shortPlain || `${name} (${categoryLabel}).`,
      "",
      "Before Ordering: Please confirm exact EN/IS/ANSI standard compliance, size/capacity variant, and pack quantity before placing your order.",
    ].join("\n");

    const parsedSpecs = extractSpecsFromHtml(item.description?.html);
    const specRows = [
      { label: "Brand", value: "Karam" },
      { label: "Model / SKU", value: rawSku },
      { label: "Category", value: categoryLabel },
      ...parsedSpecs,
    ];

    const gallerySet = new Set<string>();
    const mainImg = normalizeImageUrl(item.image?.url);
    if (mainImg) gallerySet.add(mainImg);
    for (const g of item.media_gallery || []) {
      const gu = normalizeImageUrl(g?.url);
      if (gu) gallerySet.add(gu);
    }
    const allImgs = [...gallerySet];
    const primaryImageUrl = allImgs[0] || null;
    const galleryJson = JSON.stringify(allImgs.slice(1));
    if (primaryImageUrl) withImagesCount++;

    const inrPrice =
      item.price_range?.minimum_price?.regular_price?.currency === "INR" &&
      Number(item.price_range?.minimum_price?.regular_price?.value) > 0
        ? Number(item.price_range.minimum_price.regular_price.value)
        : null;

    const match = existingBySku.get(dbSku);
    if (match) {
      await db
        .update(products)
        .set({
          name,
          shortDescription: cleanShort,
          description: descText,
          divisionId: targetCat.divisionId,
          categoryId: targetCat.id,
          brandId,
          pricingMode: "rfq_only",
          basePrice: inrPrice,
          priceUnit: "NOS",
          gstPercent: 18,
          moq: "1 NOS",
          leadTime: "3–7 Working Days",
          hsnCode: "",
          specificationsJson: JSON.stringify(specRows),
          primaryImageUrl,
          galleryJson,
          inStockStatus: "Available to Order",
          isActive: true,
          seoTitle: `${name} (${rawSku}) | Radiant Industrial Co.`,
          seoDescription: cleanShort,
        })
        .where(eq(products.id, match.id));
      updatedCount++;
      continue;
    }

    let baseSlug = toSlug(`karam-${item.url_key || rawSku}`);
    if (!baseSlug) baseSlug = toSlug(`karam-${rawSku}`);
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
      description: descText,
      divisionId: targetCat.divisionId,
      categoryId: targetCat.id,
      brandId,
      pricingMode: "rfq_only",
      basePrice: inrPrice,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: "1 NOS",
      leadTime: "3–7 Working Days",
      hsnCode: "",
      specificationsJson: JSON.stringify(specRows),
      primaryImageUrl,
      galleryJson,
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${name} (${rawSku}) | Radiant Industrial Co.`,
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
        fetchedUniqueKaramProducts: finalItems.length,
        withImageUrls: withImagesCount,
        insertedKaramProducts: insertedCount,
        updatedKaramProducts: updatedCount,
        totalProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Karam Safety catalog:", err);
  process.exit(1);
});
