import React from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, products, brands, categories, divisions } from "@/db";
import { CatalogueStudioClient } from "@/components/CatalogueStudioClient";

export const dynamic = "force-dynamic";

export default async function AdminCataloguePage() {
  const [brandRows, categoryRows, productCountsByBrand, productCountsByCat, [totalRow], [featuredRow], defaultProducts] =
    await Promise.all([
      db
        .select()
        .from(brands)
        .where(eq(brands.isActive, true))
        .orderBy(asc(brands.name)),
      db
        .select({
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          divisionName: divisions.name,
        })
        .from(categories)
        .leftJoin(divisions, eq(categories.divisionId, divisions.id))
        .where(eq(categories.isActive, true))
        .orderBy(asc(divisions.sortOrder), asc(categories.sortOrder)),
      db
        .select({
          brandId: products.brandId,
          count: sql<number>`count(*)`,
        })
        .from(products)
        .where(eq(products.isActive, true))
        .groupBy(products.brandId),
      db
        .select({
          categoryId: products.categoryId,
          count: sql<number>`count(*)`,
        })
        .from(products)
        .where(eq(products.isActive, true))
        .groupBy(products.categoryId),
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.isActive, true)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.isFeatured, true))),
      db
        .select({
          id: products.id,
          slug: products.slug,
          sku: products.sku,
          name: products.name,
          brandName: brands.name,
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(brands, eq(products.brandId, brands.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(eq(products.isActive, true))
        .orderBy(desc(products.isFeatured), asc(products.name))
        .limit(25),
    ]);

  const brandCountMap = new Map(productCountsByBrand.map((r) => [r.brandId, Number(r.count || 0)]));
  const catCountMap = new Map(productCountsByCat.map((r) => [r.categoryId, Number(r.count || 0)]));

  const brandsWithCounts = brandRows
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      logoUrl: b.logoUrl,
      countryOfOrigin: b.countryOfOrigin,
      productCount: brandCountMap.get(b.id) || 0,
    }))
    .filter((b) => b.productCount > 0);

  const categoriesWithCounts = categoryRows
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      divisionName: c.divisionName || "Industrial",
      productCount: catCountMap.get(c.id) || 0,
    }))
    .filter((c) => c.productCount > 0);

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#141A21] tracking-tight">
          Branded Catalogue Studio (PDF &amp; Interactive HTML)
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Export inter-page linked Brand Catalogues, Category Catalogues, Master Catalogues, and Single-SKU Datasheets styled on Radiant Industrial Co.&apos;s official business template.
        </p>
      </div>

      <CatalogueStudioClient
        brands={brandsWithCounts}
        categories={categoriesWithCounts}
        totalProducts={Number(totalRow?.count || 0)}
        featuredProductsCount={Number(featuredRow?.count || 0)}
        defaultProducts={defaultProducts}
      />
    </div>
  );
}
