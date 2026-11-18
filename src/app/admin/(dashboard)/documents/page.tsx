import React from "react";
import { asc, desc } from "drizzle-orm";
import { db, documents, products, brands } from "@/db";
import { DocumentsManager } from "@/components/DocumentsManager";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  const [allDocs, allProducts, allBrands] = await Promise.all([
    db.select().from(documents).orderBy(desc(documents.createdAt)),
    db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).orderBy(asc(products.name)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
  ]);

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
          Technical Documents &amp; Catalogs (R2)
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Upload product datasheets, brand PDFs, compliance records, and company vendor documents using React Dropzone + Cloudflare R2.
        </p>
      </div>

      <DocumentsManager
        documents={allDocs}
        products={allProducts}
        brands={allBrands}
      />
    </div>
  );
}
