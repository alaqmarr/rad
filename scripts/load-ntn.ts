import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";

const BASE_URL = "https://www.qualitybearingsonline.com/brands/NTN.html";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchHtml(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      if (attempt === 3) return null;
      await new Promise((res) => setTimeout(res, 350 * attempt));
    }
  }
  return null;
}

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "ntn"));
  if (!brandRow) throw new Error("Brand 'ntn' not found in DB.");

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };
  const targetCat = catBySlug["bearings-transmission"] || Object.values(catBySlug)[0];

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const firstHtml = await fetchHtml(BASE_URL);
  if (!firstHtml) throw new Error("Failed to fetch NTN catalog page.");

  const pageNums = [...firstHtml.matchAll(/page=(\d+)/gi)].map((m) => Number(m[1]));
  const maxPage = pageNums.length > 0 ? Math.max(...pageNums) : 1;
  console.log(`[NTN] Found ${maxPage} catalog page(s). Parsing bearing SKUs...`);

  const toInsert: Array<typeof products.$inferInsert> = [];

  for (let p = 1; p <= maxPage; p++) {
    const html = p === 1 ? firstHtml : await fetchHtml(`${BASE_URL}?page=${p}`);
    if (!html) continue;

    for (const m of html.matchAll(/<article class="card[\s\S]*?<\/article>/gi)) {
      const card = m[0];
      const titleMatch = card.match(/class="card-title"[\s\S]{0,300}?href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      const rawName = htmlToCleanText(titleMatch?.[2], true);
      if (!rawName) continue;

      const imgMatch =
        card.match(/data-src="([^"]+)"/i)?.[1] || card.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
      const imageUrl = imgMatch && imgMatch.startsWith("http") ? imgMatch.trim() : null;

      // Extract bearing part number (usually before the first dash or word "NTN")
      const partMatch = rawName.match(/^([A-Z0-9/+._-]+(?:\s+[A-Z0-9/+._-]+)?)\s*(?:-|NTN)/i);
      const modelCode = (partMatch?.[1] || rawName.split(/\s+/)[0]).trim();
      const normCode = modelCode.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const dbSku = `NTN-${normCode}`.slice(0, 56);
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`ntn-${rawName}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const dimsMatch = rawName.match(/(\d+(?:\.\d+)?x\d+(?:\.\d+)?x\d+(?:\.\d+)?\s*mm)/i);
      const shortDesc = `${rawName} — genuine NTN precision industrial bearing${
        dimsMatch ? ` (${dimsMatch[1]})` : ""
      }. HSN 8482.`.slice(0, 220);

      const fullDesc = [
        `${rawName} supplied by Radiant Industrial Co. for industrial machinery, gearboxes, motors, and maintenance replacement.`,
        dimsMatch ? `Dimensions: ${dimsMatch[1]}.` : "",
        "",
        "Before Ordering: Verify bore/OD/width, seal suffix (ZZ/2RS/LLU), clearance (C3/CN), and batch quantity with our team.",
      ]
        .filter(Boolean)
        .join("\n");

      const specs = [
        { label: "Brand", value: "NTN Bearings" },
        { label: "Part Designation", value: modelCode },
        ...(dimsMatch ? [{ label: "Dimensions (d x D x B)", value: dimsMatch[1] }] : []),
      ];

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name: rawName,
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
        hsnCode: "8482",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${rawName} | Radiant Industrial Co.`,
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
        brand: "ntn",
        pagesScanned: maxPage,
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
    console.error("[load-ntn] Error:", err);
    process.exit(1);
  });
