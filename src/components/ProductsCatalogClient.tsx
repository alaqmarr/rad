"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LayoutGrid, TableProperties, Plus, Mail } from "lucide-react";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { useQuoteCart, useSiteRuntime, useInlineEdit } from "./Providers";
import { QuickQuoteModal } from "./QuickQuoteModal";
import { WhatsAppIcon } from "./WhatsAppIcon";

export function ProductsCatalogClient({ items }: { items: ProductCardData[] }) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [emailItem, setEmailItem] = useState<ProductCardData | null>(null);
  const { addItem } = useQuoteCart();
  const { showPublicPrices, openDirectWhatsApp } = useSiteRuntime();
  const { isEditMode } = useInlineEdit();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 pb-3">
        <span className="text-xs font-mono text-stone-600">
          SHOWING {items.length} ITEMS
        </span>

        <div className="flex items-center gap-4">
          <Link
            href="/contact"
            className="hidden sm:inline text-xs font-semibold text-[#EA6A12] hover:underline"
          >
            Need something not listed? Ask us →
          </Link>
          <div className="inline-flex rounded border border-stone-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                view === "grid" ? "bg-[#141A21] text-white" : "text-stone-600"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                view === "table" ? "bg-[#141A21] text-white" : "text-stone-600"
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" /> Price List
            </button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-mono uppercase text-stone-500">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Delivery</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {items.map((item) => {
                const reveal =
                  (showPublicPrices || isEditMode) &&
                  item.pricingMode === "priced" &&
                  item.basePrice != null;
                const enquiryItem = {
                  productId: item.id,
                  sku: item.sku,
                  name: item.name,
                  brand: item.brandName || undefined,
                  qty: "1",
                  unit: item.priceUnit,
                  listedPrice: reveal ? item.basePrice : null,
                };
                return (
                  <tr key={item.id} className="hover:bg-[#F9F9F7]">
                    <td className="py-3 px-4 font-mono text-xs text-stone-500">{item.sku}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/products/${item.slug}`}
                        className="font-semibold text-[#141A21] hover:text-[#EA6A12]"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {item.brandName || "Multi-Brand"}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#141A21]">
                      {reveal
                        ? `₹${item.basePrice!.toLocaleString("en-IN")} / ${item.priceUnit}`
                        : "Ask for Price"}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-500">{item.leadTime}</td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openDirectWhatsApp({ items: [enquiryItem] })}
                        className="inline-flex items-center gap-1 rounded bg-[#16A34A] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#15803D] cursor-pointer"
                      >
                        <WhatsAppIcon className="w-3 h-3" /> WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailItem(item)}
                        className="inline-flex items-center gap-1 rounded bg-[#141A21] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
                      >
                        <Mail className="w-3 h-3" /> Email
                      </button>
                      <button
                        type="button"
                        onClick={() => addItem(enquiryItem)}
                        className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs font-semibold text-[#141A21] hover:border-[#141A21] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> List
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {emailItem && (
        <QuickQuoteModal
          isOpen={true}
          onClose={() => setEmailItem(null)}
          item={{
            productId: emailItem.id,
            sku: emailItem.sku,
            name: emailItem.name,
            brand: emailItem.brandName || undefined,
            qty: "1",
            unit: emailItem.priceUnit,
            listedPrice: null,
          }}
        />
      )}
    </div>
  );
}
