"use client";

import React, { useMemo, useState } from "react";
import { Download, Eye, FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import { sileo } from "sileo";

export interface JustdialFilterOption {
  slug: string;
  name: string;
}

interface PreviewPayload {
  totalMatched: number;
  headers: string[];
  sampleRows: string[][];
}

export function JustdialExportPanel({
  brands,
  categories,
  defaultCompanyName,
  defaultCompanyContact,
}: {
  brands: JustdialFilterOption[];
  categories: JustdialFilterOption[];
  defaultCompanyName: string;
  defaultCompanyContact: string;
}) {
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [withImagesOnly, setWithImagesOnly] = useState(true);
  const [pricedOnly, setPricedOnly] = useState(false);
  const [categoryOverride, setCategoryOverride] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [importerName, setImporterName] = useState(defaultCompanyName);
  const [importerContact, setImporterContact] = useState(defaultCompanyContact);
  const [manufacturerContact, setManufacturerContact] = useState("");
  const [forceImporter, setForceImporter] = useState(false);
  const [chunkSize, setChunkSize] = useState<number>(5000);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const buildQueryParams = (extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (brand) p.set("brand", brand);
    if (category) p.set("category", category);
    if (withImagesOnly) p.set("withImagesOnly", "1");
    if (pricedOnly) p.set("pricedOnly", "1");
    if (categoryOverride.trim()) p.set("categoryOverride", categoryOverride.trim());
    if (defaultPrice.trim()) p.set("defaultPrice", defaultPrice.trim());
    if (importerName.trim()) p.set("importerName", importerName.trim());
    if (importerContact.trim()) p.set("importerContact", importerContact.trim());
    if (manufacturerContact.trim()) p.set("manufacturerContact", manufacturerContact.trim());
    if (forceImporter) p.set("forceImporter", "1");
    if (extra) {
      for (const [k, v] of Object.entries(extra)) p.set(k, v);
    }
    return p.toString();
  };

  const fullDownloadUrl = useMemo(
    () => `/api/admin/export/justdial?${buildQueryParams()}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      brand,
      category,
      withImagesOnly,
      pricedOnly,
      categoryOverride,
      defaultPrice,
      importerName,
      importerContact,
      manufacturerContact,
      forceImporter,
    ]
  );

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const qs = buildQueryParams({ preview: "1" });
      const res = await fetch(`/api/admin/export/justdial?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load Justdial preview");
      setPreview(data);
    } catch (err) {
      sileo.error({
        title: "Justdial Preview Failed",
        description: err instanceof Error ? err.message : "Failed to inspect matching rows",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const batchChunks = useMemo(() => {
    if (!preview || chunkSize <= 0 || preview.totalMatched <= chunkSize) return [];
    const totalParts = Math.ceil(preview.totalMatched / chunkSize);
    return Array.from({ length: totalParts }, (_, idx) => {
      const offset = idx * chunkSize;
      const fromRow = offset + 1;
      const toRow = Math.min((idx + 1) * chunkSize, preview.totalMatched);
      return {
        part: idx + 1,
        label: `Part ${idx + 1} (${fromRow.toLocaleString("en-IN")}–${toRow.toLocaleString("en-IN")})`,
        url: `/api/admin/export/justdial?${buildQueryParams({
          limit: String(chunkSize),
          offset: String(offset),
        })}`,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preview,
    chunkSize,
    brand,
    category,
    withImagesOnly,
    pricedOnly,
    categoryOverride,
    defaultPrice,
    importerName,
    importerContact,
    manufacturerContact,
    forceImporter,
  ]);

  return (
    <div
      id="justdial-export"
      className="lg:col-span-12 rounded-md border border-[#E4E4E0] bg-white p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded bg-orange-100 px-2 py-0.5 text-[11px] font-mono font-bold text-[#C24D00] uppercase">
            Justdial Catalog Upload Format
          </div>
          <h2 className="text-lg font-extrabold text-[#141A21] mt-1">
            Export Catalog Specifically for Justdial Bulk Upload
          </h2>
          <p className="text-xs text-stone-600 mt-0.5 max-w-3xl">
            Generates an exact 16-column UTF-8 CSV matching Justdial&apos;s bulk product template (
            <span className="font-mono">
              JDSN, Product Name*, Product Category, Price, Min Order Quantity, Seller SKU ID, Barcode / EAN, Product Description, Units, Country of Origin, Importer &amp; Manufacturer Details, Image Links
            </span>
            ). Dedicated strictly to Justdial so standard catalog exports remain unchanged.
          </p>
        </div>

        <a
          href="/api/admin/export/justdial?template=1"
          className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-3 py-2 text-xs font-semibold text-[#141A21] hover:border-[#141A21] shrink-0"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Justdial Sample CSV
        </a>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block font-semibold text-[#141A21] mb-1">Filter by Brand</label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          >
            <option value="">All Active Brands</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">Filter by Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">
            Justdial Category Override (Optional)
          </label>
          <input
            type="text"
            value={categoryOverride}
            onChange={(e) => setCategoryOverride(e.target.value)}
            placeholder="Leave blank to use product category"
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">
            Fallback Price for RFQ Items (Optional)
          </label>
          <input
            type="text"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            placeholder="Blank unless Justdial requires a number"
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">
            Importer&apos;s Name (Imported Brands)
          </label>
          <input
            type="text"
            value={importerName}
            onChange={(e) => setImporterName(e.target.value)}
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">
            Importer&apos;s Address / Contact Details
          </label>
          <input
            type="text"
            value={importerContact}
            onChange={(e) => setImporterContact(e.target.value)}
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">
            Manufacturer Contact Override (Optional)
          </label>
          <input
            type="text"
            value={manufacturerContact}
            onChange={(e) => setManufacturerContact(e.target.value)}
            placeholder="Auto-uses OEM origin/website or house address"
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          />
        </div>

        <div>
          <label className="block font-semibold text-[#141A21] mb-1">Batch Split Size</label>
          <select
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            className="w-full rounded border border-stone-300 bg-[#FBFBFA] px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
          >
            <option value={5000}>5,000 products per CSV</option>
            <option value={1000}>1,000 products per CSV</option>
            <option value={10000}>10,000 products per CSV</option>
            <option value={0}>Single combined CSV</option>
          </select>
        </div>
      </div>

      {/* Options & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-stone-100">
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={withImagesOnly}
              onChange={(e) => setWithImagesOnly(e.target.checked)}
              className="rounded border-stone-300"
            />
            Only products with Primary Image URL
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pricedOnly}
              onChange={(e) => setPricedOnly(e.target.checked)}
              className="rounded border-stone-300"
            />
            Only priced products (exclude RFQ-only)
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceImporter}
              onChange={(e) => setForceImporter(e.target.checked)}
              className="rounded border-stone-300"
            />
            Fill Importer columns on Indian brands too
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="inline-flex items-center gap-1.5 rounded border border-[#141A21] bg-white px-3.5 py-2 text-xs font-bold text-[#141A21] hover:bg-stone-100 cursor-pointer disabled:opacity-50"
          >
            {previewLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            Preview Matching Rows
          </button>

          <a
            href={fullDownloadUrl}
            className="inline-flex items-center gap-1.5 rounded bg-[#C24D00] px-4 py-2 text-xs font-bold text-white hover:bg-[#9E3E00] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download Justdial CSV
          </a>
        </div>
      </div>

      {/* Preview Table & Multi-Part Batch Links */}
      {preview && (
        <div className="space-y-3 pt-2 border-t border-stone-200">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono font-bold text-[#141A21]">
              MATCHING PRODUCTS FOR JUSTDIAL: {preview.totalMatched.toLocaleString("en-IN")}
            </span>
            {batchChunks.length > 0 && (
              <span className="text-stone-600">
                Split into {batchChunks.length} upload-ready CSV batches below:
              </span>
            )}
          </div>

          {batchChunks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {batchChunks.map((b) => (
                <a
                  key={b.part}
                  href={b.url}
                  className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-[#FBFBFA] px-3 py-1.5 text-xs font-semibold text-[#141A21] hover:border-[#C24D00] hover:text-[#C24D00]"
                >
                  <Download className="w-3 h-3" /> {b.label}
                </a>
              ))}
            </div>
          )}

          {preview.sampleRows.length > 0 && (
            <div className="overflow-x-auto border border-stone-200 rounded text-[11px]">
              <table className="w-full text-left">
                <thead className="bg-[#141A21] text-white font-mono">
                  <tr>
                    {preview.headers.slice(0, 11).map((h) => (
                      <th key={h} className="px-2.5 py-2 whitespace-nowrap font-semibold">
                        {h}
                      </th>
                    ))}
                    <th className="px-2.5 py-2 whitespace-nowrap font-semibold">
                      Primary Image Link
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {preview.sampleRows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFBFA]"}>
                      {row.slice(0, 11).map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-2.5 py-2 max-w-[200px] truncate text-stone-700"
                          title={cell}
                        >
                          {cell || <span className="text-stone-300">—</span>}
                        </td>
                      ))}
                      <td className="px-2.5 py-2 max-w-[180px] truncate font-mono text-stone-600">
                        {row[14] ? (
                          <a
                            href={row[14]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#C24D00] hover:underline"
                          >
                            img <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
