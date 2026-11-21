import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const SITEMAP_URL = "https://www.godrejenterprises.com/sitemap/b2b-products.xml";

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
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "godrej-storage"));
  if (!brandRow) throw new Error("Brand 'godrej-storage' not found in DB.");

  const [targetCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "storage-material-handling"));
  if (!targetCat) throw new Error("Category 'storage-material-handling' not found.");

  const xml = await fetchWithRetry(SITEMAP_URL);
  if (!xml) throw new Error("Failed to fetch Godrej B2B sitemap");

  const urls = [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => u.includes("/intralogistics/"))
    ),
  ];
  console.log(`[Godrej Storage] Discovered ${urls.length} intralogistics & storage URLs.`);

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  const CONCURRENCY = 10;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(async (u) => ({ url: u, html: await fetchWithRetry(u) })));

    for (const { url, html } of pages) {
      if (!html) continue;
      const h1 = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
      const metaDesc = cleanText(
        html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1] || ""
      );
      if (!h1) continue;

      const mainIdx = html.indexOf("<main");
      const mainSlice = mainIdx !== -1 ? html.slice(mainIdx, mainIdx + 30000) : html;
      const imgs = [
        ...new Set(
          [...mainSlice.matchAll(/https:\/\/static\.godrejenterprises\.com\/[^"'\s\\<>]+\.(?:webp|png|jpg|jpeg)/gi)]
            .map((m) => m[0])
            .filter(
              (u) =>
                !/share-image|empty\.webp|Solar_Blog|yt_|fb_|linkedin_|x_|icon|logo/i.test(u)
            )
        ),
      ];

      const infoIdx = mainSlice.indexOf("Information");
      const textSource = infoIdx !== -1 ? mainSlice.slice(infoIdx, infoIdx + 12000) : mainSlice;
      const bodyParagraphs = textSource
        .replace(/<script[\s\S]*?<\/script>/gi, "\n")
        .replace(/<style[\s\S]*?<\/style>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .split("\n")
        .map((l) => cleanText(l))
        .filter((l) => l.length > 25 && !/Copyright|Cookie|Subscribe|Facebook|Linkedin|WhatsApp/i.test(l));

      const segs = new URL(url).pathname.split("/").filter(Boolean);
      const urlSlug = segs[segs.length - 1] || toSlug(h1);
      const sku = `GODREJ-${urlSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 34)}`;
      if (existingSkus.has(sku)) continue;
      existingSkus.add(sku);

      let safeSlug = toSlug(`godrej-${urlSlug}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const categoryLine = segs
        .slice(1, Math.max(2, segs.indexOf("p")))
        .map((s) =>
          s
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        )
        .join(" > ");

      const shortDesc = `${h1} (${categoryLine || "Industrial Storage & Intralogistics"}). Confirm load capacity, bay dimensions, and site layout before ordering.`.slice(0, 220);
      const fullDesc = [
        bodyParagraphs.slice(0, 5).join("\n") || metaDesc || `${h1} industrial material handling and storage solution.`,
        "",
        "Before Ordering: Please verify exact load capacity, racking/aisle dimensions, and installation requirements with our engineering team before confirming your order.",
      ].join("\n");

      const specs = [
        { label: "Brand", value: "Godrej Storage Solutions" },
        { label: "Product Model", value: h1 },
        { label: "Solution Segment", value: categoryLine || "Intralogistics & Racking" },
      ];

      toInsert.push({
        slug: safeSlug,
        sku,
        name: h1.slice(0, 180),
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
        hsnCode: /forklift|stacker|truck|pallet/i.test(h1) ? "8427" : "7308",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: imgs[0] || null,
        galleryJson: JSON.stringify(imgs.slice(1, 5)),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${h1} | Radiant Industrial Co.`,
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
        brand: "godrej-storage",
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
    console.error("[load-godrej-storage] Error:", err);
    process.exit(1);
  });
