import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const SITEMAP_URL = "https://www.supreme.co.in/sitemap.xml";

function decodeEntities(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
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

async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 1; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch {
      if (i === retries) return null;
      await new Promise((res) => setTimeout(res, 350 * i));
    }
  }
  return null;
}

async function main() {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "supreme-industries"));
  if (!brandRow) throw new Error("Brand 'supreme-industries' not found in DB.");

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const xml = await fetchWithRetry(SITEMAP_URL);
  if (!xml) throw new Error("Failed to fetch Supreme Industries sitemap.");

  const urls = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => /\/(pipe|ipd|mhd)\/products\//i.test(u))
    ),
  ];
  console.log(`[Supreme Industries] Discovered ${urls.length} piping & material handling product URLs.`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 12;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchWithRetry(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1Raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
      const name = cleanText(h1Raw).replace(/\s*\.+\s*$/, "");
      if (!name) continue;

      const metaDesc = cleanText(
        html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1] || ""
      );

      const h1Idx = html.indexOf("<h1");
      const contentSlice = h1Idx !== -1 ? html.slice(h1Idx, h1Idx + 25000) : html;
      const uploadImgs = [
        ...new Set(
          [...contentSlice.matchAll(/https:\/\/www\.supreme\.co\.in\/uploads\/images\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi)].map(
            (m) => m[0]
          )
        ),
      ];

      const isMhd = url.includes("/mhd/");
      const targetCat =
        (isMhd ? catBySlug["storage-material-handling"] : catBySlug["valves-pipes-flow"]) ||
        Object.values(catBySlug)[0];

      const segs = new URL(url).pathname.split("/").filter(Boolean);
      const urlSlug = segs[segs.length - 1] || toSlug(name);
      const sku = `SUP-${urlSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 34)}`;
      if (existingSkus.has(sku)) continue;
      existingSkus.add(sku);

      let safeSlug = toSlug(`supreme-${urlSlug}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const divLabel = isMhd
        ? "Material Handling Division"
        : url.includes("/ipd/")
        ? "Industrial Piping Division"
        : "Piping Systems";
      const displayName = name.toLowerCase().includes("supreme") ? name : `Supreme ${name}`;
      const shortDesc = `${displayName} (${divLabel}). Confirm diameter/pressure rating or crate dimensions and pack quantity before ordering.`.slice(0, 220);
      const fullDesc = [
        metaDesc || `${displayName} — genuine Supreme Industries industrial product.`,
        "",
        "Before Ordering: Please verify exact pipe size/schedule, pressure class, or crate/pallet dimensions and pack quantity with our team before confirming your order.",
      ].join("\n");

      const specs = [
        { label: "Brand", value: "Supreme Industries" },
        { label: "Division", value: divLabel },
      ];

      toInsert.push({
        slug: safeSlug,
        sku,
        name: displayName.slice(0, 180),
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
        leadTime: "3–7 Working Days",
        hsnCode: "3917",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: uploadImgs[0] || null,
        galleryJson: JSON.stringify(uploadImgs.slice(1, 5)),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${displayName} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  console.log(
    JSON.stringify(
      {
        brand: "supreme-industries",
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
    console.error("[load-supreme-industries] Error:", err);
    process.exit(1);
  });
