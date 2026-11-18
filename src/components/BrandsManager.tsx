"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { sileo } from "sileo";
import { DropzoneUploader } from "./DropzoneUploader";
import { BulkSelectionBar } from "./BulkSelectionBar";
import { useBulkSelection } from "@/lib/selection";
import {
  upsertBrandAction,
  deleteBrandAction,
  bulkDeleteBrandsAction,
  upsertCategoryAction,
  deleteCategoryAction,
  bulkDeleteCategoriesAction,
} from "@/app/admin/actions";

interface BrandRow {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  thumbnailUrl: string | null;
  countryOfOrigin: string;
  sourcingType: string;
  sourcingNote: string;
  description: string;
  websiteUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  thumbnailUrl: string | null;
  divisionId: number;
}

export function BrandsManager({
  brands,
  categories,
  divisions,
}: {
  brands: BrandRow[];
  categories: CategoryRow[];
  divisions: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Brand Modal State
  const [id, setId] = useState<number | undefined>(undefined);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [countryOfOrigin, setCountryOfOrigin] = useState("India");
  const [sourcingType, setSourcingType] = useState<"independent" | "authorized">("independent");
  const [sourcingNote, setSourcingNote] = useState(
    "We are not an official authorized dealer yet; we source genuine items directly against your order."
  );
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isFeatured, setIsFeatured] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Category Modal State
  const [catId, setCatId] = useState<number | undefined>(undefined);
  const [catName, setCatName] = useState("");
  const [catDivId, setCatDivId] = useState(divisions[0]?.id || 1);
  const [catDesc, setCatDesc] = useState("");
  const [catThumb, setCatThumb] = useState<string | null>(null);

  const openCreateBrand = () => {
    setId(undefined);
    setName("");
    setLogoUrl(null);
    setThumbnailUrl(null);
    setCountryOfOrigin("India");
    setSourcingType("independent");
    setSourcingNote(
      "We are not an official authorized dealer yet; we source genuine items directly against your order."
    );
    setDescription("");
    setWebsiteUrl("");
    setIsFeatured(true);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditBrand = (b: BrandRow) => {
    setId(b.id);
    setName(b.name);
    setLogoUrl(b.logoUrl);
    setThumbnailUrl(b.thumbnailUrl);
    setCountryOfOrigin(b.countryOfOrigin);
    setSourcingType(b.sourcingType === "authorized" ? "authorized" : "independent");
    setSourcingNote(b.sourcingNote);
    setDescription(b.description);
    setWebsiteUrl(b.websiteUrl || "");
    setIsFeatured(b.isFeatured);
    setIsActive(b.isActive);
    setModalOpen(true);
  };

  const openCreateCategory = () => {
    setCatId(undefined);
    setCatName("");
    setCatDivId(divisions[0]?.id || 1);
    setCatDesc("");
    setCatThumb(null);
    setCatModalOpen(true);
  };

  const openEditCategory = (c: CategoryRow) => {
    setCatId(c.id);
    setCatName(c.name);
    setCatDivId(c.divisionId);
    setCatDesc(c.description);
    setCatThumb(c.thumbnailUrl);
    setCatModalOpen(true);
  };

  const saveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertBrandAction({
        id,
        name,
        logoUrl,
        thumbnailUrl,
        countryOfOrigin,
        sourcingType,
        sourcingNote,
        description,
        websiteUrl,
        isFeatured,
        isActive,
      });
      setModalOpen(false);
      router.refresh();
      sileo.success({ title: id ? "Brand Updated" : "Brand Added", description: name });
    } catch (err) {
      sileo.error({ title: "Failed", description: err instanceof Error ? err.message : "Error" });
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertCategoryAction({
        id: catId,
        name: catName,
        divisionId: Number(catDivId),
        description: catDesc,
        thumbnailUrl: catThumb,
      });
      setCatModalOpen(false);
      router.refresh();
      sileo.success({ title: catId ? "Category Updated" : "Category Added", description: catName });
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const brandSelection = useBulkSelection(brands.map((b) => b.id));
  const categorySelection = useBulkSelection(categories.map((c) => c.id));

  const handleBulkDeleteBrands = async () => {
    if (brandSelection.selectedIds.length === 0) return;
    if (
      !confirm(
        `Delete ${brandSelection.selectedIds.length} selected brand(s) permanently? Linked products will stay in catalog with no brand set.`
      )
    ) {
      return;
    }
    brandSelection.setBulkDeleting(true);
    try {
      const res = await bulkDeleteBrandsAction(brandSelection.selectedIds);
      brandSelection.clearSelection();
      router.refresh();
      sileo.success({
        title: "Brands Deleted",
        description: `${res.deleted} brand(s) removed.`,
      });
    } catch (err) {
      sileo.error({
        title: "Bulk Delete Failed",
        description: err instanceof Error ? err.message : "Could not delete brands",
      });
    } finally {
      brandSelection.setBulkDeleting(false);
    }
  };

  const handleBulkDeleteCategories = async () => {
    if (categorySelection.selectedIds.length === 0) return;
    if (
      !confirm(
        `Delete ${categorySelection.selectedIds.length} selected category(s) permanently?`
      )
    ) {
      return;
    }
    categorySelection.setBulkDeleting(true);
    try {
      const res = await bulkDeleteCategoriesAction(categorySelection.selectedIds);
      categorySelection.clearSelection();
      router.refresh();
      sileo.success({
        title: "Categories Deleted",
        description: `${res.deleted} category(s) removed.`,
      });
    } catch (err) {
      sileo.error({
        title: "Cannot Delete Categories",
        description: err instanceof Error ? err.message : "Could not delete categories",
      });
    } finally {
      categorySelection.setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Brands Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#141A21]">Sourced Brands ({brands.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/admin/export?entity=brands&format=csv"
              className="rounded border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-[#141A21] hover:border-[#141A21]"
            >
              Export Brands CSV
            </a>
            <a
              href="/admin/data"
              className="rounded border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-[#141A21] hover:border-[#141A21]"
            >
              Bulk Import
            </a>
            <button
              type="button"
              onClick={openCreateBrand}
              className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C95609] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Brand
            </button>
          </div>
        </div>

        <BulkSelectionBar
          totalCount={brands.length}
          selectedCount={brandSelection.selectedIds.length}
          entityLabel="brand(s)"
          allSelected={brandSelection.allVisibleSelected}
          deleting={brandSelection.bulkDeleting}
          onToggleAll={brandSelection.toggleAllVisible}
          onClear={brandSelection.clearSelection}
          onBulkDelete={handleBulkDeleteBrands}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => {
            const isSelected = brandSelection.selectedSet.has(b.id);
            return (
              <div
                key={b.id}
                className={`rounded-md border bg-white overflow-hidden flex flex-col justify-between transition-colors ${
                  isSelected ? "border-[#EA6A12] ring-1 ring-[#EA6A12]" : "border-[#E4E4E0]"
                }`}
              >
                {b.thumbnailUrl && (
                  <div className="h-24 w-full overflow-hidden border-b border-stone-100 bg-stone-100">
                    <img src={b.thumbnailUrl} alt={b.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          aria-label={`Select brand ${b.name}`}
                          checked={isSelected}
                          onChange={() => brandSelection.toggleOne(b.id)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#EA6A12] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#141A21]">{b.name}</h3>
                          <div className="font-mono text-[11px] text-stone-500 mt-0.5">
                            {b.countryOfOrigin} •{" "}
                            {b.sourcingType === "authorized" ? "AUTHORIZED" : "INDEPENDENT"}
                          </div>
                        </div>
                      </div>
                      {b.logoUrl && (
                        <img src={b.logoUrl} alt={b.name} className="h-7 w-16 object-contain shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-stone-600 mt-2 line-clamp-2">{b.description}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => openEditBrand(b)}
                      className="inline-flex items-center gap-1 rounded border border-stone-300 px-2.5 py-1 text-xs font-medium hover:border-[#141A21] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Edit / Upload
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete brand "${b.name}"?`)) return;
                        await deleteBrandAction(b.id);
                        router.refresh();
                        sileo.success({ title: "Brand Removed" });
                      }}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Categories Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#141A21]">
            Product Categories ({categories.length})
          </h2>
          <button
            type="button"
            onClick={openCreateCategory}
            className="inline-flex items-center gap-2 rounded bg-[#141A21] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        <BulkSelectionBar
          totalCount={categories.length}
          selectedCount={categorySelection.selectedIds.length}
          entityLabel="category(s)"
          allSelected={categorySelection.allVisibleSelected}
          deleting={categorySelection.bulkDeleting}
          onToggleAll={categorySelection.toggleAllVisible}
          onClear={categorySelection.clearSelection}
          onBulkDelete={handleBulkDeleteCategories}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => {
            const divName = divisions.find((d) => d.id === c.divisionId)?.name || "";
            const isSelected = categorySelection.selectedSet.has(c.id);
            return (
              <div
                key={c.id}
                className={`rounded-md border bg-white overflow-hidden flex flex-col justify-between transition-colors ${
                  isSelected ? "border-[#EA6A12] ring-1 ring-[#EA6A12]" : "border-[#E4E4E0]"
                }`}
              >
                {c.thumbnailUrl && (
                  <div className="h-24 w-full overflow-hidden border-b border-stone-100 bg-stone-100">
                    <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select category ${c.name}`}
                        checked={isSelected}
                        onChange={() => categorySelection.toggleOne(c.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#EA6A12] cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-[#EA6A12] uppercase">{divName}</div>
                        <h3 className="font-bold text-sm text-[#141A21] mt-0.5">{c.name}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 mt-1 line-clamp-2">{c.description}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => openEditCategory(c)}
                      className="inline-flex items-center gap-1 rounded border border-stone-300 px-2.5 py-1 text-xs font-medium hover:border-[#141A21] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Edit / Thumbnail
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete category "${c.name}"?`)) return;
                        try {
                          await deleteCategoryAction(c.id);
                          router.refresh();
                          sileo.success({ title: "Category Removed" });
                        } catch (err) {
                          sileo.error({
                            title: "Cannot Delete Category",
                            description: err instanceof Error ? err.message : "Delete failed",
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brand Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141A21]/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-[#141A21]">
                {id ? "Edit Brand" : "Add Sourced Brand"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveBrand} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Brand Name *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Country of Origin
                  </label>
                  <input
                    value={countryOfOrigin}
                    onChange={(e) => setCountryOfOrigin(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Sourcing Relationship
                </label>
                <select
                  value={sourcingType}
                  onChange={(e) =>
                    setSourcingType(e.target.value as "independent" | "authorized")
                  }
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="independent">
                    Independent Sourcing (Not Authorized Dealer Yet)
                  </option>
                  <option value="authorized">Authorized Distributor / Dealer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Sourcing Note
                </label>
                <input
                  value={sourcingNote}
                  onChange={(e) => setSourcingNote(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>

              <DropzoneUploader
                folder="brands/logos"
                accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp", ".svg"] }}
                label="Upload Brand Logo (Cloudflare R2)"
                currentUrl={logoUrl}
                onUploaded={(meta) => setLogoUrl(meta.url)}
                onClear={() => setLogoUrl(null)}
              />

              <DropzoneUploader
                folder="brands/thumbnails"
                accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
                label="Upload Brand Cover Thumbnail (Cloudflare R2)"
                currentUrl={thumbnailUrl}
                onUploaded={(meta) => setThumbnailUrl(meta.url)}
                onClear={() => setThumbnailUrl(null)}
              />

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
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-stone-300 px-4 py-2 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded bg-[#141A21] px-5 py-2 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141A21]/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-stone-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
              <h3 className="text-lg font-bold text-[#141A21]">
                {catId ? "Edit Category" : "Add Product Category"}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Category Name *
                </label>
                <input
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Supply Area (Division)
                </label>
                <select
                  value={catDivId}
                  onChange={(e) => setCatDivId(Number(e.target.value))}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <DropzoneUploader
                folder="categories"
                accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
                label="Upload Category Thumbnail (Cloudflare R2)"
                currentUrl={catThumb}
                onUploaded={(meta) => setCatThumb(meta.url)}
                onClear={() => setCatThumb(null)}
              />
              <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="rounded border border-stone-300 px-4 py-2 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded bg-[#141A21] px-5 py-2 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
