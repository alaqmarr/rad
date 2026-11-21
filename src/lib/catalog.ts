import { db, ensureDbReady, divisions, categories, brands, products, documents } from "@/db";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";

let cachedFtsAvailable: boolean | null = null;

export function buildFtsMatchExpr(rawQuery: string): string | null {
  const tokens = rawQuery.trim().match(/[a-zA-Z0-9]+/g);
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" AND ");
}

export async function hasProductsFts(): Promise<boolean> {
  if (cachedFtsAvailable === true) return true;
  try {
    const [row] = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='products_fts' LIMIT 1`
    );
    cachedFtsAvailable = Boolean(row?.name);
    return cachedFtsAvailable;
  } catch {
    return false;
  }
}

export interface ProductFilterParams {
  q?: string;
  division?: string;
  category?: string;
  brand?: string;
  pricing?: "all" | "priced" | "rfq_only";
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function getActiveDivisions() {
  await ensureDbReady();
  return db
    .select()
    .from(divisions)
    .where(eq(divisions.isActive, true))
    .orderBy(asc(divisions.sortOrder), asc(divisions.name));
}

export async function getDivisionBySlug(slug: string) {
  await ensureDbReady();
  const [div] = await db
    .select()
    .from(divisions)
    .where(and(eq(divisions.slug, slug), eq(divisions.isActive, true)))
    .limit(1);
  return div || null;
}

export async function getActiveCategories(divisionId?: number) {
  await ensureDbReady();
  const conditions = [eq(categories.isActive, true)];
  if (divisionId) conditions.push(eq(categories.divisionId, divisionId));
  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getActiveBrands(featuredOnly = false) {
  await ensureDbReady();
  const conditions = [eq(brands.isActive, true)];
  if (featuredOnly) conditions.push(eq(brands.isFeatured, true));
  return db
    .select()
    .from(brands)
    .where(and(...conditions))
    .orderBy(asc(brands.sortOrder), asc(brands.name));
}

export async function getBrandBySlug(slug: string) {
  await ensureDbReady();
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.slug, slug), eq(brands.isActive, true)))
    .limit(1);
  return brand || null;
}

export async function queryProducts(filters: ProductFilterParams = {}) {
  await ensureDbReady();
  const baseConditions = [eq(products.isActive, true)];

  if (filters.division) {
    const [div] = await db
      .select({ id: divisions.id })
      .from(divisions)
      .where(eq(divisions.slug, filters.division))
      .limit(1);
    if (div) {
      baseConditions.push(eq(products.divisionId, div.id));
    } else {
      return [];
    }
  }

  if (filters.category) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, filters.category))
      .limit(1);
    if (cat) {
      baseConditions.push(eq(products.categoryId, cat.id));
    } else {
      return [];
    }
  }

  if (filters.brand) {
    const [br] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, filters.brand))
      .limit(1);
    if (br) {
      baseConditions.push(eq(products.brandId, br.id));
    } else {
      return [];
    }
  }

  if (filters.pricing === "priced") {
    baseConditions.push(eq(products.pricingMode, "priced"));
  } else if (filters.pricing === "rfq_only") {
    baseConditions.push(eq(products.pricingMode, "rfq_only"));
  }

  if (filters.featuredOnly) {
    baseConditions.push(eq(products.isFeatured, true));
  }

  const runSelect = (extraConds: typeof baseConditions) =>
    db
      .select({
        product: products,
        division: divisions,
        category: categories,
        brand: brands,
      })
      .from(products)
      .leftJoin(divisions, eq(products.divisionId, divisions.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(and(...baseConditions, ...extraConds))
      .orderBy(desc(products.isFeatured), asc(products.name))
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0);

  const trimmedQ = filters.q?.trim();
  if (trimmedQ) {
    const ftsExpr = buildFtsMatchExpr(trimmedQ);
    if (ftsExpr && (await hasProductsFts())) {
      const ftsRows = await runSelect([
        sql`${products.id} IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ${ftsExpr})`,
      ]);
      if (ftsRows.length > 0 || trimmedQ.length < 3) {
        return ftsRows;
      }
    }

    const pattern = `%${trimmedQ}%`;
    const searchCond = or(
      like(products.name, pattern),
      like(products.sku, pattern),
      like(products.shortDescription, pattern),
      like(products.description, pattern),
      like(products.hsnCode, pattern)
    );
    return runSelect(searchCond ? [searchCond] : []);
  }

  return runSelect([]);
}

export async function getProductBySlug(slug: string) {
  await ensureDbReady();
  const [row] = await db
    .select({
      product: products,
      division: divisions,
      category: categories,
      brand: brands,
    })
    .from(products)
    .leftJoin(divisions, eq(products.divisionId, divisions.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  if (!row) return null;

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.isPublic, true), eq(documents.productId, row.product.id)));

  return { ...row, documents: docs };
}

export async function getPublicDocuments(categoryFilter?: string) {
  const conditions = [eq(documents.isPublic, true)];
  if (categoryFilter && categoryFilter !== "all") {
    conditions.push(eq(documents.category, categoryFilter));
  }

  return db
    .select({
      document: documents,
      brand: brands,
      product: products,
      division: divisions,
    })
    .from(documents)
    .leftJoin(brands, eq(documents.brandId, brands.id))
    .leftJoin(products, eq(documents.productId, products.id))
    .leftJoin(divisions, eq(documents.divisionId, divisions.id))
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));
}

export async function getCatalogSummaryCounts() {
  await ensureDbReady();
  const [prodCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.isActive, true));
  const [brandCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(brands)
    .where(eq(brands.isActive, true));
  const [docCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(eq(documents.isPublic, true));
  const [divCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(divisions)
    .where(eq(divisions.isActive, true));

  return {
    products: Number(prodCount?.count || 0),
    brands: Number(brandCount?.count || 0),
    documents: Number(docCount?.count || 0),
    divisions: Number(divCount?.count || 0),
  };
}
