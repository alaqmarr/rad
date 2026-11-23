"use client";

import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  Download,
  FileText,
  FolderTree,
  Layers,
  Package,
  Printer,
  Search,
} from "lucide-react";
import type { CatalogueLayout, CatalogueScope } from "@/lib/catalogue-builder";

export interface CatalogueBrandItem {
  slug: string;
  name: string;
  logoUrl: string | null;
  countryOfOrigin: string;
  productCount: number;
}

export interface CatalogueCategoryItem {
  slug: string;
  name: string;
  divisionName: string;
  productCount: number;
}

interface ProductPick {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brandName: string | null;
  categoryName: string | null;
}

export function CatalogueStudioClient({
  brands,
  categories,
  totalProducts,
  featuredProductsCount,
  defaultProducts,
}: {
  brands: CatalogueBrandItem[];
  categories: CatalogueCategoryItem[];
  totalProducts: number;
  featuredProductsCount: number;
  defaultProducts: ProductPick[];
}) {
  const [scope, setScope] = useState<CatalogueScope>("brand");
  const [selectedBrandSlug, setSelectedBrandSlug] = useState(brands[0]?.slug || "");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(categories[0]?.slug || "");
  const [selectedProductSlug, setSelectedProductSlug] = useState(defaultProducts[0]?.slug || "");
  const [masterFeaturedOnly, setMasterFeaturedOnly] = useState(true);

  const [layout, setLayout] = useState<CatalogueLayout>("cards");
  const [includeImages, setIncludeImages] = useState(true);
  const [showPrices, setShowPrices] = useState(false);
  const [preparedFor, setPreparedFor] = useState("");
  const [batchSize, setBatchSize] = useState(0);

  const [brandSearch, setBrandSearch] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductPick[]>(defaultProducts);
  const [searchingProd, setSearchingProd] = useState(false);

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q)
    );
  }, [brands, brandSearch]);

  const activeSlug =
    scope === "brand"
      ? selectedBrandSlug
      : scope === "category"
      ? selectedCategorySlug
      : scope === "product"
      ? selectedProductSlug
      : "";

  const activeTotalCount = useMemo(() => {
    if (scope === "brand") {
      return brands.find((b) => b.slug === selectedBrandSlug)?.productCount || 0;
    }
    if (scope === "category") {
      return categories.find((c) => c.slug === selectedCategorySlug)?.productCount || 0;
    }
    if (scope === "product") return selectedProductSlug ? 1 : 0;
    return masterFeaturedOnly ? featuredProductsCount : totalProducts;
  }, [
    scope,
    selectedBrandSlug,
    selectedCategorySlug,
    selectedProductSlug,
    masterFeaturedOnly,
    brands,
    categories,
    totalProducts,
    featuredProductsCount,
  ]);

  const buildCatalogueUrl = (opts: {
    targetScope?: CatalogueScope;
    targetSlug?: string;
    download?: boolean;
    print?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const sc = opts.targetScope || scope;
    const sl = opts.targetSlug ?? (sc === "master" ? "" : activeSlug);
    const p = new URLSearchParams();
    p.set("scope", sc);
    if (sl) p.set("slug", sl);
    p.set("layout", layout);
    p.set("images", includeImages ? "1" : "0");
    p.set("prices", showPrices ? "1" : "0");
    if (sc === "master" && masterFeaturedOnly) p.set("featured", "1");
    if (preparedFor.trim()) p.set("preparedFor", preparedFor.trim());
    if (opts.limit) p.set("limit", String(opts.limit));
    if (opts.offset !== undefined) p.set("offset", String(opts.offset));
    if (opts.download) p.set("download", "1");
    if (opts.print) p.set("print", "1");
    return `/api/admin/catalogue?${p.toString()}`;
  };

  const parts = useMemo(() => {
    if (scope === "product" || batchSize <= 0 || activeTotalCount <= batchSize) return [];
    const totalParts = Math.ceil(activeTotalCount / batchSize);
    return Array.from({ length: totalParts }, (_, i) => {
      const offset = i * batchSize;
      const start = offset + 1;
      const end = Math.min((i + 1) * batchSize, activeTotalCount);
      return {
        part: i + 1,
        label: `Volume ${i + 1} (${start.toLocaleString("en-IN")}–${end.toLocaleString("en-IN")})`,
        offset,
      };
    });
  }, [scope, batchSize, activeTotalCount]);

  const handleProductSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productQuery.trim().length < 2) return;
    setSearchingProd(true);
    try {
      const res = await fetch(
        `/api/admin/catalogue?searchProducts=1&q=${encodeURIComponent(productQuery.trim())}`
      );
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setProductResults(data.items);
        if (data.items[0]?.slug) setSelectedProductSlug(data.items[0].slug);
      }
    } finally {
      setSearchingProd(false);
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Scope Switcher + Formatting Options */}
      <div className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#C24D00]" />
            <div>
              <h2 className="text-base font-extrabold text-[#141A21]">
                1. Choose Catalogue Type
              </h2>
              <p className="text-xs text-stone-500">
                Branded with Radiant Industrial Co. letterhead, OEM brand logos, clickable inter-page Table of Contents, and live quote links.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs rounded bg-stone-100 px-3 py-1 text-[#141A21] font-semibold">
            {activeTotalCount.toLocaleString("en-IN")} SKUs in Selection
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              {
                key: "brand",
                label: "Brand-Wise Catalogue",
                desc: `${brands.length} OEM brands with logos`,
                icon: Building2,
              },
              {
                key: "category",
                label: "Category-Wise Catalogue",
                desc: `${categories.length} industrial categories + guides`,
                icon: FolderTree,
              },
              {
                key: "master",
                label: "Master Catalogue",
                desc: `All ${totalProducts.toLocaleString("en-IN")} SKUs or featured`,
                icon: Layers,
              },
              {
                key: "product",
                label: "Individual Product Sheet",
                desc: "Single SKU executive datasheet",
                icon: Package,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = scope === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setScope(tab.key)}
                className={`rounded-md border p-4 text-left transition-all cursor-pointer ${
                  active
                    ? "border-[#C24D00] bg-orange-50/60 ring-1 ring-[#C24D00]"
                    : "border-stone-200 bg-[#FBFBFA] hover:border-stone-400"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-[#141A21]">
                  <Icon className={`w-4 h-4 ${active ? "text-[#C24D00]" : "text-stone-500"}`} />
                  {tab.label}
                </div>
                <div className="text-xs text-stone-500 mt-1">{tab.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Scope-specific Target Selector */}
        <div className="rounded-md border border-stone-200 bg-[#FBFBFA] p-4 space-y-4">
          {scope === "brand" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Select OEM Brand
                </label>
                <select
                  value={selectedBrandSlug}
                  onChange={(e) => setSelectedBrandSlug(e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                >
                  {brands.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name} ({b.productCount.toLocaleString("en-IN")} SKUs)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Volume Size / Pagination
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                >
                  <option value={0}>All Products — Complete Catalogue (No Limit)</option>
                  <option value={1200}>1,200 SKUs per PDF/HTML volume</option>
                  <option value={500}>500 SKUs per PDF/HTML volume</option>
                  <option value={2500}>2,500 SKUs per PDF/HTML volume</option>
                </select>
              </div>
            </div>
          )}

          {scope === "category" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Select Category
                </label>
                <select
                  value={selectedCategorySlug}
                  onChange={(e) => setSelectedCategorySlug(e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} — {c.divisionName} ({c.productCount.toLocaleString("en-IN")} SKUs)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Volume Size / Pagination
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                >
                  <option value={0}>All Products — Complete Catalogue (No Limit)</option>
                  <option value={1200}>1,200 SKUs per PDF/HTML volume</option>
                  <option value={500}>500 SKUs per PDF/HTML volume</option>
                  <option value={2000}>2,000 SKUs per PDF/HTML volume</option>
                </select>
              </div>
            </div>
          )}

          {scope === "master" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Master Scope Coverage
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMasterFeaturedOnly(true)}
                    className={`rounded px-3 py-2 text-xs font-semibold cursor-pointer ${
                      masterFeaturedOnly
                        ? "bg-[#141A21] text-white"
                        : "border border-stone-300 bg-white text-stone-700"
                    }`}
                  >
                    Executive Featured Catalogue ({featuredProductsCount} SKUs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterFeaturedOnly(false)}
                    className={`rounded px-3 py-2 text-xs font-semibold cursor-pointer ${
                      !masterFeaturedOnly
                        ? "bg-[#141A21] text-white"
                        : "border border-stone-300 bg-white text-stone-700"
                    }`}
                  >
                    Full Catalog Volumes ({totalProducts.toLocaleString("en-IN")} SKUs)
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Volume Size / Pagination
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                >
                  <option value={0}>All Products — Complete Catalogue (No Limit)</option>
                  <option value={1200}>1,200 SKUs per Volume</option>
                  <option value={500}>500 SKUs per Volume</option>
                  <option value={2500}>2,500 SKUs per Volume</option>
                </select>
              </div>
            </div>
          )}

          {scope === "product" && (
            <div className="space-y-3">
              <form onSubmit={handleProductSearch} className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search SKU, MPN, or product name (e.g. AF8, DSBC, G125)..."
                    className="w-full rounded border border-stone-300 bg-white pl-8 pr-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchingProd}
                  className="rounded bg-[#141A21] px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                >
                  {searchingProd ? "Searching..." : "Find SKU"}
                </button>
              </form>

              <div>
                <label className="block text-xs font-bold text-[#141A21] mb-1">
                  Select Product for Datasheet Export
                </label>
                <select
                  value={selectedProductSlug}
                  onChange={(e) => setSelectedProductSlug(e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21] outline-none focus:border-[#C24D00]"
                >
                  {productResults.map((p) => (
                    <option key={p.id} value={p.slug}>
                      [{p.sku}] {p.name} {p.brandName ? `— ${p.brandName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Template Presentation Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-stone-200/80 text-xs">
            <div>
              <label className="block font-bold text-[#141A21] mb-1">
                Layout Template Style
              </label>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as CatalogueLayout)}
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21]"
              >
                <option value="cards">Visual Spec Cards (with Logos &amp; Photos)</option>
                <option value="linesheet">Compact Buyer Line-Sheet Table</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#141A21] mb-1">
                Prepared For Client / Company (Optional)
              </label>
              <input
                type="text"
                value={preparedFor}
                onChange={(e) => setPreparedFor(e.target.value)}
                placeholder="e.g. Bharat Aerospace Ltd. / Hyderabad Plant"
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-[#141A21]"
              />
            </div>

            <div className="flex flex-col justify-end gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                />
                Include Product Photos (Brand Logos Always Included)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  checked={showPrices}
                  onChange={(e) => setShowPrices(e.target.checked)}
                />
                Show Public Listed Prices (otherwise Ask for Price)
              </label>
            </div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            In the Print dialog, select <strong>Destination → Save as PDF</strong> (do <em>not</em> use Microsoft Print to PDF) so every Table of Contents, Index, and product hyperlink stays clickable inside the PDF.
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={buildCatalogueUrl({ print: true, limit: batchSize || undefined, offset: 0 })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded bg-[#C24D00] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#9E3E00] transition-colors"
            >
              <Printer className="w-4 h-4" />
              Open Print / Save as PDF
            </a>
            <a
              href={buildCatalogueUrl({ limit: batchSize || undefined, offset: 0 })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-[#141A21] bg-white px-4 py-2.5 text-xs font-bold text-[#141A21] hover:bg-stone-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Preview Interactive Catalogue
            </a>
            <a
              href={buildCatalogueUrl({ download: true, limit: batchSize || undefined, offset: 0 })}
              className="inline-flex items-center gap-2 rounded bg-[#141A21] px-4 py-2.5 text-xs font-bold text-white hover:bg-stone-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Standalone HTML
            </a>
          </div>
        </div>

        {/* Split Volumes for Large Catalogues */}
        {parts.length > 1 && (
          <div className="border-t border-stone-200 pt-4 space-y-2">
            <div className="text-xs font-bold text-[#141A21]">
              Multi-Volume PDF/HTML Downloads ({parts.length} parts for smooth printing):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {parts.slice(0, 36).map((pt) => (
                <div
                  key={pt.part}
                  className="flex items-center justify-between gap-2 rounded border border-stone-200 bg-[#FBFBFA] px-3 py-2 text-xs"
                >
                  <span className="font-mono font-semibold text-[#141A21]">{pt.label}</span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={buildCatalogueUrl({ print: true, limit: batchSize, offset: pt.offset })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-[#C24D00] px-2 py-1 text-[11px] font-bold text-white"
                    >
                      PDF
                    </a>
                    <a
                      href={buildCatalogueUrl({ download: true, limit: batchSize, offset: pt.offset })}
                      className="rounded bg-[#141A21] px-2 py-1 text-[11px] font-bold text-white"
                    >
                      HTML
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick 1-Click Brand Catalogues Directory */}
      <div className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#141A21]">
              Quick Export — All {brands.length} Brand Catalogues
            </h2>
            <p className="text-xs text-stone-500">
              One-click branded catalogue export per manufacturer using their OEM logo and Radiant Industrial Co. template.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Filter brands..."
              className="w-full rounded border border-stone-300 bg-[#FBFBFA] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#C24D00]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredBrands.map((b) => (
            <div
              key={b.slug}
              className="rounded-md border border-stone-200 bg-[#FBFBFA] p-3.5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded border border-stone-200 bg-white flex items-center justify-center p-1 shrink-0">
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt={b.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-stone-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#141A21] truncate">{b.name}</div>
                  <div className="text-[11px] font-mono text-stone-500">
                    {b.productCount.toLocaleString("en-IN")} SKUs • {b.countryOfOrigin}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={buildCatalogueUrl({
                    targetScope: "brand",
                    targetSlug: b.slug,
                    print: true,
                    offset: 0,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-[#C24D00] py-1.5 text-[11px] font-bold text-white hover:bg-[#9E3E00]"
                >
                  <Printer className="w-3 h-3" /> PDF
                </a>
                <a
                  href={buildCatalogueUrl({
                    targetScope: "brand",
                    targetSlug: b.slug,
                    download: true,
                    offset: 0,
                  })}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-[#141A21] py-1.5 text-[11px] font-bold text-white hover:bg-stone-800"
                >
                  <Download className="w-3 h-3" /> HTML
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
