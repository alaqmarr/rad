import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";
import { decodeHtmlEntities, htmlToCleanText } from "../src/lib/sanitize-text";

const GRAPHQL_URL = "https://eshop.kirloskarpumps.com/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapCategorySlug(catNames: string[], title: string): string {
  const hay = `${catNames.join(" ")} ${title}`.toLowerCase();
  if (
    hay.includes("agri") ||
    hay.includes("farm") ||
    hay.includes("irrigation") ||
    hay.includes("openwell") ||
    hay.includes("monoblock") ||
    hay.includes("borewell") ||
    hay.includes("submersible") ||
    hay.includes("ks") ||
    hay.includes("kp") ||
    hay.includes("kos") ||
    hay.includes("jos")
  ) {
    return "water-pumps-motors";
  }
  return "electrical-pneumatic-mro";
}

async function queryPage(page: number, pageSize = 50): Promise<any | null> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{
            products(filter: {}, pageSize: ${pageSize}, currentPage: ${page}) {
              total_count
              items {
                sku
                name
                url_key
                image { url }
                price_range { minimum_price { regular_price { value } } }
                short_description { html }
                description { html }
                categories { name }
              }
            }
          }`,
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json?.data?.products || null;
    } catch (e: any) {
      if (attempt === 5) return null;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return null;
}

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "kirloskar"));
  if (!brandRow) throw new Error("Brand 'kirloskar' not found in DB.");

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  let page = 1;
  let totalCount = 0;

  while (true) {
    const data = await queryPage(page, 50);
    if (!data || !Array.isArray(data.items) || data.items.length === 0) break;
    totalCount = Number(data.total_count || totalCount);

    for (const item of data.items) {
      const rawSku = String(item.sku || "").trim();
      const name = decodeHtmlEntities(String(item.name || "").trim());
      if (!rawSku || !name) continue;

      const dbSku = `KBL-${rawSku.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      const catNames = (item.categories || [])
        .map((c: any) => decodeHtmlEntities(String(c?.name || "").trim()))
        .filter(Boolean);
      const catSlug = mapCategorySlug(catNames, name);
      const targetCat =
        catBySlug[catSlug] ||
        catBySlug["water-pumps-motors"] ||
        catBySlug["electrical-pneumatic-mro"] ||
        Object.values(catBySlug)[0];

      const rawImg = String(item.image?.url || "").trim();
      const imageUrl =
        rawImg.startsWith("http") && !rawImg.includes("placeholder")
          ? rawImg.split("?")[0]
          : null;

      const plainDesc =
        htmlToCleanText(item.description?.html, false) ||
        htmlToCleanText(item.short_description?.html, false);
      const listPrice =
        typeof item.price_range?.minimum_price?.regular_price?.value === "number" &&
        item.price_range.minimum_price.regular_price.value > 0
          ? item.price_range.minimum_price.regular_price.value
          : null;

      let safeSlug = toSlug(`kirloskar-${item.url_key || rawSku}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const shortDesc = `${name} (Kirloskar ${rawSku}). Verify HP rating, phase/voltage, head & discharge size before ordering.`.slice(
        0,
        220
      );
      const fullDesc = [
        plainDesc || `${name} — genuine Kirloskar industrial & agricultural pumping solution.`,
        "",
        "Before Ordering: Please verify exact HP/kW rating, head range, pipe size, and 1-phase/3-phase supply with our sales team.",
      ].join("\n");

      const specs = [
        { label: "Brand", value: "Kirloskar (KBL)" },
        { label: "Model / SKU Code", value: rawSku },
        ...(catNames.length > 0
          ? [{ label: "Application Line", value: catNames.slice(0, 3).join(" / ") }]
          : []),
      ];

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
        basePrice: listPrice,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "8413",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} (${rawSku}) | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }

    if (page * 50 >= totalCount) break;
    page++;
    await new Promise((r) => setTimeout(r, 150));
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
        brand: "kirloskar",
        discoveredTotal: totalCount,
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
    console.error("[load-kirloskar] Error:", err);
    process.exit(1);
  });
