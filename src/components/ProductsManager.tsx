"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, X, Sparkles } from "lucide-react";
import { sileo } from "sileo";
import { DropzoneUploader } from "./DropzoneUploader";
import { BulkSelectionBar } from "./BulkSelectionBar";
import { useBulkSelection } from "@/lib/selection";
import {
  upsertProductAction,
  deleteProductAction,
  bulkDeleteProductsAction,
} from "@/app/admin/actions";
import type { SpecRow } from "@/db/schema";

interface ProductRow {
  id: number;
  slug: string;
  sku: string;
  name: string;
  shortDescription: string;
  description: string;
  divisionId: number;
  categoryId: number;
  brandId: number | null;
  pricingMode: string;
  basePrice: number | null;
  priceUnit: string;
  gstPercent: number;
  moq: string;
  leadTime: string;
  hsnCode: string;
  specificationsJson: string;
  primaryImageUrl: string | null;
  inStockStatus: string;
  isFeatured: boolean;
  isActive: boolean;
}

interface RefOption {
  id: number;
  name: string;
  divisionId?: number;
}

function GoogleIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function getGoogleImageSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query.trim())}`;
}

export function ProductsManager({
  products,
  divisions,
  categories,
  brands,
}: {
  products: ProductRow[];
  divisions: RefOption[];
  categories: RefOption[];
  brands: RefOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [id, setId] = useState<number | undefined>(undefined);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [divisionId, setDivisionId] = useState(divisions[0]?.id || 1);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 1);
  const [brandId, setBrandId] = useState<number | "">("");
  const [pricingMode, setPricingMode] = useState<"priced" | "rfq_only">("rfq_only");
  const [basePrice, setBasePrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("NOS");
  const [gstPercent, setGstPercent] = useState("18");
  const [moq, setMoq] = useState("1 NOS");
  const [leadTime, setLeadTime] = useState("3–7 Working Days");
  const [hsnCode, setHsnCode] = useState("");
  const [inStockStatus, setInStockStatus] = useState("Available to Order");
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [specs, setSpecs] = useState<SpecRow[]>([{ label: "", value: "" }]);
  const [aiQuery, setAiQuery] = useState("");
  const [aiFetching, setAiFetching] = useState(false);

  const handleAiAutoFill = async () => {
    const q = aiQuery.trim() || name.trim();
    if (!q) {
      sileo.warning({ title: "Enter Product / Model Number", description: "Type a model or part name first." });
      return;
    }
    setAiFetching(true);
    try {
      const res = await fetch("/api/ai/admin-product-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");

      const d = data.draft;
      setName(d.name || q);
      setSku(d.sku || sku);
      setShortDescription(d.shortDescription || "");
      setDescription(d.description || "");
      if (d.divisionId) setDivisionId(Number(d.divisionId));
      if (d.categoryId) setCategoryId(Number(d.categoryId));
      setBrandId(d.brandId ?? "");
      setHsnCode(d.hsnCode || "");
      setPriceUnit(d.priceUnit || "NOS");
      setGstPercent(String(d.gstPercent || 18));
      setMoq(d.moq || "1 NOS");
      setLeadTime(d.leadTime || "3–7 Working Days");
      setSpecs(d.specifications?.length ? d.specifications : [{ label: "", value: "" }]);

      sileo.success({
        title: d.usedAi ? "AI Auto-Filled Product Details" : "Product Draft Populated",
        description: "Review fields, upload an image below, and click Save Product.",
      });
    } catch (err) {
      sileo.error({
        title: "Lookup Failed",
        description: err instanceof Error ? err.message : "Could not fetch product details",
      });
    } finally {
      setAiFetching(false);
    }
  };

  const openCreate = () => {
    setId(undefined);
    setSku(`RIC-${String(Date.now()).slice(-6)}`);
    setName("");
    setShortDescription("");
    setDescription("");
    setDivisionId(divisions[0]?.id || 1);
    setCategoryId(categories[0]?.id || 1);
    setBrandId("");
    setPricingMode("rfq_only");
    setBasePrice("");
    setPriceUnit("NOS");
    setGstPercent("18");
    setMoq("1 NOS");
    setLeadTime("3–7 Working Days");
    setHsnCode("");
    setInStockStatus("Available to Order");
    setPrimaryImageUrl(null);
    setIsFeatured(false);
    setIsActive(true);
    setSpecs([{ label: "", value: "" }]);
    setAiQuery("");
    setModalOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setId(p.id);
    setSku(p.sku);
    setName(p.name);
    setShortDescription(p.shortDescription);
    setDescription(p.description);
    setDivisionId(p.divisionId);
    setCategoryId(p.categoryId);
    setBrandId(p.brandId ?? "");
    setPricingMode(p.pricingMode === "priced" ? "priced" : "rfq_only");
    setBasePrice(p.basePrice != null ? String(p.basePrice) : "");
    setPriceUnit(p.priceUnit);
    setGstPercent(String(p.gstPercent));
    setMoq(p.moq);
    setLeadTime(p.leadTime);
    setHsnCode(p.hsnCode);
    setInStockStatus(p.inStockStatus);
    setPrimaryImageUrl(p.primaryImageUrl);
    setIsFeatured(p.isFeatured);
    setIsActive(p.isActive);
    try {
      const parsed = JSON.parse(p.specificationsJson || "[]");
      setSpecs(parsed.length ? parsed : [{ label: "", value: "" }]);
    } catch {
      setSpecs([{ label: "", value: "" }]);
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanSpecs = specs.filter((s) => s.label.trim() && s.value.trim());
      await upsertProductAction({
        id,
        sku,
        name,
        shortDescription,
        description,
        divisionId: Number(divisionId),
        categoryId: Number(categoryId),
        brandId: brandId === "" ? null : Number(brandId),
        pricingMode,
        basePrice: pricingMode === "priced" ? Number(basePrice) || 0 : null,
        priceUnit,
        gstPercent: Number(gstPercent) || 18,
        moq,
        leadTime,
        hsnCode,
        specificationsJson: JSON.stringify(cleanSpecs),
        primaryImageUrl,
        inStockStatus,
        isFeatured,
        isActive,
      });
      setModalOpen(false);
      router.refresh();
      sileo.success({ title: id ? "Product Updated" : "Product Created", description: name });
    } catch (err) {
      sileo.error({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Could not save product",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (prodId: number, prodName: string) => {
    if (!confirm(`Delete "${prodName}" permanently?`)) return;
    try {
      await deleteProductAction(prodId);
      router.refresh();
      sileo.success({ title: "Product Deleted" });
    } catch (err) {
      sileo.error({ title: "Delete Failed", description: err instanceof Error ? err.message : "Error" });
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selection = useBulkSelection(pagedProducts.map((p) => p.id));

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (
      !confirm(
        `Delete ${selection.selectedIds.length} selected product(s) permanently? This cannot be undone.`
      )
    ) {
      return;
    }
    selection.setBulkDeleting(true);
    try {
      const res = await bulkDeleteProductsAction(selection.selectedIds);
      selection.clearSelection();
      router.refresh();
      sileo.success({
        title: "Products Deleted",
        description: `${res.deleted} product(s) removed from catalog.`,
      });
    } catch (err) {
      sileo.error({
        title: "Bulk Delete Failed",
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      selection.setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search products by name or SKU..."
          className="w-full sm:w-80 rounded border border-stone-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-[#EA6A12]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/export?entity=products&format=csv"
            className="rounded border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#141A21] hover:border-[#141A21]"
          >
            Export CSV
          </a>
          <a
            href="/admin/data"
            className="rounded border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#141A21] hover:border-[#141A21]"
          >
            Bulk Import
          </a>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <BulkSelectionBar
        totalCount={pagedProducts.length}
        selectedCount={selection.selectedIds.length}
        entityLabel="product(s)"
        allSelected={selection.allVisibleSelected}
        deleting={selection.bulkDeleting}
        onToggleAll={selection.toggleAllVisible}
        onClear={selection.clearSelection}
        onBulkDelete={handleBulkDelete}
      />

      <div className="overflow-x-auto rounded-md border border-[#E4E4E0] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E4E4E0] bg-stone-50 text-xs font-mono uppercase text-stone-500">
            <tr>
              <th className="py-3 pl-4 pr-2 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible products"
                  checked={selection.allVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  className="h-4 w-4 rounded border-stone-300 accent-[#EA6A12] cursor-pointer"
                />
              </th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Pricing</th>
              <th className="py-3 px-4">Lead Time</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E4E0]">
            {pagedProducts.map((p) => {
              const checked = selection.selectedSet.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={checked ? "bg-orange-50/50" : "hover:bg-[#FBFBFA]"}
                >
                  <td className="py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={checked}
                      onChange={() => selection.toggleOne(p.id)}
                      className="h-4 w-4 rounded border-stone-300 accent-[#EA6A12] cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-stone-600">{p.sku}</td>
                  <td className="py-3 px-4 font-medium text-[#141A21]">
                    <div className="inline-flex items-center gap-1.5 flex-wrap">
                      <span>{p.name}</span>
                      <a
                        href={getGoogleImageSearchUrl(p.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Search "${p.name}" images on Google`}
                        aria-label={`Search ${p.name} images on Google`}
                        className="inline-flex items-center justify-center rounded border border-stone-200 bg-white p-1 hover:border-stone-400 hover:bg-stone-50 transition-colors shrink-0"
                      >
                        <GoogleIcon className="w-3.5 h-3.5" />
                      </a>
                      {p.isFeatured && (
                        <span className="text-[10px] font-mono uppercase text-[#EA6A12]">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">
                    {p.pricingMode === "priced" && p.basePrice != null
                      ? `₹${p.basePrice.toLocaleString("en-IN")} / ${p.priceUnit}`
                      : "Request Quote"}
                  </td>
                  <td className="py-3 px-4 text-xs text-stone-600">{p.leadTime}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="inline-flex items-center gap-1 rounded border border-stone-300 px-2.5 py-1 text-xs font-medium hover:border-[#141A21] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.name)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E4E4E0] bg-white px-4 py-2.5 text-xs text-stone-600">
          <span>
            Showing{" "}
            <strong className="text-[#141A21]">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
            </strong>{" "}
            of <strong className="text-[#141A21]">{filtered.length.toLocaleString("en-IN")}</strong>{" "}
            products
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-stone-300 px-3 py-1 font-medium text-[#141A21] hover:border-[#141A21] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="font-mono">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-stone-300 px-3 py-1 font-medium text-[#141A21] hover:border-[#141A21] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141A21]/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-[#141A21]">
                {id ? "Edit Product" : "Add New Catalog Product"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-stone-500 hover:text-[#141A21] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* AI Web Scraper Auto-Fill Bar */}
              <div className="rounded-md border border-[#EA6A12]/40 bg-orange-50/40 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#141A21]">
                  <Sparkles className="w-4 h-4 text-[#EA6A12]" />
                  AI Product Auto-Fill (Scrapes Web Specs &amp; Matches Category/Brand)
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Enter product name & model (e.g., Fluke 117 Multimeter, SKF 6305-2RS)"
                    className="flex-1 rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                  />
                  <button
                    type="button"
                    disabled={aiFetching}
                    onClick={handleAiAutoFill}
                    className="inline-flex items-center justify-center gap-1.5 rounded bg-[#EA6A12] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C95609] cursor-pointer shrink-0"
                  >
                    {aiFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiFetching ? "Extracting Specs..." : "Fetch & Auto-Fill"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">SKU *</label>
                  <input
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Product Name *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Division</label>
                  <select
                    value={divisionId}
                    onChange={(e) => setDivisionId(Number(e.target.value))}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Brand</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="">Multi-Brand / Unbranded</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#FBFBFA] p-4 rounded border border-stone-200">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Pricing Mode
                  </label>
                  <select
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value as "priced" | "rfq_only")}
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="rfq_only">Request Quote</option>
                    <option value="priced">Fixed Base Price</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Rate (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={pricingMode !== "priced"}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm font-mono disabled:bg-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Unit</label>
                  <input
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value)}
                    placeholder="NOS / MTRS"
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">GST %</label>
                  <input
                    type="number"
                    value={gstPercent}
                    onChange={(e) => setGstPercent(e.target.value)}
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">HSN Code</label>
                  <input
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">MOQ</label>
                  <input
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Lead Time</label>
                  <input
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Stock Note</label>
                  <input
                    value={inStockStatus}
                    onChange={(e) => setInStockStatus(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Short Summary *
                </label>
                <input
                  required
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Full Technical Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                {name.trim() && (
                  <div className="flex justify-end">
                    <a
                      href={getGoogleImageSearchUrl(name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-[#141A21] hover:border-[#EA6A12] transition-colors"
                    >
                      <GoogleIcon className="w-3.5 h-3.5" />
                      Search Images on Google
                    </a>
                  </div>
                )}
                <DropzoneUploader
                  folder="products"
                  accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
                  label="Upload Product Image (Cloudflare R2)"
                  helperText="PNG, JPG, WebP up to 15 MB"
                  currentUrl={primaryImageUrl}
                  onUploaded={(meta) => setPrimaryImageUrl(meta.url)}
                  onClear={() => setPrimaryImageUrl(null)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-600">
                    Technical Specification Rows
                  </label>
                  <button
                    type="button"
                    onClick={() => setSpecs([...specs, { label: "", value: "" }])}
                    className="text-xs font-semibold text-[#EA6A12] cursor-pointer"
                  >
                    + Add Spec Row
                  </button>
                </div>
                {specs.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    <input
                      value={row.label}
                      onChange={(e) => {
                        const next = [...specs];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setSpecs(next);
                      }}
                      placeholder="Property (e.g., Bore Size)"
                      className="rounded border border-stone-300 px-3 py-1.5 text-xs"
                    />
                    <input
                      value={row.value}
                      onChange={(e) => {
                        const next = [...specs];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setSpecs(next);
                      }}
                      placeholder="Value (e.g., 25 mm)"
                      className="rounded border border-stone-300 px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  Featured on Home
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Active in Catalog
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-stone-300 px-4 py-2 text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded bg-[#141A21] px-5 py-2 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
