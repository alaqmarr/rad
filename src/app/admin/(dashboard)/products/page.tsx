import React from "react";
import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { FileSpreadsheet } from "lucide-react";
import { db, products, divisions, categories, brands } from "@/db";
import { ProductsManager } from "@/components/ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [allProducts, allDivisions, allCategories, allBrands] = await Promise.all([
    db.select().from(products).orderBy(desc(products.updatedAt)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).orderBy(asc(divisions.sortOrder)),
    db.select({ id: categories.id, name: categories.name, divisionId: categories.divisionId }).from(categories).orderBy(asc(categories.sortOrder)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
  ]);

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
            Products &amp; Wholesale Pricing
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Set fixed wholesale rates where confirmed or leave items as Request Quote. Upload product media directly to Cloudflare R2.
          </p>
        </div>

        <Link
          href="/admin/data#justdial-export"
          className="inline-flex items-center gap-2 rounded bg-[#141A21] px-4 py-2 text-xs font-bold text-white hover:bg-[#C24D00] transition-colors shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Catalog for Justdial
        </Link>
      </div>

      <ProductsManager
        products={allProducts}
        divisions={allDivisions}
        categories={allCategories}
        brands={allBrands}
      />
    </div>
  );
}
