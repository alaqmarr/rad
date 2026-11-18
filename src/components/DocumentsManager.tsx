"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Loader2, ExternalLink } from "lucide-react";
import { sileo } from "sileo";
import { DropzoneUploader, type UploadedFileMeta } from "./DropzoneUploader";
import { BulkSelectionBar } from "./BulkSelectionBar";
import { useBulkSelection } from "@/lib/selection";
import {
  createDocumentAction,
  deleteDocumentAction,
  bulkDeleteDocumentsAction,
} from "@/app/admin/actions";

interface DocRow {
  id: number;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  isPublic: boolean;
  createdAt: string;
}

export function DocumentsManager({
  documents,
  products,
  brands,
}: {
  documents: DocRow[];
  products: Array<{ id: number; name: string; sku: string }>;
  brands: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("datasheet");
  const [productId, setProductId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [uploaded, setUploaded] = useState<UploadedFileMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const selection = useBulkSelection(documents.map((d) => d.id));

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (
      !confirm(
        `Delete ${selection.selectedIds.length} selected document(s) permanently from database and R2 storage?`
      )
    ) {
      return;
    }
    selection.setBulkDeleting(true);
    try {
      const res = await bulkDeleteDocumentsAction(selection.selectedIds);
      selection.clearSelection();
      router.refresh();
      sileo.success({
        title: "Documents Deleted",
        description: `${res.deleted} document(s) removed.`,
      });
    } catch (err) {
      sileo.error({
        title: "Bulk Delete Failed",
        description: err instanceof Error ? err.message : "Could not delete documents",
      });
    } finally {
      selection.setBulkDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploaded) {
      sileo.warning({ title: "Upload File First", description: "Use the dropzone to upload a PDF or document." });
      return;
    }
    setSaving(true);
    try {
      await createDocumentAction({
        title,
        description,
        category,
        fileUrl: uploaded.url,
        r2Key: uploaded.key,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        productId: productId ? Number(productId) : null,
        brandId: brandId ? Number(brandId) : null,
        isPublic,
      });
      setTitle("");
      setDescription("");
      setUploaded(null);
      setProductId("");
      setBrandId("");
      router.refresh();
      sileo.success({ title: "Document Published" });
    } catch (err) {
      sileo.error({ title: "Save Failed", description: err instanceof Error ? err.message : "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <form
        onSubmit={handleSave}
        className="lg:col-span-5 rounded-md border border-[#E4E4E0] bg-white p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-[#141A21]">Upload New Document</h2>

        <DropzoneUploader
          folder="documents"
          label="Drop PDF, Datasheet, or Catalog"
          helperText="Uploaded to Cloudflare R2 (or local fallback if R2 keys blank)"
          currentUrl={uploaded?.url || null}
          onUploaded={(meta) => {
            setUploaded(meta);
            if (!title) setTitle(meta.fileName.replace(/\.[^.]+$/, ""));
          }}
          onClear={() => setUploaded(null)}
        />

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Document Title *
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., NTN Mounted Bearing Technical Datasheet"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="datasheet">Product Datasheet</option>
            <option value="catalog">Brand Catalog</option>
            <option value="company_profile">Company / Vendor Profile</option>
            <option value="terms">Commercial Terms</option>
            <option value="compliance">Compliance / Certification</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Link Product (Opt)
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded border border-stone-300 px-2.5 py-2 text-xs"
            >
              <option value="">None</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Link Brand (Opt)
            </label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full rounded border border-stone-300 px-2.5 py-2 text-xs"
            >
              <option value="">None</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Visible on Public Documents Hub
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded bg-[#141A21] py-2.5 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Document Record
        </button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        <BulkSelectionBar
          totalCount={documents.length}
          selectedCount={selection.selectedIds.length}
          entityLabel="document(s)"
          allSelected={selection.allVisibleSelected}
          deleting={selection.bulkDeleting}
          onToggleAll={selection.toggleAllVisible}
          onClear={selection.clearSelection}
          onBulkDelete={handleBulkDelete}
        />

        <div className="rounded-md border border-[#E4E4E0] bg-white divide-y divide-[#E4E4E0]">
          {documents.length === 0 ? (
            <div className="p-8 text-sm text-stone-500">No documents uploaded yet.</div>
          ) : (
            documents.map((d) => {
              const checked = selection.selectedSet.has(d.id);
              return (
                <div
                  key={d.id}
                  className={`p-4 flex items-center justify-between gap-4 ${
                    checked ? "bg-orange-50/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      aria-label={`Select document ${d.title}`}
                      checked={checked}
                      onChange={() => selection.toggleOne(d.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#EA6A12] cursor-pointer"
                    />
                    <FileText className="w-5 h-5 text-[#EA6A12] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[#141A21] truncate">{d.title}</div>
                      <div className="text-xs font-mono text-stone-500">
                        {d.category.toUpperCase()} • {d.fileName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-stone-300 p-1.5 text-stone-600 hover:border-[#141A21]"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete "${d.title}"?`)) return;
                        await deleteDocumentAction(d.id);
                        router.refresh();
                        sileo.success({ title: "Document Deleted" });
                      }}
                      className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
