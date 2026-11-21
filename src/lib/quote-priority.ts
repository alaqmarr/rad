import { desc, inArray, sql } from "drizzle-orm";
import { db, ensureDbReady, enquiries, products, categories, brands, whatsappLogs } from "@/db";
import { extractManufacturerPartNumber, parseSpecsJson } from "@/lib/product-enrichment";

export interface QuotePriorityProduct {
  productId: number;
  slug: string;
  sku: string;
  mpn: string;
  name: string;
  brandName: string;
  categoryName: string;
  categorySlug: string;
  enquiryCount: number;
  totalRequestedQty: number;
  lastEnquiredAt: string | null;
  source: "quote_history" | "strategic_catalog";
  specCount: number;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
  readinessScore: number;
  gaps: string[];
}

export interface QuotePriorityCategory {
  categoryId: number;
  slug: string;
  name: string;
  enquiryCount: number;
  productCount: number;
}

export interface QuotePriorityReport {
  totalEnquiriesAnalyzed: number;
  totalWhatsappMessagesAnalyzed: number;
  topProducts: QuotePriorityProduct[];
  topCategories: QuotePriorityCategory[];
}

const STRATEGIC_FALLBACK_SLUGS = [
  "dmc-tools-af8",
  "festo-standards-based-cylinder-dsbc-dsbc",
  "festo-compact-cylinder-double-acting-adn-adn",
  "festo-round-cylinder-double-acting-dsnu-dsnu-pub",
  "dmc-tools-afm8",
  "dmc-tools-mh860-mh860",
  "dmc-tools-g125",
  "dmc-tools-88-100",
  "festo-guided-drive-dfm-dfm",
  "festo-linear-drive-dgc-dgc",
];

function evaluateGaps(p: {
  seoTitle: string;
  seoDescription: string;
  description: string;
  specificationsJson: string;
}): { specCount: number; readinessScore: number; gaps: string[] } {
  const specs = parseSpecsJson(p.specificationsJson);
  const gaps: string[] = [];
  let score = 0;

  if ((p.seoTitle || "").trim().length >= 20) score += 25;
  else gaps.push("Missing custom SEO title");

  if ((p.seoDescription || "").trim().length >= 50) score += 25;
  else gaps.push("Missing meta description");

  if (specs.length >= 5) score += 30;
  else if (specs.length >= 3) {
    score += 15;
    gaps.push(`Only ${specs.length} specs`);
  } else {
    gaps.push("Thin technical specs");
  }

  if ((p.description || "").trim().length >= 120) score += 20;
  else gaps.push("Short product description");

  return { specCount: specs.length, readinessScore: score, gaps };
}

export async function getQuotePriorityReport(limit = 20): Promise<QuotePriorityReport> {
  await ensureDbReady();

  const [recentEnquiries, recentWa] = await Promise.all([
    db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(500),
    db
      .select()
      .from(whatsappLogs)
      .orderBy(desc(whatsappLogs.createdAt))
      .limit(300),
  ]);

  const byProductId = new Map<number, { count: number; qty: number; lastAt: string }>();
  const bySku = new Map<string, { count: number; qty: number; lastAt: string }>();

  for (const e of recentEnquiries) {
    let items: Array<{ productId?: number; sku?: string; qty?: string }> = [];
    try {
      const parsed = JSON.parse(e.itemsJson || "[]");
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }

    for (const item of items) {
      const qtyNum = Math.max(1, Number.parseFloat(String(item.qty || "1")) || 1);
      if (item.productId && Number.isFinite(Number(item.productId))) {
        const pid = Number(item.productId);
        const cur = byProductId.get(pid) || { count: 0, qty: 0, lastAt: e.createdAt };
        cur.count += 1;
        cur.qty += qtyNum;
        if (e.createdAt > cur.lastAt) cur.lastAt = e.createdAt;
        byProductId.set(pid, cur);
      } else if (item.sku && String(item.sku).trim() && item.sku !== "CUSTOM") {
        const key = String(item.sku).trim().toUpperCase();
        const cur = bySku.get(key) || { count: 0, qty: 0, lastAt: e.createdAt };
        cur.count += 1;
        cur.qty += qtyNum;
        if (e.createdAt > cur.lastAt) cur.lastAt = e.createdAt;
        bySku.set(key, cur);
      }
    }
  }

  // Also scan WhatsApp payload snippets for product slug/SKU mentions if productId absent
  for (const w of recentWa) {
    const skuHits = (w.payloadJson || "").match(/\b(?:DMC|FESTO|KBL|TAP|MIT|FLK|BSH|SKF|NTN)-[A-Z0-9*_-]+\b/gi) || [];
    for (const rawHit of skuHits) {
      const key = rawHit.toUpperCase();
      const cur = bySku.get(key) || { count: 0, qty: 0, lastAt: w.createdAt };
      cur.count += 1;
      cur.qty += 1;
      if (w.createdAt > cur.lastAt) cur.lastAt = w.createdAt;
      bySku.set(key, cur);
    }
  }

  const matchedRows: Array<{
    product: typeof products.$inferSelect;
    brandName: string | null;
    categoryName: string | null;
    categorySlug: string | null;
    categoryId: number;
  }> = [];

  const pids = Array.from(byProductId.keys());
  const skus = Array.from(bySku.keys());

  if (pids.length > 0 || skus.length > 0) {
    const conds = [];
    if (pids.length > 0) conds.push(inArray(products.id, pids.slice(0, 200)));
    if (skus.length > 0) conds.push(inArray(products.sku, skus.slice(0, 200)));

    for (const cond of conds) {
      const rows = await db
        .select({
          product: products,
          brandName: brands.name,
          categoryName: categories.name,
          categorySlug: categories.slug,
          categoryId: products.categoryId,
        })
        .from(products)
        .leftJoin(brands, sql`${products.brandId} = ${brands.id}`)
        .leftJoin(categories, sql`${products.categoryId} = ${categories.id}`)
        .where(cond)
        .limit(limit * 2);
      matchedRows.push(...rows);
    }
  }

  // Merge strategic catalog benchmarks if quote history has fewer than limit products
  const seenIds = new Set(matchedRows.map((r) => r.product.id));
  if (seenIds.size < limit) {
    const fallbackRows = await db
      .select({
        product: products,
        brandName: brands.name,
        categoryName: categories.name,
        categorySlug: categories.slug,
        categoryId: products.categoryId,
      })
      .from(products)
      .leftJoin(brands, sql`${products.brandId} = ${brands.id}`)
      .leftJoin(categories, sql`${products.categoryId} = ${categories.id}`)
      .where(inArray(products.slug, STRATEGIC_FALLBACK_SLUGS))
      .limit(limit);

    for (const r of fallbackRows) {
      if (!seenIds.has(r.product.id)) {
        seenIds.add(r.product.id);
        matchedRows.push(r);
      }
    }
  }

  const categoryDemand = new Map<
    number,
    { categoryId: number; slug: string; name: string; enquiryCount: number }
  >();

  const topProducts: QuotePriorityProduct[] = matchedRows.map((row) => {
    const pidHit = byProductId.get(row.product.id);
    const skuHit = bySku.get(row.product.sku.toUpperCase());
    const enquiryCount = (pidHit?.count || 0) + (skuHit?.count || 0);
    const totalRequestedQty = (pidHit?.qty || 0) + (skuHit?.qty || 0);
    const lastEnquiredAt = pidHit?.lastAt || skuHit?.lastAt || null;

    if (row.categorySlug && row.categoryName) {
      const existing = categoryDemand.get(row.categoryId) || {
        categoryId: row.categoryId,
        slug: row.categorySlug,
        name: row.categoryName,
        enquiryCount: 0,
      };
      existing.enquiryCount += enquiryCount;
      categoryDemand.set(row.categoryId, existing);
    }

    const specs = parseSpecsJson(row.product.specificationsJson);
    const mpn = extractManufacturerPartNumber(row.product.sku, specs);
    const { specCount, readinessScore, gaps } = evaluateGaps(row.product);

    return {
      productId: row.product.id,
      slug: row.product.slug,
      sku: row.product.sku,
      mpn,
      name: row.product.name,
      brandName: row.brandName || "Multi-Brand",
      categoryName: row.categoryName || "General Catalog",
      categorySlug: row.categorySlug || "",
      enquiryCount,
      totalRequestedQty,
      lastEnquiredAt,
      source: enquiryCount > 0 ? "quote_history" : "strategic_catalog",
      specCount,
      hasSeoTitle: (row.product.seoTitle || "").trim().length >= 20,
      hasSeoDescription: (row.product.seoDescription || "").trim().length >= 50,
      readinessScore,
      gaps,
    };
  });

  topProducts.sort((a, b) => {
    if (b.enquiryCount !== a.enquiryCount) return b.enquiryCount - a.enquiryCount;
    return a.readinessScore - b.readinessScore;
  });

  // Get category product counts for top demanded categories
  const catStats = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(products, sql`${products.categoryId} = ${categories.id} AND ${products.isActive} = 1`)
    .groupBy(categories.id);

  const topCategories: QuotePriorityCategory[] = catStats
    .filter((c) => Number(c.productCount) > 0)
    .map((c) => ({
      categoryId: c.id,
      slug: c.slug,
      name: c.name,
      enquiryCount: categoryDemand.get(c.id)?.enquiryCount || 0,
      productCount: Number(c.productCount || 0),
    }))
    .sort((a, b) => b.enquiryCount - a.enquiryCount || b.productCount - a.productCount)
    .slice(0, 10);

  return {
    totalEnquiriesAnalyzed: recentEnquiries.length,
    totalWhatsappMessagesAnalyzed: recentWa.length,
    topProducts: topProducts.slice(0, limit),
    topCategories,
  };
}
