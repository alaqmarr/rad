"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { sileo } from "sileo";
import { useInlineEdit, useSiteRuntime } from "./Providers";
import {
  updatePageBlockAction,
  updateSiteSettingsAction,
  quickUpdateProductFieldAction,
} from "@/app/admin/actions";

interface EditableBlockTextProps {
  pageSlug: string;
  blockKey: string;
  label?: string;
  value: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  multiline?: boolean;
  className?: string;
}

export function EditableBlockText({
  pageSlug,
  blockKey,
  label,
  value,
  as = "p",
  multiline = false,
  className = "",
}: EditableBlockTextProps) {
  const { isEditMode } = useInlineEdit();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const Tag = as;

  if (!isEditMode) {
    return <Tag className={className}>{value}</Tag>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePageBlockAction({
        pageSlug,
        blockKey,
        label,
        content: draft,
      });
      setEditing(false);
      router.refresh();
      sileo.success({
        title: "Content Updated",
        description: `Saved "${label || blockKey}" to database.`,
      });
    } catch (err) {
      sileo.error({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Could not save block",
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-md border border-[#EA6A12] bg-white p-3 shadow-sm text-left">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#EA6A12]">
          Editing: {label || `${pageSlug}.${blockKey}`}
        </div>
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-[#141A21] focus:border-[#EA6A12] outline-none"
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-[#141A21] focus:border-[#EA6A12] outline-none"
          />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1 rounded bg-[#141A21] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#EA6A12] cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="inline-flex items-center gap-1 rounded border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <Tag
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit inline"
      className={`${className} group/edit relative cursor-pointer rounded outline-1 outline-dashed outline-[#EA6A12]/60 hover:outline-[#EA6A12] hover:bg-orange-50/30 transition-colors`}
    >
      {value}
      <span className="ml-2 inline-flex items-center gap-1 rounded bg-[#EA6A12] px-1.5 py-0.5 text-[10px] font-sans font-semibold text-white align-middle">
        <Pencil className="w-2.5 h-2.5" /> Edit
      </span>
    </Tag>
  );
}

interface EditableSettingTextProps {
  settingKey: string;
  label?: string;
  value: string;
  className?: string;
}

export function EditableSettingText({
  settingKey,
  label,
  value,
  className = "",
}: EditableSettingTextProps) {
  const { isEditMode } = useInlineEdit();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (!isEditMode) {
    return <span className={className}>{value}</span>;
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded border border-[#EA6A12] bg-white px-2 py-1 text-xs text-[#141A21]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="border border-stone-300 rounded px-2 py-1 text-xs min-w-[200px]"
        />
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await updateSiteSettingsAction({ [settingKey]: draft });
              setEditing(false);
              router.refresh();
              sileo.success({ title: "Setting Saved", description: label || settingKey });
            } catch (err) {
              sileo.error({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to save",
              });
            } finally {
              setSaving(false);
            }
          }}
          className="rounded bg-[#141A21] px-2 py-1 text-white hover:bg-[#EA6A12] cursor-pointer"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-stone-300 px-2 py-1 text-stone-700 cursor-pointer"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={(e) => {
        e.preventDefault();
        setDraft(value);
        setEditing(true);
      }}
      className={`${className} cursor-pointer underline decoration-dashed decoration-[#EA6A12] underline-offset-4`}
      title={`Edit setting: ${label || settingKey}`}
    >
      {value}
    </span>
  );
}

interface InlineProductPriceEditorProps {
  productId: number;
  pricingMode: "priced" | "rfq_only";
  basePrice: number | null;
  priceUnit: string;
  gstPercent: number;
}

export function InlineProductPriceEditor({
  productId,
  pricingMode,
  basePrice,
  priceUnit,
  gstPercent,
}: InlineProductPriceEditorProps) {
  const { isEditMode } = useInlineEdit();
  const { showPublicPrices } = useSiteRuntime();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"priced" | "rfq_only">(pricingMode);
  const [price, setPrice] = useState(basePrice != null ? String(basePrice) : "");
  const [unit, setUnit] = useState(priceUnit);
  const [saving, setSaving] = useState(false);

  const shouldRevealPrice = (showPublicPrices || isEditMode) && pricingMode === "priced" && basePrice != null;

  const display = shouldRevealPrice ? (
    <div>
      <div className="font-mono-num text-2xl font-bold text-[#141A21]">
        ₹{basePrice!.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="text-sm font-normal text-stone-500"> / {priceUnit}</span>
      </div>
      <div className="text-xs text-stone-500 font-mono-num">
        Excl. {gstPercent}% GST • {showPublicPrices ? "Wholesale Base Rate" : "Internal Saved Rate (Public sees Ask for Price)"}
      </div>
    </div>
  ) : (
    <div>
      <div className="text-xl font-bold text-[#141A21]">Ask for Price</div>
      <div className="text-xs text-stone-500">
        Instant quote via WhatsApp or Email • Unit: {priceUnit}
      </div>
    </div>
  );

  if (!isEditMode) return display;

  if (editing) {
    return (
      <div className="rounded-md border border-[#EA6A12] bg-white p-3 space-y-2">
        <div className="flex gap-2 text-xs">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "priced" | "rfq_only")}
            className="border border-stone-300 rounded px-2 py-1.5"
          >
            <option value="priced">Priced (Show Rate)</option>
            <option value="rfq_only">Request Quote</option>
          </select>
          {mode === "priced" && (
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Base Price INR"
              className="border border-stone-300 rounded px-2 py-1.5 w-32 font-mono"
            />
          )}
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit (NOS)"
            className="border border-stone-300 rounded px-2 py-1.5 w-20 font-mono"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await quickUpdateProductFieldAction({
                  id: productId,
                  pricingMode: mode,
                  basePrice: mode === "priced" ? Number(price) || 0 : null,
                  priceUnit: unit,
                });
                setEditing(false);
                router.refresh();
                sileo.success({ title: "Pricing Updated" });
              } catch (err) {
                sileo.error({
                  title: "Failed",
                  description: err instanceof Error ? err.message : "Error",
                });
              } finally {
                setSaving(false);
              }
            }}
            className="bg-[#141A21] text-white text-xs px-3 py-1.5 rounded hover:bg-[#EA6A12] cursor-pointer"
          >
            {saving ? "Saving..." : "Save Price"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="border border-stone-300 text-xs px-3 py-1.5 rounded cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer rounded p-2 -m-2 outline-1 outline-dashed outline-[#EA6A12] hover:bg-orange-50/40"
      title="Click to edit price inline"
    >
      {display}
      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#EA6A12]">
        <Pencil className="w-3 h-3" /> Edit Price Inline
      </span>
    </div>
  );
}
