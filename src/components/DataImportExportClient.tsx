"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Download, UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { sileo } from "sileo";
import { purgeEntityDataAction, type PurgeEntityType } from "@/app/admin/actions";
import { JustdialExportPanel, type JustdialFilterOption } from "@/components/JustdialExportPanel";

export function DataImportExportClient({
  counts,
  justdialBrands,
  justdialCategories,
  defaultCompanyName,
  defaultCompanyContact,
}: {
  counts: Record<PurgeEntityType, number>;
  justdialBrands: JustdialFilterOption[];
  justdialCategories: JustdialFilterOption[];
  defaultCompanyName: string;
  defaultCompanyContact: string;
}) {
  const router = useRouter();
  const [entity, setEntity] = useState<"products" | "brands" | "categories">("products");
  const [uploading, setUploading] = useState(false);
  const [purging, setPurging] = useState<PurgeEntityType | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    errors: string[];
  } | null>(null);

  const handlePurge = async (target: PurgeEntityType, label: string, count: number) => {
    if (count === 0) {
      sileo.info({ title: "Already Empty", description: `No ${label.toLowerCase()} to delete.` });
      return;
    }
    if (
      !confirm(
        `Delete ALL ${count} record(s) from "${label}" permanently? Export a JSON/CSV backup first if needed.`
      )
    ) {
      return;
    }
    setPurging(target);
    try {
      const res = await purgeEntityDataAction(target);
      router.refresh();
      sileo.success({
        title: `${label} Cleared`,
        description: `Deleted ${res.deleted} record(s).`,
      });
    } catch (err) {
      sileo.error({
        title: `Cannot Clear ${label}`,
        description: err instanceof Error ? err.message : "Operation failed",
      });
    } finally {
      setPurging(null);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      setResult(null);

      try {
        const fd = new FormData();
        fd.append("entity", entity);
        fd.append("file", file);

        const res = await fetch("/api/admin/import", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");

        setResult({
          inserted: data.inserted || 0,
          updated: data.updated || 0,
          errors: data.errors || [],
        });
        router.refresh();
        sileo.success({
          title: "Data Imported",
          description: `${data.inserted} added, ${data.updated} updated.`,
        });
      } catch (err) {
        sileo.error({
          title: "Import Error",
          description: err instanceof Error ? err.message : "Could not import file",
        });
      } finally {
        setUploading(false);
      }
    },
    [entity, router]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "text/csv": [".csv"],
      "application/json": [".json"],
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Export Panel */}
      <div className="lg:col-span-6 rounded-md border border-[#E4E4E0] bg-white p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#141A21]">Export Data (CSV / JSON)</h2>
          <p className="text-xs text-stone-600 mt-1">
            Download spreadsheets directly for Excel editing, price updates, or full database backup.
          </p>
        </div>

        <div className="divide-y divide-stone-200 border border-stone-200 rounded-md">
          {[
            {
              title: "Products Catalog",
              desc: "All SKUs, descriptions, division/category/brand slugs, prices, HSN, GST, and specs.",
              csvUrl: "/api/admin/export?entity=products&format=csv",
              jsonUrl: "/api/admin/export?entity=products&format=json",
              templateUrl: "/api/admin/export?entity=products&template=1&format=csv",
            },
            {
              title: "Sourced Brands",
              desc: "All brand names, origin, independent/authorized status, logos, and thumbnails.",
              csvUrl: "/api/admin/export?entity=brands&format=csv",
            },
            {
              title: "Categories",
              desc: "All product categories mapped to supply division slugs and thumbnails.",
              csvUrl: "/api/admin/export?entity=categories&format=csv",
            },
            {
              title: "Customer Enquiries & Leads",
              desc: "All WhatsApp, Email, Contact Form, and AI-captured enquiries.",
              csvUrl: "/api/admin/export?entity=enquiries&format=csv",
            },
            {
              title: "Full Catalog Backup",
              desc: "Complete JSON snapshot of divisions, categories, brands, products, and page blocks.",
              jsonUrl: "/api/admin/export?entity=all&format=json",
            },
          ].map((item) => (
            <div key={item.title} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#141A21]">{item.title}</div>
                <div className="text-xs text-stone-500 mt-0.5">{item.desc}</div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {item.templateUrl && (
                  <a
                    href={item.templateUrl}
                    className="inline-flex items-center gap-1 rounded border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:border-[#141A21]"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Template
                  </a>
                )}
                {item.csvUrl && (
                  <a
                    href={item.csvUrl}
                    className="inline-flex items-center gap-1 rounded bg-[#141A21] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#EA6A12]"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </a>
                )}
                {item.jsonUrl && (
                  <a
                    href={item.jsonUrl}
                    className="inline-flex items-center gap-1 rounded border border-[#EA6A12] px-3 py-1.5 text-xs font-semibold text-[#EA6A12] hover:bg-[#EA6A12] hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5" /> JSON
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Import Panel */}
      <div className="lg:col-span-6 rounded-md border border-[#E4E4E0] bg-white p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#141A21]">Bulk Import / Update (Upsert)</h2>
          <p className="text-xs text-stone-600 mt-1">
            Upload an edited CSV or JSON file. Matching SKUs (for products) or slugs (for brands/categories) are updated automatically; new rows are added.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#141A21] mb-1.5">
            Select Data Type to Import
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["products", "brands", "categories"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEntity(t)}
                className={`rounded py-2 text-xs font-semibold capitalize cursor-pointer ${
                  entity === t
                    ? "bg-[#141A21] text-white"
                    : "border border-stone-300 bg-stone-50 text-stone-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`rounded-md border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            isDragActive
              ? "border-[#EA6A12] bg-orange-50/50"
              : "border-stone-300 bg-[#F9F9F7] hover:border-stone-400"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#EA6A12]" />
            ) : (
              <UploadCloud className="w-8 h-8 text-stone-500" />
            )}
            <div className="text-sm font-semibold text-[#141A21]">
              {uploading
                ? `Importing ${entity}...`
                : `Drop your ${entity} .CSV or .JSON file here`}
            </div>
            <div className="text-xs text-stone-500">
              Or click to browse from computer
            </div>
          </div>
        </div>

        {result && (
          <div className="rounded border border-stone-200 bg-[#F9F9F7] p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Import Finished
            </div>
            <div className="font-mono text-[#141A21]">
              Inserted: {result.inserted} • Updated: {result.updated}
            </div>
            {result.errors.length > 0 && (
              <div className="pt-2 border-t border-stone-200 space-y-1 text-red-700">
                <div className="font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Skipped Rows ({result.errors.length}):
                </div>
                {result.errors.slice(0, 8).map((err, idx) => (
                  <div key={idx}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Justdial Catalog Export */}
      <JustdialExportPanel
        brands={justdialBrands}
        categories={justdialCategories}
        defaultCompanyName={defaultCompanyName}
        defaultCompanyContact={defaultCompanyContact}
      />

      {/* Bulk Clear / Purge All Records */}
      <div className="lg:col-span-12 rounded-md border border-red-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#141A21]">Bulk Delete All Records by Collection</h2>
          <p className="text-xs text-stone-600 mt-1">
            Quickly clear entire tables when replacing test data or resetting a catalog section. To delete only specific items, use the checkboxes on the Products, Brands &amp; Categories, Documents, or Enquiries pages.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              { key: "products", label: "All Products", note: "Clears every SKU in catalog" },
              { key: "brands", label: "All Brands", note: "Clears manufacturer directory" },
              { key: "categories", label: "All Categories", note: "Clear products first" },
              { key: "documents", label: "All Documents", note: "Deletes DB records & R2 files" },
              { key: "enquiries", label: "All Enquiries", note: "Clears customer RFQs & leads" },
              { key: "ai_conversations", label: "All AI Chat Sessions", note: "Clears saved buyer chats" },
              { key: "whatsapp_logs", label: "All WhatsApp Logs", note: "Clears webhook/dispatch history" },
            ] as const
          ).map((item) => {
            const count = counts[item.key] ?? 0;
            const busy = purging === item.key;
            return (
              <div
                key={item.key}
                className="rounded-md border border-stone-200 bg-[#FBFBFA] p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#141A21]">{item.label}</span>
                    <span className="font-mono text-xs font-semibold text-stone-600">
                      {count} rows
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{item.note}</p>
                </div>
                <button
                  type="button"
                  disabled={busy || count === 0}
                  onClick={() => handlePurge(item.key, item.label, count)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-red-300 bg-white py-2 text-xs font-semibold text-red-700 hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete All ({count})
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
