import { eq, sql } from "drizzle-orm";
import { brands, client, db, products } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";

interface BrandAuditRow {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  totalProducts: number;
  withImages: number;
  imgPct: number;
  htmlDirty: number;
  leadDirty: number;
  status: "HEALTHY" | "LOW_COUNT" | "LOW_IMAGES" | "EMPTY" | "DIRTY_TEXT" | "DIRTY_LEAD";
}

async function checkImageSample(urls: string[]): Promise<{ checked: number; ok: number; broken: string[] }> {
  let ok = 0;
  const broken: string[] = [];
  for (const url of urls) {
    if (!url.startsWith("http")) {
      ok++;
      continue;
    }
    try {
      const r = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantVerifier/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok || r.status === 405) {
        if (r.status === 405) {
          const g = await fetch(url, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantVerifier/1.0)" },
            signal: AbortSignal.timeout(8000),
          });
          if (g.ok) ok++;
          else broken.push(`${g.status} ${url}`);
        } else {
          ok++;
        }
      } else {
        broken.push(`${r.status} ${url}`);
      }
    } catch (e: any) {
      broken.push(`ERR(${e?.message || "timeout"}) ${url}`);
    }
  }
  return { checked: urls.length, ok, broken };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const strict = args.has("--strict");
  const checkImages = args.has("--check-images");
  const houseBrands = new Set(["radiant", "siddhi", "sterila"]);

  const allBrands = await db.select().from(brands).where(eq(brands.isActive, true));
  const allProducts = await db
    .select({
      id: products.id,
      brandId: products.brandId,
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      leadTime: products.leadTime,
      primaryImageUrl: products.primaryImageUrl,
    })
    .from(products)
    .where(eq(products.isActive, true));

  const byBrand = new Map<number, typeof allProducts>();
  for (const p of allProducts) {
    if (!p.brandId) continue;
    const arr = byBrand.get(p.brandId) || [];
    arr.push(p);
    byBrand.set(p.brandId, arr);
  }

  const auditRows: BrandAuditRow[] = [];
  for (const b of allBrands) {
    const items = byBrand.get(b.id) || [];
    let withImages = 0;
    let htmlDirty = 0;
    let leadDirty = 0;

    for (const p of items) {
      if (p.primaryImageUrl && p.primaryImageUrl.trim().length > 0) withImages++;
      if (p.leadTime !== "Confirmed Upon Order") leadDirty++;
      const cleanDesc = htmlToCleanText(p.description, false);
      const cleanShort = htmlToCleanText(p.shortDescription, true);
      if (
        /<\/?(?:p|div|strong|br|ul|li|span)\b/i.test(p.description + p.shortDescription) ||
        /&(?:nbsp|ldquo|rdquo|rsquo|ndash|amp|lt|gt);/i.test(p.description + p.shortDescription + p.name) ||
        (cleanDesc.length > 0 && /<(?:p|strong|br)>/i.test(p.description)) ||
        (cleanShort.length > 0 && /<(?:p|strong|br)>/i.test(p.shortDescription))
      ) {
        htmlDirty++;
      }
    }

    const total = items.length;
    const imgPct = total > 0 ? Math.round((withImages / total) * 100) : 0;

    let status: BrandAuditRow["status"] = "HEALTHY";
    if (total === 0) status = "EMPTY";
    else if (htmlDirty > 0) status = "DIRTY_TEXT";
    else if (leadDirty > 0) status = "DIRTY_LEAD";
    else if (!houseBrands.has(b.slug) && total < 10) status = "LOW_COUNT";
    else if (!houseBrands.has(b.slug) && imgPct < 60) status = "LOW_IMAGES";

    auditRows.push({
      id: b.id,
      slug: b.slug,
      name: b.name,
      isActive: b.isActive,
      totalProducts: total,
      withImages,
      imgPct,
      htmlDirty,
      leadDirty,
      status,
    });
  }

  auditRows.sort((a, b) => a.totalProducts - b.totalProducts || a.name.localeCompare(b.name));

  console.log("\n=== RADIANT CATALOG BRAND VERIFICATION MATRIX ===");
  console.table(
    auditRows.map((r) => ({
      Slug: r.slug,
      Brand: r.name,
      Products: r.totalProducts,
      Images: r.withImages,
      "Img %": `${r.imgPct}%`,
      "HTML Dirty": r.htmlDirty,
      "Lead Dirty": r.leadDirty,
      Status: r.status,
    }))
  );

  const emptyBrands = auditRows.filter((r) => r.status === "EMPTY");
  const lowBrands = auditRows.filter((r) => r.status === "LOW_COUNT" || r.status === "LOW_IMAGES");
  const dirtyBrands = auditRows.filter((r) => r.status === "DIRTY_TEXT" || r.status === "DIRTY_LEAD");

  let ftsRows = 0;
  let totalProductsAll = allProducts.length;
  try {
    const [ftsRes, prodRes] = await Promise.all([
      client.execute(`SELECT COUNT(*) as cnt FROM products_fts`),
      client.execute(`SELECT COUNT(*) as cnt FROM products`),
    ]);
    ftsRows = Number(ftsRes.rows[0]?.cnt || 0);
    totalProductsAll = Number(prodRes.rows[0]?.cnt || allProducts.length);
  } catch {
    ftsRows = -1;
  }

  let imageSampleCheck: Awaited<ReturnType<typeof checkImageSample>> | null = null;
  if (checkImages) {
    const hostSamples = new Map<string, string>();
    for (const p of allProducts) {
      if (!p.primaryImageUrl || !p.primaryImageUrl.startsWith("http")) continue;
      try {
        const host = new URL(p.primaryImageUrl).hostname;
        if (!hostSamples.has(host)) hostSamples.set(host, p.primaryImageUrl);
      } catch {
        // skip invalid URL
      }
    }
    imageSampleCheck = await checkImageSample([...hostSamples.values()]);
  }

  const summary = {
    totalActiveBrands: auditRows.length,
    healthyBrands: auditRows.filter((r) => r.status === "HEALTHY").length,
    emptyBrands: emptyBrands.map((r) => r.slug),
    lowCoverageBrands: lowBrands.map((r) => `${r.slug} (${r.totalProducts} prods, ${r.imgPct}% imgs)`),
    dirtyBrands: dirtyBrands.map((r) => r.slug),
    totalActiveProducts: allProducts.length,
    totalProductsAll,
    productsWithImages: allProducts.filter((p) => Boolean(p.primaryImageUrl?.trim())).length,
    ftsIndexedRows: ftsRows,
    ftsSynced: ftsRows === totalProductsAll,
    ...(imageSampleCheck ? { imageSampleCheck } : {}),
  };

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  if (
    strict &&
    (emptyBrands.length > 0 ||
      lowBrands.length > 0 ||
      dirtyBrands.length > 0 ||
      (ftsRows >= 0 && ftsRows !== totalProductsAll))
  ) {
    console.error("\n[verify-catalog] FAILED strict verification!");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[verify-catalog] Error:", err);
    process.exit(1);
  });
