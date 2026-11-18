import React from "react";
import { asc } from "drizzle-orm";
import { db, brands, categories, divisions } from "@/db";
import { BrandsManager } from "@/components/BrandsManager";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const [allBrands, allCategories, allDivisions] = await Promise.all([
    db.select().from(brands).orderBy(asc(brands.sortOrder), asc(brands.name)),
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).orderBy(asc(divisions.sortOrder)),
  ]);

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
          Sourced Brands &amp; Categories
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Manage manufacturer listings, mark independent vs. authorized status transparently, and upload brand logos to R2.
        </p>
      </div>

      <BrandsManager
        brands={allBrands}
        categories={allCategories}
        divisions={allDivisions}
      />
    </div>
  );
}
