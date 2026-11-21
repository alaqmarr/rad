import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";

const execFileAsync = promisify(execFile);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchHttpText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) return await r.text();
  } catch {
    // fallback to system curl (handles sites with HTTP/2/TLS quirks)
  }
  try {
    const { stdout } = await execFileAsync(
      process.platform === "win32" ? "curl.exe" : "curl",
      ["-sS", "-L", "--max-time", "15", "-A", UA, url],
      { maxBuffer: 6 * 1024 * 1024 }
    );
    return stdout || null;
  } catch {
    return null;
  }
}

async function loadLtSwitchgear(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "lt-switchgear"));
  if (!brandRow) throw new Error("Brand 'lt-switchgear' not found in DB.");

  const targetCat = catBySlug["electrical-pneumatic-mro"] || Object.values(catBySlug)[0];
  const xml = await fetchHttpText("https://www.lk-ea.com/sitemap-index.xml");
  if (!xml) {
    console.warn("[L&T Switchgear] Could not fetch lk-ea sitemap-index.xml");
    return { brand: "lt-switchgear", inserted: 0, withImages: 0 };
  }

  const productUrls = [
    ...new Set(
      [...xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)]
        .map((m) => m[1].trim())
        .filter((u) => u.includes("/products/"))
    ),
  ];

  console.log(`[L&T Switchgear] Discovered ${productUrls.length} official Lauritz Knudsen URLs...`);

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 6;

  for (let i = 0; i < productUrls.length; i += CONCURRENCY) {
    const chunk = productUrls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(
      chunk.map(async (url) => ({ url, html: await fetchHttpText(url) }))
    );

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], true);
      const rawTitle = htmlToCleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], true)?.split("|")[0]?.trim();
      const name = (h1 && h1.length > 2 ? h1 : rawTitle) || "";
      if (!name || /404|not found/i.test(name)) continue;

      const metaDesc = htmlToCleanText(
        html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1],
        false
      );

      // Prefer Builder/CDN product image over tracking pixels
      const candidateImgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1].trim())
        .filter(
          (src) =>
            src.startsWith("https://") &&
            !/linkedin|facebook|doubleclick|google|analytics|pixel|svg/i.test(src)
        );
      const imageUrl = candidateImgs[0] || null;

      const slugLeaf = url.split("/").filter(Boolean).pop() || toSlug(name);
      const dbSku = `LT-SW-${slugLeaf.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
        0,
        58
      );
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`lt-switchgear-${slugLeaf}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const lineLabel = url
        .split("/products/")[1]
        ?.split("/")
        .slice(0, -1)
        .map((s) => s.replace(/-/g, " "))
        .join(" / ");

      const shortDesc = `${name} — L&T Switchgear (Lauritz Knudsen). Verify pole count, current/kW rating & voltage before order.`.slice(
        0,
        220
      );
      const fullDesc = [
        metaDesc || `${name} — genuine L&T Switchgear / Lauritz Knudsen electrical automation & switchgear component.`,
        "",
        "Before Ordering: Confirm frame rating, breaking capacity (kA), coil voltage, and accessory kit with our team.",
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
        hsnCode: "8536",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "L&T Switchgear (Lauritz Knudsen)" },
          { label: "Series Code", value: slugLeaf.toUpperCase() },
          ...(lineLabel ? [{ label: "Product Family", value: lineLabel }] : []),
        ]),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} — L&T Switchgear | Radiant Industrial Co.`,
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
    brand: "lt-switchgear",
    discoveredUrls: productUrls.length,
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function loadLtValves(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "lt-valves"));
  if (!brandRow) throw new Error("Brand 'lt-valves' not found in DB.");

  const targetCat =
    catBySlug["fluid-control-valves"] ||
    catBySlug["pipes-valves-fittings"] ||
    Object.values(catBySlug)[0];

  const basePages = [
    "https://www.tubesandvalves.com/brands/l-and-t-valves.html",
    "https://www.tubesandvalves.com/brands/audco-valves.html",
  ];

  const prodUrls = new Set<string>();
  const catQueue: string[] = [];

  for (const bp of basePages) {
    const html = await fetchHttpText(bp);
    if (!html) continue;
    for (const m of html.matchAll(/href=["']([^"']+\.html)["']/gi)) {
      const abs = new URL(m[1], bp).toString();
      if (abs.includes("/products/")) prodUrls.add(abs);
      else if (
        abs.includes("/categories/") &&
        /lt-|l-and-t|audco|butterfly|ball-valve|gate-valve|globe-valve|check-valve/i.test(abs)
      ) {
        catQueue.push(abs);
      }
    }
  }

  // Also crawl child category pages found under L&T / Audco brands
  const uniqueCats = [...new Set(catQueue)].slice(0, 60);
  for (let i = 0; i < uniqueCats.length; i += 8) {
    const chunk = uniqueCats.slice(i, i + 8);
    const pages = await Promise.all(chunk.map((u) => fetchHttpText(u)));
    for (let j = 0; j < pages.length; j++) {
      const h = pages[j];
      if (!h) continue;
      for (const m of h.matchAll(/href=["']([^"']+\/products\/[^"']+\.html|[^"']*products\/[^"']+\.html)["']/gi)) {
        prodUrls.add(new URL(m[1], chunk[j]).toString());
      }
    }
  }

  console.log(`[L&T Valves] Discovered ${prodUrls.size} L&T / Audco valve product pages...`);

  const allUrls = [...prodUrls];
  const toInsert: Array<typeof products.$inferInsert> = [];

  for (let i = 0; i < allUrls.length; i += 10) {
    const chunk = allUrls.slice(i, i + 10);
    const pages = await Promise.all(
      chunk.map(async (url) => ({ url, html: await fetchHttpText(url) }))
    );

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], true);
      if (!h1 || h1.length < 4) continue;

      const rawImg = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1].trim())
        .find((s) => /catalog-import|products/i.test(s) && !/logo|icon|flag/i.test(s));
      const imageUrl = rawImg ? new URL(rawImg, url).toString() : null;

      const metaDesc = htmlToCleanText(
        html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1],
        false
      );

      const leafCode = url.match(/-(\d+)\.html$/i)?.[1] || toSlug(h1).slice(0, 24);
      const dbSku = `LTV-${leafCode.toUpperCase()}`.slice(0, 56);
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`lt-valves-${h1}-${leafCode}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const shortDesc = `${h1} — genuine L&T / Audco industrial flow-control valve. Confirm size (NB), class, and end connection before ordering.`.slice(
        0,
        220
      );
      const fullDesc = [
        metaDesc || `${h1} — industrial flow-control valve supplied by Radiant Industrial Co.`,
        "",
        "Before Ordering: Confirm nominal bore size (mm/inch), flange/pressure rating (PN/ASME Class), body/trim material, and actuator option.",
      ].join("\n");

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name: h1,
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
        hsnCode: "8481",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "L&T Valves / Audco" },
          { label: "Reference ID", value: leafCode },
        ]),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${h1} | Radiant Industrial Co.`,
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
    brand: "lt-valves",
    discoveredUrls: allUrls.length,
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

  const swRes = await loadLtSwitchgear(catBySlug, existingSkus, existingSlugs);
  const vRes = await loadLtValves(catBySlug, existingSkus, existingSlugs);

  console.log(JSON.stringify([swRes, vRes], null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-lt-brands] Error:", err);
    process.exit(1);
  });
