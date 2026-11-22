import React from "react";
import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  products,
  brands,
  categories,
  documents,
  enquiries,
  aiConversations,
  whatsappLogs,
} from "@/db";
import { getSiteSettings } from "@/lib/settings";
import { DataImportExportClient } from "@/components/DataImportExportClient";

export const dynamic = "force-dynamic";

export default async function AdminDataPage() {
  const [
    [prodCount],
    [brandCount],
    [catCount],
    [docCount],
    [enqCount],
    [aiCount],
    [waCount],
    activeBrands,
    activeCategories,
    settings,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products),
    db.select({ count: sql<number>`count(*)` }).from(brands),
    db.select({ count: sql<number>`count(*)` }).from(categories),
    db.select({ count: sql<number>`count(*)` }).from(documents),
    db.select({ count: sql<number>`count(*)` }).from(enquiries),
    db.select({ count: sql<number>`count(*)` }).from(aiConversations),
    db.select({ count: sql<number>`count(*)` }).from(whatsappLogs),
    db
      .select({ slug: brands.slug, name: brands.name })
      .from(brands)
      .where(eq(brands.isActive, true))
      .orderBy(asc(brands.name)),
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.name)),
    getSiteSettings(),
  ]);

  const counts = {
    products: Number(prodCount?.count || 0),
    brands: Number(brandCount?.count || 0),
    categories: Number(catCount?.count || 0),
    documents: Number(docCount?.count || 0),
    enquiries: Number(enqCount?.count || 0),
    ai_conversations: Number(aiCount?.count || 0),
    whatsapp_logs: Number(waCount?.count || 0),
  };

  const defaultCompanyName = settings["company_name"] || "Radiant Industrial Co.";
  const defaultCompanyContact = [
    settings["contact_address"] ||
      "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India",
    settings["contact_phone"] || "",
    settings["contact_email"] || "",
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
          Data Import, Export &amp; Bulk Cleanup
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Export products, brands, categories, and enquiries to Excel-compatible CSV or JSON, download Justdial upload-ready CSVs, or bulk-import updates.
        </p>
      </div>

      <DataImportExportClient
        counts={counts}
        justdialBrands={activeBrands}
        justdialCategories={activeCategories}
        defaultCompanyName={defaultCompanyName}
        defaultCompanyContact={defaultCompanyContact}
      />
    </div>
  );
}
