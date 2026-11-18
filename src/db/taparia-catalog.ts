import { eq } from "drizzle-orm";
import { brands, categories, db, divisions, products } from "./index";
import { TAPARIA_SECTIONS_PART1 } from "./taparia-data-1";
import { TAPARIA_SECTIONS_PART2 } from "./taparia-data-2";
import { TAPARIA_SECTIONS_PART3 } from "./taparia-data-3";
import { TAPARIA_SECTIONS_PART4 } from "./taparia-data-4";
import { buildTapariaProducts, type BuiltProductRecord } from "./taparia-types";

export const ALL_TAPARIA_SECTIONS = [
  ...TAPARIA_SECTIONS_PART1,
  ...TAPARIA_SECTIONS_PART2,
  ...TAPARIA_SECTIONS_PART3,
  ...TAPARIA_SECTIONS_PART4,
];

export interface LoadTapariaResult {
  existingBeforeCount: number;
  deletedCount: number;
  insertedCount: number;
  updatedCount: number;
  totalAfterCount: number;
  sectionCount: number;
  categoryCounts: Record<string, number>;
}

async function ensureTapariaBrand(): Promise<number | null> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "taparia"));
  if (existing) {
    if (!existing.isFeatured) {
      await db.update(brands).set({ isFeatured: true }).where(eq(brands.id, existing.id));
    }
    return existing.id;
  }

  await db
    .insert(brands)
    .values({
      slug: "taparia",
      name: "Taparia",
      countryOfOrigin: "India",
      isFeatured: true,
      sortOrder: 14,
      description:
        "Forged hand tools, spanners, torque wrenches, pliers, sockets, cutting tools, and non-sparking safety tools.",
      sourcingType: "independent",
      sourcingNote:
        "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      seoTitle: "Taparia Wholesale Supply | Radiant Industrial Co.",
      seoDescription:
        "Source genuine Taparia hand tools and industrial equipment in India through Radiant Industrial Co.",
    })
    .onConflictDoNothing({ target: brands.slug });

  const [created] = await db.select().from(brands).where(eq(brands.slug, "taparia"));
  return created?.id ?? null;
}

export async function buildCatalogFromDbLookups(): Promise<{
  records: BuiltProductRecord[];
  categorySlugById: Record<number, string>;
}> {
  const allDivisions = await db.select().from(divisions);
  const allCategories = await db.select().from(categories);
  const tapariaBrandId = await ensureTapariaBrand();

  const divisionBySlug: Record<string, number> = {};
  for (const d of allDivisions) {
    divisionBySlug[d.slug] = d.id;
  }

  const categoryBySlug: Record<string, { id: number; divisionId: number }> = {};
  const categorySlugById: Record<number, string> = {};
  for (const c of allCategories) {
    categoryBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };
    categorySlugById[c.id] = c.slug;
  }

  const records = buildTapariaProducts(ALL_TAPARIA_SECTIONS, {
    divisionBySlug,
    categoryBySlug,
    tapariaBrandId,
  });

  return { records, categorySlugById };
}

export async function replaceCatalogWithTapariaPdf(options?: {
  clearExisting?: boolean;
}): Promise<LoadTapariaResult> {
  const clearExisting = options?.clearExisting ?? false;
  const { records, categorySlugById } = await buildCatalogFromDbLookups();

  if (records.length === 0) {
    throw new Error(
      "No Taparia products were built; verify divisions and categories exist in the database."
    );
  }

  const existingRows = await db
    .select({ id: products.id, sku: products.sku, slug: products.slug })
    .from(products);
  const existingBeforeCount = existingRows.length;

  let deletedCount = 0;
  if (clearExisting && existingBeforeCount > 0) {
    deletedCount = existingBeforeCount;
    await db.delete(products);
  }

  const existingBySku = new Map<string, { id: number; slug: string }>();
  const existingBySlug = new Map<string, { id: number; sku: string }>();
  const takenSlugs = new Set<string>();
  const takenSkus = new Set<string>();

  if (!clearExisting) {
    for (const row of existingRows) {
      existingBySku.set(row.sku, { id: row.id, slug: row.slug });
      existingBySlug.set(row.slug, { id: row.id, sku: row.sku });
      takenSlugs.add(row.slug);
      takenSkus.add(row.sku);
    }
  }

  const toInsert: BuiltProductRecord[] = [];
  const toUpdate: Array<{ id: number; record: BuiltProductRecord }> = [];

  for (const record of records) {
    const matchBySku = existingBySku.get(record.sku);
    if (matchBySku) {
      // Update existing matching Taparia SKU without disturbing other catalog rows
      toUpdate.push({
        id: matchBySku.id,
        record: { ...record, slug: matchBySku.slug },
      });
      continue;
    }

    const matchBySlug = existingBySlug.get(record.slug);
    if (matchBySlug && matchBySlug.sku.startsWith("TAP-")) {
      toUpdate.push({ id: matchBySlug.id, record });
      continue;
    }

    // Ensure unique slug/SKU against any custom existing products on the server
    let safeSlug = record.slug;
    if (takenSlugs.has(safeSlug)) {
      let suffix = 2;
      while (takenSlugs.has(`${safeSlug}-tap-${suffix}`)) suffix++;
      safeSlug = `${safeSlug}-tap-${suffix}`;
    }

    let safeSku = record.sku;
    if (takenSkus.has(safeSku)) {
      let suffix = 2;
      while (takenSkus.has(`${safeSku}-${suffix}`)) suffix++;
      safeSku = `${safeSku}-${suffix}`;
    }

    takenSlugs.add(safeSlug);
    takenSkus.add(safeSku);
    toInsert.push({ ...record, slug: safeSlug, sku: safeSku });
  }

  let updatedCount = 0;
  for (const item of toUpdate) {
    await db
      .update(products)
      .set({
        name: item.record.name,
        shortDescription: item.record.shortDescription,
        description: item.record.description,
        divisionId: item.record.divisionId,
        categoryId: item.record.categoryId,
        brandId: item.record.brandId,
        pricingMode: item.record.pricingMode,
        basePrice: item.record.basePrice,
        priceUnit: item.record.priceUnit,
        gstPercent: item.record.gstPercent,
        moq: item.record.moq,
        leadTime: item.record.leadTime,
        hsnCode: item.record.hsnCode,
        specificationsJson: item.record.specificationsJson,
        inStockStatus: item.record.inStockStatus,
        isFeatured: item.record.isFeatured,
        isActive: item.record.isActive,
        seoTitle: item.record.seoTitle,
        seoDescription: item.record.seoDescription,
      })
      .where(eq(products.id, item.id));
    updatedCount++;
  }

  const CHUNK_SIZE = 50;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(products).values(chunk);
    insertedCount += chunk.length;
  }

  const categoryCounts: Record<string, number> = {};
  for (const r of records) {
    const slug = categorySlugById[r.categoryId] ?? `cat-${r.categoryId}`;
    categoryCounts[slug] = (categoryCounts[slug] ?? 0) + 1;
  }

  const totalAfterRows = await db.select({ id: products.id }).from(products);

  return {
    existingBeforeCount,
    deletedCount,
    insertedCount,
    updatedCount,
    totalAfterCount: totalAfterRows.length,
    sectionCount: ALL_TAPARIA_SECTIONS.length,
    categoryCounts,
  };
}
