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
  deletedCount: number;
  insertedCount: number;
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
      description: "Forged hand tools, spanners, torque wrenches, pliers, sockets, cutting tools, and non-sparking safety tools.",
      sourcingType: "independent",
      sourcingNote: "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      seoTitle: "Taparia Wholesale Supply | Radiant Industrial Co.",
      seoDescription: "Source genuine Taparia hand tools and industrial equipment in India through Radiant Industrial Co.",
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
  const clearExisting = options?.clearExisting ?? true;
  const { records, categorySlugById } = await buildCatalogFromDbLookups();

  if (records.length === 0) {
    throw new Error("No Taparia products were built; verify divisions and categories exist in the database.");
  }

  let deletedCount = 0;
  if (clearExisting) {
    const existingRows = await db.select({ id: products.id }).from(products);
    deletedCount = existingRows.length;
    await db.delete(products);
  }

  const CHUNK_SIZE = 50;
  let insertedCount = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    await db.insert(products).values(chunk);
    insertedCount += chunk.length;
  }

  const categoryCounts: Record<string, number> = {};
  for (const r of records) {
    const slug = categorySlugById[r.categoryId] ?? `cat-${r.categoryId}`;
    categoryCounts[slug] = (categoryCounts[slug] ?? 0) + 1;
  }

  return {
    deletedCount,
    insertedCount,
    sectionCount: ALL_TAPARIA_SECTIONS.length,
    categoryCounts,
  };
}
