import React from "react";
import { sql } from "drizzle-orm";
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
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products),
    db.select({ count: sql<number>`count(*)` }).from(brands),
    db.select({ count: sql<number>`count(*)` }).from(categories),
    db.select({ count: sql<number>`count(*)` }).from(documents),
    db.select({ count: sql<number>`count(*)` }).from(enquiries),
    db.select({ count: sql<number>`count(*)` }).from(aiConversations),
    db.select({ count: sql<number>`count(*)` }).from(whatsappLogs),
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

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
          Data Import, Export &amp; Bulk Cleanup
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Export products, brands, categories, and enquiries to Excel-compatible CSV or JSON, edit in bulk, re-import to upsert, or bulk-clear records safely.
        </p>
      </div>

      <DataImportExportClient counts={counts} />
    </div>
  );
}
