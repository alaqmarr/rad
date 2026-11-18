"use client";

import React, { useState } from "react";
import { Mail, Plus } from "lucide-react";
import { useQuoteCart, useSiteRuntime } from "./Providers";
import { QuickQuoteModal } from "./QuickQuoteModal";
import { WhatsAppIcon } from "./WhatsAppIcon";
import type { EnquiryItem } from "@/db/schema";

export function ProductDetailActions({ item }: { item: EnquiryItem }) {
  const { addItem } = useQuoteCart();
  const { openDirectWhatsApp, showPublicPrices } = useSiteRuntime();
  const [qty, setQty] = useState(item.qty || "1");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const configuredItem: EnquiryItem = {
    ...item,
    qty: qty || "1",
    listedPrice: showPublicPrices ? item.listedPrice : null,
  };

  return (
    <>
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-stone-500">
            Required Qty ({item.unit || "NOS"})
          </label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-24 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-center outline-none focus:border-[#EA6A12]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => openDirectWhatsApp({ items: [configuredItem] })}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#16A34A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803D] transition-colors cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Get Quote on WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#141A21] px-4 py-3 text-sm font-semibold text-white hover:bg-[#EA6A12] transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            Email Enquiry
          </button>
          <button
            type="button"
            onClick={() =>
              addItem({
                productId: configuredItem.productId,
                sku: configuredItem.sku || "CUSTOM",
                name: configuredItem.name,
                brand: configuredItem.brand,
                qty: configuredItem.qty,
                unit: configuredItem.unit || "NOS",
                listedPrice: configuredItem.listedPrice ?? null,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded border border-[#141A21] bg-white px-4 py-3 text-sm font-semibold text-[#141A21] hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add to Quote List
          </button>
        </div>

        <p className="text-xs text-stone-500">
          WhatsApp opens immediately with this product pre-filled, or click Email Enquiry for a formal quotation &amp; confirmation email.
        </p>
      </div>

      <QuickQuoteModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        item={configuredItem}
      />
    </>
  );
}
