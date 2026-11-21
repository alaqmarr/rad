import { db, ensureDbReady, divisions, categories, brands, products, documents } from "@/db";
import { and, asc, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";

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

export async function getCategoryBySlug(slug: string) {
  await ensureDbReady();
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);
  if (!cat) return null;

  const [division] = await db
    .select()
    .from(divisions)
    .where(and(eq(divisions.id, cat.divisionId), eq(divisions.isActive, true)))
    .limit(1);

  return { category: cat, division: division || null };
}

export async function getCategoryProductCount(categoryId: number): Promise<number> {
  await ensureDbReady();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.categoryId, categoryId), eq(products.isActive, true)));
  return Number(row?.count || 0);
}

export async function getPopulatedCategories() {
  await ensureDbReady();
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      divisionId: categories.divisionId,
    })
    .from(categories)
    .innerJoin(products, and(eq(products.categoryId, categories.id), eq(products.isActive, true)))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryTopBrands(categoryId: number, limit = 16) {
  await ensureDbReady();
  const rows = await db.all<{
    id: number;
    slug: string;
    name: string;
    logo_url: string | null;
    cnt: number;
  }>(
    sql`SELECT b.id, b.slug, b.name, b.logo_url, COUNT(p.id) as cnt
        FROM products p
        JOIN brands b ON b.id = p.brand_id
        WHERE p.category_id = ${categoryId} AND p.is_active = 1 AND b.is_active = 1
        GROUP BY b.id
        ORDER BY cnt DESC, b.name ASC
        LIMIT ${limit}`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    logoUrl: r.logo_url,
    productCount: Number(r.cnt || 0),
  }));
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

export async function getActiveBrandsWithMeta() {
  await ensureDbReady();
  const [brandsList, countRows, divRows] = await Promise.all([
    db
      .select()
      .from(brands)
      .where(eq(brands.isActive, true))
      .orderBy(asc(brands.sortOrder), asc(brands.name)),
    db.all<{ brand_id: number; cnt: number }>(
      sql`SELECT brand_id, COUNT(*) as cnt FROM products WHERE is_active = 1 AND brand_id IS NOT NULL GROUP BY brand_id`
    ),
    db.all<{ brand_id: number; div_slug: string; div_name: string }>(
      sql`SELECT DISTINCT p.brand_id as brand_id, d.slug as div_slug, d.name as div_name
          FROM products p
          JOIN divisions d ON d.id = p.division_id
          WHERE p.is_active = 1 AND p.brand_id IS NOT NULL`
    ),
  ]);

  const countsMap = new Map<number, number>();
  for (const r of countRows) countsMap.set(Number(r.brand_id), Number(r.cnt || 0));

  const divMap = new Map<number, Array<{ slug: string; name: string }>>();
  for (const r of divRows) {
    const id = Number(r.brand_id);
    const list = divMap.get(id) || [];
    list.push({ slug: r.div_slug, name: r.div_name });
    divMap.set(id, list);
  }

  return brandsList.map((b) => ({
    ...b,
    productCount: countsMap.get(b.id) || 0,
    divisions: divMap.get(b.id) || [],
  }));
}

export async function getActiveProductCount(): Promise<number> {
  await ensureDbReady();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.isActive, true));
  return Number(row?.count || 0);
}

export async function getSitemapProductBatch(limit: number, offset: number) {
  await ensureDbReady();
  return db
    .select({
      slug: products.slug,
      updatedAt: products.updatedAt,
      primaryImageUrl: products.primaryImageUrl,
      divisionHeroUrl: divisions.heroImageUrl,
    })
    .from(products)
    .leftJoin(divisions, eq(products.divisionId, divisions.id))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.id))
    .limit(limit)
    .offset(offset);
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

  const trimmedQ = filters.q?.trim();
  const qLower = trimmedQ ? trimmedQ.toLowerCase().replace(/\s+/g, " ") : "";

  const runSelect = (extraConds: typeof baseConditions) => {
    const baseQuery = db
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
      .where(and(...baseConditions, ...extraConds));

    if (qLower) {
      return baseQuery
        .orderBy(
          sql`CASE WHEN lower(${products.sku}) = ${qLower} OR lower(${products.sku}) LIKE ${`%-${qLower}`} OR lower(${products.sku}) LIKE ${`%-${qLower}*`} THEN 0 WHEN lower(${products.sku}) LIKE ${`%${qLower}%`} THEN 1 WHEN lower(${products.name}) LIKE ${`%${qLower}%`} THEN 2 ELSE 3 END`,
          desc(products.isFeatured),
          asc(products.name)
        )
        .limit(filters.limit ?? 100)
        .offset(filters.offset ?? 0);
    }

    return baseQuery
      .orderBy(desc(products.isFeatured), asc(products.name))
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0);
  };

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

export async function getProductsBySlugs(slugs: string[]) {
  if (!slugs.length) return [];
  await ensureDbReady();
  const rows = await db
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
    .where(and(inArray(products.slug, slugs), eq(products.isActive, true)));

  const bySlug = new Map(rows.map((r) => [r.product.slug, r]));
  return slugs.map((s) => bySlug.get(s)).filter((r): r is NonNullable<typeof r> => Boolean(r));
}

export async function getCompatibleAndRelatedProducts(params: {
  productId: number;
  brandId: number | null;
  categoryId: number;
  referencedCodes: string[];
  limit?: number;
}) {
  await ensureDbReady();
  const maxItems = params.limit ?? 8;
  const collected: Array<{
    product: typeof products.$inferSelect;
    brand: typeof brands.$inferSelect | null;
    matchReason: "compatible" | "related";
  }> = [];
  const seenIds = new Set<number>([params.productId]);

  if (params.referencedCodes.length > 0) {
    const codeConds = params.referencedCodes.slice(0, 10).map((code) => {
      const upper = code.toUpperCase();
      return or(
        sql`upper(${products.sku}) = ${upper}`,
        sql`upper(${products.sku}) LIKE ${`%-${upper}`}`,
        sql`upper(${products.sku}) LIKE ${`%-${upper}%`}`
      );
    });

    const compatRows = await db
      .select({
        product: products,
        brand: brands,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(
        and(
          eq(products.isActive, true),
          ne(products.id, params.productId),
          ...(params.brandId ? [eq(products.brandId, params.brandId)] : []),
          or(...codeConds)
        )
      )
      .orderBy(asc(sql`length(${products.sku})`), asc(products.name))
      .limit(maxItems);

    for (const r of compatRows) {
      if (!seenIds.has(r.product.id) && collected.length < maxItems) {
        seenIds.add(r.product.id);
        collected.push({ ...r, matchReason: "compatible" });
      }
    }
  }

  if (collected.length < maxItems) {
    const fillRows = await db
      .select({
        product: products,
        brand: brands,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(
        and(
          eq(products.isActive, true),
          ne(products.id, params.productId),
          eq(products.categoryId, params.categoryId),
          ...(params.brandId ? [eq(products.brandId, params.brandId)] : [])
        )
      )
      .orderBy(desc(products.isFeatured), asc(products.name))
      .limit(maxItems * 2);

    for (const r of fillRows) {
      if (!seenIds.has(r.product.id) && collected.length < maxItems) {
        seenIds.add(r.product.id);
        collected.push({ ...r, matchReason: "related" });
      }
    }
  }

  return collected;
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
