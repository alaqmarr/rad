import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const PAGE_SITEMAP_URL = "https://www.jindalstainless.com/page-sitemap.xml";

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

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "jindal-stainless"));
  if (!brandRow) throw new Error("Brand 'jindal-stainless' not found in DB.");

  const [targetCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "specialty-alloys-plastics"));
  const fallbackCats = await db.select().from(categories);
  const cat = targetCat || fallbackCats[0];

  const xml = await (await fetch(PAGE_SITEMAP_URL)).text();
  const urls = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter(
          (u) =>
            u.includes("/products/") &&
            !/research-development|quality-technology|brochures|\/products\/$/i.test(u)
        )
    ),
  ];
  console.log(`[Jindal Stainless] Discovered ${urls.length} product pages.`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];

  for (const url of urls) {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) continue;
    const html = await r.text();
    const h1 = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
    if (!h1) continue;

    const mainIdx = html.indexOf("<main") !== -1 ? html.indexOf("<main") : html.indexOf("<h1");
    const mainSlice = html.slice(Math.max(0, mainIdx), mainIdx + 25000);
    const imgs = [
      ...new Set(
        [...mainSlice.matchAll(/https:\/\/www\.jindalstainless\.com\/wp-content\/uploads\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi)]
          .map((m) => m[0])
          .filter((u) => !/Favicon|logo/i.test(u))
      ),
    ];

    const paras = [...mainSlice.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => cleanText(m[1]))
      .filter((t) => t.length > 35 && !/Cookie|Copyright|privacy/i.test(t));

    const slugPart = new URL(url).pathname.split("/").filter(Boolean).pop() || toSlug(h1);
    const sku = `JSL-${slugPart.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 32)}`;
    if (existingSkus.has(sku)) continue;
    existingSkus.add(sku);

    let safeSlug = toSlug(`jindal-${slugPart}`);
    if (existingSlugs.has(safeSlug)) {
      let sfx = 2;
      while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
      safeSlug = `${safeSlug}-${sfx}`;
    }
    existingSlugs.add(safeSlug);

    const name = h1.toLowerCase().includes("stainless")
      ? `Jindal Stainless ${h1}`
      : `Jindal Stainless Steel ${h1}`;
    const shortDesc = `${name}. Confirm steel grade (200/300/400/Duplex), thickness, surface finish, and coil/plate dimensions before ordering.`.slice(0, 220);
    const fullDesc = [
      paras.slice(0, 4).join("\n") || `${name} manufactured by Jindal Stainless.`,
      "",
      "Before Ordering: Please verify exact SS grade (304/304L/316/316L/430/201/etc.), thickness, width/length, surface finish (No.1, 2B, BA, No.4), and tonnage/MT requirement before confirming your order.",
    ].join("\n");

    const specs = [
      { label: "Brand", value: "Jindal Stainless" },
      { label: "Product Form", value: h1 },
      { label: "Available Series", value: "200 / 300 / 400 / Duplex Series" },
    ];

    toInsert.push({
      slug: safeSlug,
      sku,
      name,
      shortDescription: shortDesc,
      description: fullDesc,
      divisionId: cat.divisionId,
      categoryId: cat.id,
      brandId: brandRow.id,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "KG",
      gstPercent: 18,
      moq: "100 KG",
      leadTime: "5–14 Working Days",
      hsnCode: "7219",
      specificationsJson: JSON.stringify(specs),
      primaryImageUrl: imgs[0] || null,
      galleryJson: JSON.stringify(imgs.slice(1, 4)),
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${name} | Radiant Industrial Co.`,
      seoDescription: shortDesc,
    });
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "jindal-stainless",
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
    console.error("[load-jindal-stainless] Error:", err);
    process.exit(1);
  });
