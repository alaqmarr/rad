"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Mail, ArrowUpRight } from "lucide-react";
import { useQuoteCart, useSiteRuntime, useInlineEdit } from "./Providers";
import { QuickQuoteModal } from "./QuickQuoteModal";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { ProductFallbackVisual } from "./ProductFallbackVisual";
import type { SpecRow } from "@/db/schema";

export interface ProductCardData {
  id: number;
  slug: string;
  sku: string;
  name: string;
  shortDescription: string;
  pricingMode: string;
  basePrice: number | null;
  priceUnit: string;
  gstPercent: number;
  leadTime: string;
  primaryImageUrl: string | null;
  fallbackImageUrl?: string | null;
  specificationsJson?: string;
  brandName: string | null;
  brandSlug: string | null;
  categoryName: string | null;
}

function formatInr(amount: number): string {
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function ProductCard({ item }: { item: ProductCardData }) {
  const { addItem } = useQuoteCart();
  const { showPublicPrices, openDirectWhatsApp } = useSiteRuntime();
  const { isEditMode } = useInlineEdit();
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  let quickSpecs: SpecRow[] = [];
  try {
    quickSpecs = JSON.parse(item.specificationsJson || "[]").slice(0, 2);
  } catch {
    quickSpecs = [];
  }

  const enquiryItem = {
    productId: item.id,
    sku: item.sku,
    name: item.name,
    brand: item.brandName || undefined,
    qty: "1",
    unit: item.priceUnit,
    listedPrice: showPublicPrices && item.pricingMode === "priced" ? item.basePrice : null,
  };

  const revealPrice = (showPublicPrices || isEditMode) && item.pricingMode === "priced" && item.basePrice != null;

  return (
    <>
      <article className="group flex flex-col justify-between rounded-md border border-stone-200 bg-white overflow-hidden transition-all duration-200 hover:border-stone-400 hover:shadow-md">
        <div>
          <Link href={`/products/${item.slug}`} className="block border-b border-stone-200">
            {item.primaryImageUrl && !imgFailed ? (
              <div className="aspect-[16/10] w-full overflow-hidden bg-[#F8F8F6] flex items-center justify-center p-3">
                <img
                  src={item.primaryImageUrl}
                  alt={item.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ) : (
              <ProductFallbackVisual
                name={item.name}
                sku={item.sku}
                brandName={item.brandName}
                categoryName={item.categoryName}
                variant="card"
              />
            )}
          </Link>

          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#EA6A12] truncate">
                {item.brandName || "Multi-Brand Sourcing"}
              </span>
              <span className="font-mono text-[11px] text-stone-500 shrink-0">
                {item.leadTime}
              </span>
            </div>

            <Link href={`/products/${item.slug}`} className="block">
              <h3 className="text-base font-bold text-[#141A21] leading-snug group-hover:text-[#EA6A12] transition-colors">
                {item.name}
              </h3>
            </Link>

            <p className="text-sm text-stone-600 leading-relaxed line-clamp-2">
              {item.shortDescription}
            </p>

            {quickSpecs.length > 0 && (
              <dl className="pt-3 border-t border-stone-100 space-y-1.5 text-xs">
                {quickSpecs.map((spec, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-baseline">
                    <dt className="col-span-5 text-stone-500">{spec.label}</dt>
                    <dd className="col-span-7 font-mono text-[#141A21] font-medium text-right">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 px-5 py-4 space-y-3 bg-[#FAFAF8]">
          <div className="flex items-start justify-between gap-2">
            {revealPrice ? (
              <div>
                <div className="font-mono-num text-lg font-bold text-[#141A21] leading-none">
                  ₹{formatInr(item.basePrice!)}
                  <span className="text-xs font-normal text-stone-500"> / {item.priceUnit}</span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  +{item.gstPercent}% GST extra
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold text-[#141A21]">Ask for Price</div>
                <div className="text-[11px] text-stone-500 mt-0.5">Unit: {item.priceUnit}</div>
              </div>
            )}
            <Link
              href={`/products/${item.slug}`}
              className="text-xs font-semibold text-stone-600 hover:text-[#141A21] inline-flex items-center gap-0.5 shrink-0 pt-0.5"
            >
              Details <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <button
              type="button"
              onClick={() =>
                openDirectWhatsApp({
                  items: [enquiryItem],
                  pageUrl:
                    typeof window !== "undefined"
                      ? `${window.location.origin}/products/${item.slug}`
                      : undefined,
                })
              }
              className="col-span-5 inline-flex items-center justify-center gap-1.5 rounded bg-[#16A34A] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#15803D] transition-colors cursor-pointer"
              title="Open WhatsApp with pre-filled quote message"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              className="col-span-4 inline-flex items-center justify-center gap-1 rounded bg-[#141A21] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#EA6A12] transition-colors cursor-pointer"
              title="Quick Email Enquiry"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
            <button
              type="button"
              onClick={() => addItem(enquiryItem)}
              className="col-span-3 inline-flex items-center justify-center gap-1 rounded border border-stone-300 bg-white px-2 py-2 text-xs font-semibold text-[#141A21] hover:border-[#141A21] transition-colors cursor-pointer"
              title="Add to Quote List"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </article>

      <QuickQuoteModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        item={enquiryItem}
      />
    </>
  );
}
