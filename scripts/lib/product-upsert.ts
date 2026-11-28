import { eq } from "drizzle-orm";
import { db, products } from "../../src/db";
import { htmlToCleanText } from "../../src/lib/sanitize-text";

export interface UpsertProductCandidate {
  sku: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  divisionId: number;
  categoryId: number;
  brandId: number;
  pricingMode?: string;
  basePrice?: number | null;
  priceUnit?: string;
  gstPercent?: number;
  moq?: string;
  leadTime?: string;
  hsnCode?: string;
  specifications?: Array<{ label: string; value: string }>;
  primaryImageUrl?: string | null;
  gallery?: string[];
  inStockStatus?: string;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
  withImages: number;
}

const PLACEHOLDER_IMG_RE = /placeholder|no[-_]?image|default[-_]?img|seek-logo/i;

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"*®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeSku(prefix: string, rawCode: string): string {
  const clean = rawCode
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const full = clean.startsWith(`${prefix}-`) ? clean : `${prefix}-${clean}`;
  return full.slice(0, 58);
}

export function isUsableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_IMG_RE.test(trimmed)) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
}

function mergeSpecs(
  existingJson: string,
  incoming: Array<{ label: string; value: string }>
): { json: string; changed: boolean } {
  let existing: Array<{ label: string; value: string }> = [];
  try {
    const parsed = JSON.parse(existingJson || "[]");
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    existing = [];
  }

  const byKey = new Map<string, { label: string; value: string }>();
  for (const s of existing) {
    if (s?.label && s?.value) {
      byKey.set(s.label.trim().toLowerCase(), {
        label: s.label.trim(),
        value: String(s.value).trim(),
      });
    }
  }

  let changed = false;
  for (const s of incoming) {
    if (!s?.label || !s?.value) continue;
    const key = s.label.trim().toLowerCase();
    const val = String(s.value).trim();
    if (!val) continue;
    const prev = byKey.get(key);
    if (!prev || (val.length > prev.value.length && prev.value.length < 4)) {
      byKey.set(key, { label: s.label.trim(), value: val });
      changed = true;
    }
  }

  return { json: JSON.stringify([...byKey.values()]), changed };
}

function mergeGallery(
  existingJson: string,
  incoming: string[]
): { json: string; changed: boolean } {
  let existing: string[] = [];
  try {
    const parsed = JSON.parse(existingJson || "[]");
    if (Array.isArray(parsed)) existing = parsed.filter(isUsableImageUrl);
  } catch {
    existing = [];
  }

  const seen = new Set(existing);
  let changed = false;
  for (const u of incoming) {
    if (isUsableImageUrl(u) && !seen.has(u) && seen.size < 6) {
      seen.add(u);
      changed = true;
    }
  }
  return { json: JSON.stringify([...seen]), changed };
}

/**
 * Smart non-destructive upsert:
 * - Inserts new products when SKU & normalized name don't exist yet for that brand.
 * - Updates existing products when incoming live data provides missing images,
 *   richer descriptions, new specifications, HSN code, or gallery photos.
 * - Never overwrites admin-curated pricing or deletes valid existing data.
 */
export async function upsertBrandProducts(
  brandId: number,
  candidates: UpsertProductCandidate[]
): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0, withImages: 0 };
  if (candidates.length === 0) return stats;

  const allExisting = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      brandId: products.brandId,
      shortDescription: products.shortDescription,
      description: products.description,
      hsnCode: products.hsnCode,
      specificationsJson: products.specificationsJson,
      primaryImageUrl: products.primaryImageUrl,
      galleryJson: products.galleryJson,
      leadTime: products.leadTime,
    })
    .from(products);

  const bySku = new Map<string, (typeof allExisting)[number]>();
  const byBrandNormName = new Map<string, (typeof allExisting)[number]>();
  const usedSlugs = new Set<string>();

  for (const row of allExisting) {
    bySku.set(row.sku.toUpperCase(), row);
    usedSlugs.add(row.slug);
    if (row.brandId === brandId) {
      byBrandNormName.set(toSlug(row.name), row);
    }
  }

  const toInsert: Array<typeof products.$inferInsert> = [];
  const seenCandidateSkus = new Set<string>();
  const seenCandidateNames = new Set<string>();

  for (const raw of candidates) {
    const cleanName = htmlToCleanText(raw.name, true);
    if (!cleanName || cleanName.length < 3) continue;

    const skuUpper = raw.sku.trim().toUpperCase();
    const normNameKey = toSlug(cleanName);
    if (seenCandidateSkus.has(skuUpper) || seenCandidateNames.has(normNameKey)) continue;
    seenCandidateSkus.add(skuUpper);
    seenCandidateNames.add(normNameKey);

    const cleanShort = htmlToCleanText(raw.shortDescription, true).slice(0, 220);
    const cleanDesc = htmlToCleanText(raw.description, false);
    const img = isUsableImageUrl(raw.primaryImageUrl) ? raw.primaryImageUrl!.trim() : null;
    const gallery = (raw.gallery || []).filter(isUsableImageUrl);
    const specs = raw.specifications || [];

    const existing = bySku.get(skuUpper) || byBrandNormName.get(normNameKey);
    if (existing) {
      const patch: Partial<typeof products.$inferInsert> = {};
      let needsUpdate = false;

      if (!isUsableImageUrl(existing.primaryImageUrl) && img) {
        patch.primaryImageUrl = img;
        needsUpdate = true;
      }
      if (cleanDesc.length > (existing.description || "").length + 40) {
        patch.description = cleanDesc;
        needsUpdate = true;
      }
      if (cleanShort.length > (existing.shortDescription || "").length + 25) {
        patch.shortDescription = cleanShort;
        needsUpdate = true;
      }
      if (!existing.hsnCode && raw.hsnCode) {
        patch.hsnCode = raw.hsnCode;
        needsUpdate = true;
      }
      if (existing.leadTime !== "Confirmed Upon Order") {
        patch.leadTime = "Confirmed Upon Order";
        needsUpdate = true;
      }
      const mergedSpecs = mergeSpecs(existing.specificationsJson, specs);
      if (mergedSpecs.changed) {
        patch.specificationsJson = mergedSpecs.json;
        needsUpdate = true;
      }
      const mergedGallery = mergeGallery(existing.galleryJson, gallery);
      if (mergedGallery.changed) {
        patch.galleryJson = mergedGallery.json;
        needsUpdate = true;
      }

      if (needsUpdate) {
        patch.updatedAt = new Date().toISOString();
        await db.update(products).set(patch).where(eq(products.id, existing.id));
        stats.updated++;
      } else {
        stats.skipped++;
      }
      if (patch.primaryImageUrl || isUsableImageUrl(existing.primaryImageUrl)) {
        stats.withImages++;
      }
      continue;
    }

    let safeSlug = toSlug(raw.slug || cleanName);
    if (!safeSlug) safeSlug = toSlug(skuUpper);
    if (usedSlugs.has(safeSlug)) {
      let n = 2;
      while (usedSlugs.has(`${safeSlug}-${n}`)) n++;
      safeSlug = `${safeSlug}-${n}`;
    }
    usedSlugs.add(safeSlug);

    toInsert.push({
      slug: safeSlug,
      sku: skuUpper,
      name: cleanName,
      shortDescription: cleanShort || `${cleanName} — Industrial B2B Supply by Radiant Industrial Co.`,
      description: cleanDesc || cleanShort || cleanName,
      divisionId: raw.divisionId,
      categoryId: raw.categoryId,
      brandId: raw.brandId,
      pricingMode: raw.pricingMode || "rfq_only",
      basePrice: raw.basePrice ?? null,
      priceUnit: raw.priceUnit || "NOS",
      gstPercent: raw.gstPercent ?? 18,
      moq: raw.moq || "1 NOS",
      leadTime: "Confirmed Upon Order",
      hsnCode: raw.hsnCode || "",
      specificationsJson: JSON.stringify(specs),
      primaryImageUrl: img,
      galleryJson: JSON.stringify(gallery.slice(0, 6)),
      inStockStatus: raw.inStockStatus || "Available to Order",
      isFeatured: raw.isFeatured ?? false,
      isActive: true,
      seoTitle: raw.seoTitle || `${cleanName} | Radiant Industrial Co.`,
      seoDescription: raw.seoDescription || cleanShort || cleanName,
    });
    if (img) stats.withImages++;
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }
  stats.inserted = toInsert.length;

  return stats;
}
