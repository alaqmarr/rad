import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const GRAPHQL_URL = "https://havells.com/graphql";

// B2B / Electrical / Lighting / Fans / Switchgear / Solar root categories from Havells Magento GraphQL
const TARGET_CATEGORIES = [
  { id: "116", name: "Lighting", defaultCat: "facility-lighting-fans" },
  { id: "83", name: "Switches & Accessories", defaultCat: "electrical-pneumatic-mro" },
  { id: "278", name: "Electricals, Wires & Switchgear", defaultCat: "electrical-pneumatic-mro" },
  { id: "50", name: "Fans", defaultCat: "facility-lighting-fans" },
  { id: "3814", name: "Green Energy & EV Chargers", defaultCat: "electrical-pneumatic-mro" },
];

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
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapCategorySlug(catNames: string[], title: string, fallbackSlug: string): string {
  const hay = `${catNames.join(" ")} ${title}`.toLowerCase();
  if (
    hay.includes("light") ||
    hay.includes("led") ||
    hay.includes("luminaire") ||
    hay.includes("flood") ||
    hay.includes("street") ||
    hay.includes("batten") ||
    hay.includes("bulb") ||
    hay.includes("fan") ||
    hay.includes("exhaust") ||
    hay.includes("ventilat")
  ) {
    return "facility-lighting-fans";
  }
  return fallbackSlug;
}

async function queryHavells(categoryId: string, page: number, pageSize = 20): Promise<any | null> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const r = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Content-Type": "application/json",
          Store: "default",
          Connection: "close",
        },
        body: JSON.stringify({
          query: `{
            products(filter: { category_id: { eq: "${categoryId}" } }, pageSize: ${pageSize}, currentPage: ${page}) {
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
      if (r.status === 406) {
        console.warn(`[Havells] cat=${categoryId} page=${page} attempt=${attempt} -> HTTP 406`);
        await new Promise((res) => setTimeout(res, 250 * attempt));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      const parsed = JSON.parse(txt);
      if (!parsed?.data?.products) {
        console.warn(`[Havells] cat=${categoryId} page=${page} empty data:`, txt.slice(0, 200));
      }
      return parsed?.data?.products || null;
    } catch (e: any) {
      console.warn(`[Havells] cat=${categoryId} page=${page} attempt=${attempt} err:`, e?.message || e);
      await new Promise((res) => setTimeout(res, 400 * attempt));
    }
  }
  return null;
}

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "havells"));
  if (!brandRow) throw new Error("Brand 'havells' not found in DB.");

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  const summary: Array<{ category: string; fetched: number; inserted: number }> = [];

  for (const tc of TARGET_CATEGORIES) {
    let page = 1;
    let totalCount = 0;
    let fetched = 0;
    let inserted = 0;

    while (true) {
      const data = await queryHavells(tc.id, page, 20);
      if (!data || !Array.isArray(data.items) || data.items.length === 0) break;
      totalCount = data.total_count || totalCount;

      for (const item of data.items) {
        fetched++;
        const rawSku = String(item.sku || "").trim();
        const name = decodeEntities(String(item.name || "").trim());
        if (!rawSku || !name) continue;

        const dbSku = `HAV-${rawSku.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
        if (existingSkus.has(dbSku)) continue;
        existingSkus.add(dbSku);

        const catNames = (item.categories || []).map((c: any) => String(c?.name || "").trim()).filter(Boolean);
        const catSlug = mapCategorySlug(catNames, name, tc.defaultCat);
        const targetCat = catBySlug[catSlug] || catBySlug[tc.defaultCat] || Object.values(catBySlug)[0];

        const rawImg = String(item.image?.url || "").trim();
        const imageUrl =
          rawImg.startsWith("https://havells.com/media/catalog/product/") && !rawImg.includes("placeholder")
            ? rawImg.split("?")[0]
            : null;

        const plainDesc = htmlToPlainText(item.description?.html) || htmlToPlainText(item.short_description?.html);
        const listPrice =
          typeof item.price_range?.minimum_price?.regular_price?.value === "number" &&
          item.price_range.minimum_price.regular_price.value > 0
            ? item.price_range.minimum_price.regular_price.value
            : null;

        let safeSlug = toSlug(`havells-${item.url_key || rawSku}`);
        if (existingSlugs.has(safeSlug)) {
          let sfx = 2;
          while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
          safeSlug = `${safeSlug}-${sfx}`;
        }
        existingSlugs.add(safeSlug);

        const shortDesc = `${name} (Havells ${rawSku}). Verify voltage rating, wattage/amperage, and standard pack before ordering.`.slice(0, 220);
        const fullDesc = [
          plainDesc || `${name} — genuine Havells electrical & industrial solution.`,
          "",
          "Before Ordering: Please verify exact catalogue code, voltage/current rating, and pack quantity with our team before confirming your order.",
        ].join("\n");

        const specs = [
          { label: "Brand", value: "Havells" },
          { label: "Catalogue Code", value: rawSku },
          { label: "Category Line", value: catNames.slice(0, 3).join(" / ") || tc.name },
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
          hsnCode: tc.id === "116" ? "9405" : tc.id === "50" ? "8414" : "8536",
          specificationsJson: JSON.stringify(specs),
          primaryImageUrl: imageUrl,
          galleryJson: JSON.stringify([]),
          inStockStatus: "Available to Order",
          isFeatured: false,
          isActive: true,
          seoTitle: `${name} (${rawSku}) | Radiant Industrial Co.`,
          seoDescription: shortDesc,
        });
        inserted++;
      }

      if (page * 20 >= totalCount) break;
      page++;
      await new Promise((res) => setTimeout(res, 200));
    }

    console.log(`[Havells] ${tc.name}: fetched=${fetched}, inserted=${inserted}`);
    summary.push({ category: tc.name, fetched, inserted });
    await new Promise((res) => setTimeout(res, 400));
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "havells",
        categories: summary,
        totalInserted: toInsert.length,
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
    console.error("[load-havells] Error:", err);
    process.exit(1);
  });
