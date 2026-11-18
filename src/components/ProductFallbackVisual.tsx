import React from "react";

interface ProductFallbackVisualProps {
  name: string;
  sku: string;
  brandName?: string | null;
  categoryName?: string | null;
  variant?: "card" | "detail";
}

/**
 * Typographic studio fallback card rendered when a product has no uploaded image,
 * showcasing the product name itself with industrial blueprint styling.
 */
export function ProductFallbackVisual({
  name,
  sku,
  brandName,
  categoryName,
  variant = "card",
}: ProductFallbackVisualProps) {
  const isDetail = variant === "detail";

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#141A21] text-white select-none flex flex-col justify-between ${
        isDetail ? "h-full p-6 sm:p-8" : "aspect-[16/10] p-4 sm:p-5"
      }`}
    >
      {/* Subtle architectural blueprint grid & warm ambient corner highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: isDetail ? "28px 28px" : "22px 22px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#EA6A12]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-slate-500/15 blur-2xl"
      />

      {/* Top Strip: Brand + SKU */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded border border-[#EA6A12]/40 bg-[#EA6A12]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#F79A52] truncate max-w-[60%]">
          {brandName || "Radiant Industrial"}
        </span>
        <span className="font-mono text-[10px] sm:text-[11px] text-stone-300 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
          {sku}
        </span>
      </div>

      {/* Centerpiece: Rendered Product Name */}
      <div className="relative z-10 my-auto py-2 pl-3 border-l-2 border-[#EA6A12]">
        <div
          className={`font-bold text-white tracking-tight ${
            isDetail
              ? "text-xl sm:text-2xl leading-snug line-clamp-4"
              : "text-sm sm:text-[15px] leading-snug line-clamp-3 group-hover:text-[#FDBA8C] transition-colors"
          }`}
        >
          {name}
        </div>
      </div>

      {/* Bottom Strip: Category */}
      <div className="relative z-10 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        <span className="text-[11px] font-medium text-stone-300 truncate">
          {categoryName || "Industrial Supply"}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 shrink-0">
          Radiant Catalog
        </span>
      </div>
    </div>
  );
}
