import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";
import { decodeHtmlEntities, htmlToCleanText } from "../src/lib/sanitize-text";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchText(url: string): Promise<string | null> {
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
      await new Promise((res) => setTimeout(res, 300 * attempt));
    }
  }
  return null;
}

async function loadJainIrrigation(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "jain-irrigation"));
  if (!brandRow) throw new Error("Brand 'jain-irrigation' not found.");

  const defaultCat =
    catBySlug["drip-sprinkler-irrigation"] ||
    catBySlug["agricultural-irrigation"] ||
    Object.values(catBySlug)[0];

  const sm = await fetchText("https://www.jains.com/sitemap.xml");
  if (!sm) return { brand: "jain-irrigation", inserted: 0, withImages: 0 };

  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => decodeHtmlEntities(m[1].trim()))
    .filter(
      (u) =>
        /\.htm$/i.test(u) &&
        !/Company|Terms|Financial|career|news|blog|event|video|gallery|contact|about|csr|award|download/i.test(u)
    );

  // Sample cleanly up to 350 distinct Jain product pages
  const targetUrls = urls.slice(0, 350);
  console.log(`[Jain Irrigation] Discovered ${urls.length} catalog URLs (loading ${targetUrls.length})...`);

  const toInsert: Array<typeof products.$inferInsert> = [];
  for (let i = 0; i < targetUrls.length; i += 12) {
    const chunk = targetUrls.slice(i, i + 12);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchText(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const rawTitle =
        htmlToCleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], true) ||
        decodeURIComponent(url.split("/").pop()?.replace(/\.htm$/i, "") || "");
      const name = rawTitle.replace(/\s*\|\s*Jain.*$/i, "").trim();
      if (!name || name.length < 3 || /home|index|page not found/i.test(name)) continue;

      const rawImg = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1].trim())
        .find(
          (src) =>
            /PE_Pipes_images|750x500|images\/.*(?:Sprinkler|Drip|Valve|Pipe|Filter|Emitter|Jain)/i.test(src) &&
            !/logo|whatss|JISLShop|news2|jisl_btm/i.test(src)
        );
      const imageUrl = rawImg ? encodeURI(new URL(rawImg, url).toString()) : null;

      const leafSlug = toSlug(name).slice(0, 36);
      const dbSku = `JAIN-${leafSlug.toUpperCase()}`.slice(0, 56);
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`jain-${name}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const metaDesc = htmlToCleanText(
        html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1],
        false
      );
      const targetCat = /pump|motor/i.test(name)
        ? catBySlug["water-pumps-motors"] || defaultCat
        : defaultCat;

      const shortDesc = `${name} — genuine Jain Irrigation (JISL) precision agriculture, pipe & micro-irrigation product.`.slice(
        0,
        220
      );
      const fullDesc = [
        metaDesc || `${name} — engineered by Jain Irrigation Systems Ltd. for agricultural & water infrastructure.`,
        "",
        "Before Ordering: Verify outer diameter (OD), pressure rating (kg/cm²), flow rate (LPH), and bundle pack with our desk.",
      ].join("\n");

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
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: /pipe|fitting|drip/i.test(name) ? "3917" : "8424",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "Jain Irrigation (JISL)" },
          { label: "Product Line", value: url.split("/")[3] || "Precision Irrigation" },
        ]),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} — Jain Irrigation | Radiant Industrial Co.`,
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

  return {
    brand: "jain-irrigation",
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function loadNetafim(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "netafim"));
  if (!brandRow) throw new Error("Brand 'netafim' not found.");

  const targetCat =
    catBySlug["drip-sprinkler-irrigation"] ||
    catBySlug["agricultural-irrigation"] ||
    Object.values(catBySlug)[0];

  const seeds = [
    "https://www.netafimindia.com/products-and-solutions/product-offering/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/drip-irrigation-products/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/sprinkler-irrigation-product/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/filters/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/valves/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/flexible-and-pe-pipes/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/connectors/",
    "https://www.netafimindia.com/products-and-solutions/product-offering/water-meters/",
  ];

  const prodUrls = new Set<string>();
  for (const s of seeds) {
    const h = await fetchText(s);
    if (!h) continue;
    for (const m of h.matchAll(/href=["'](\/products-and-solutions\/product-offering\/[^"']+)["']/gi)) {
      prodUrls.add(`https://www.netafimindia.com${m[1]}`);
    }
  }

  const allUrls = [...prodUrls].filter((u) => !u.endsWith("/product-offering/"));
  console.log(`[Netafim] Discovered ${allUrls.length} Netafim India product/category pages...`);

  const toInsert: Array<typeof products.$inferInsert> = [];
  for (let i = 0; i < allUrls.length; i += 8) {
    const chunk = allUrls.slice(i, i + 8);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchText(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], true);
      const name = h1 || htmlToCleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], true)?.split("|")[0]?.trim();
      if (!name || name.length < 3) continue;

      const ogImg = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;
      const bodyImg = [...html.matchAll(/<img[^>]+src=["']([^"']+(?:globalassets|contentassets|siteassets)[^"']+)["']/gi)]
        .map((m) => m[1])
        .find((s) => !/logo/i.test(s));
      const rawImg = ogImg || bodyImg;
      const imageUrl = rawImg ? new URL(rawImg, url).toString() : null;

      const leaf = url.split("/").filter(Boolean).pop() || toSlug(name);
      const dbSku = `NTF-${leaf.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
        0,
        56
      );
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`netafim-${leaf}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const desc = htmlToCleanText(
        html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1],
        false
      );
      const shortDesc = `${name} — Netafim precision drip & micro-irrigation system component.`.slice(0, 220);
      const fullDesc = [
        desc || `${name} — Netafim India precision agriculture & micro-irrigation solution.`,
        "",
        "Before Ordering: Confirm emitter spacing, flow rate (LPH), lateral diameter, and coil length with our agriculture desk.",
      ].join("\n");

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name: `Netafim ${name}`,
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
        hsnCode: "8424",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "Netafim India" },
          { label: "Model / Line", value: leaf.toUpperCase() },
        ]),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `Netafim ${name} | Radiant Industrial Co.`,
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

  return {
    brand: "netafim",
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function loadFalconAgri(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "falcon-agri"));
  if (!brandRow) throw new Error("Brand 'falcon-agri' not found.");

  const targetCat =
    catBySlug["agri-implements-tools"] ||
    catBySlug["drip-sprinkler-irrigation"] ||
    catBySlug["tools-cutting-machining"] ||
    Object.values(catBySlug)[0];

  const toInsert: Array<typeof products.$inferInsert> = [];

  // Source 1: gurudattaagro.in WooCommerce REST API
  for (let p = 1; p <= 5; p++) {
    const raw = await fetchText(`https://gurudattaagro.in/wp-json/wc/store/v1/products?per_page=100&page=${p}`);
    if (!raw) break;
    const list = JSON.parse(raw) as any[];
    if (!Array.isArray(list) || list.length === 0) break;

    for (const item of list) {
      const name = htmlToCleanText(item.name, true);
      if (!/falcon/i.test(name)) continue;
      const code = (item.sku || item.slug || name).toString().trim();
      const dbSku = `FLC-${code.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(0, 56);
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`falcon-${item.slug || name}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const img = item.images?.[0]?.src || null;
      const cleanDesc =
        htmlToCleanText(item.description, false) || htmlToCleanText(item.short_description, false);
      const shortDesc = `${name} — Falcon Garden & Agricultural tool. Verify model & blade/engine specs on order.`.slice(
        0,
        220
      );

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name,
        shortDescription: shortDesc,
        description:
          cleanDesc ||
          `${name} — durable Falcon agricultural & horticultural equipment supplied by Radiant Industrial Co.`,
        divisionId: targetCat.divisionId,
        categoryId: targetCat.id,
        brandId: brandRow.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "8201",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "Falcon Garden Tools" },
          { label: "Model / Code", value: code },
        ]),
        primaryImageUrl: img,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }
    if (list.length < 100) break;
  }

  // Source 2: liontoolsmart.com Shopify JSON API filtered to Falcon
  for (let p = 1; p <= 25; p++) {
    const raw = await fetchText(`https://www.liontoolsmart.com/products.json?limit=250&page=${p}`);
    if (!raw) break;
    const j = JSON.parse(raw) as { products?: any[] };
    const list = j.products || [];
    if (list.length === 0) break;

    for (const item of list) {
      const hay = `${item.vendor || ""} ${item.title || ""}`;
      if (!/\bfalcon\b/i.test(hay)) continue;
      const name = htmlToCleanText(item.title, true);
      const skuVal = String(item.variants?.[0]?.sku || item.handle || name).trim();
      const dbSku = `FLC-${skuVal.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
        0,
        56
      );
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`falcon-${item.handle || name}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const img = item.images?.[0]?.src || null;
      const desc = htmlToCleanText(item.body_html, false);
      const shortDesc = `${name} — Falcon Garden & Agri tool. Verify specification before ordering.`.slice(0, 220);

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name,
        shortDescription: shortDesc,
        description: desc || `${name} — Falcon agricultural & garden maintenance tool.`,
        divisionId: targetCat.divisionId,
        categoryId: targetCat.id,
        brandId: brandRow.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "8201",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "Falcon Garden Tools" },
          { label: "Model / Code", value: skuVal },
        ]),
        primaryImageUrl: img,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }
    if (list.length < 250) break;
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }

  return {
    brand: "falcon-agri",
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function main() {
  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const jain = await loadJainIrrigation(catBySlug, existingSkus, existingSlugs);
  const netafim = await loadNetafim(catBySlug, existingSkus, existingSlugs);
  const falcon = await loadFalconAgri(catBySlug, existingSkus, existingSlugs);

  console.log(JSON.stringify([jain, netafim, falcon], null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-agri-brands] Error:", err);
    process.exit(1);
  });
