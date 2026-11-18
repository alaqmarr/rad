"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { Toaster, sileo } from "sileo";
import Link from "next/link";
import { Pencil, Eye, LayoutDashboard, LogOut, PackagePlus } from "lucide-react";
import type { EnquiryItem } from "@/db/schema";

export interface QuoteCartItem {
  productId?: number;
  sku: string;
  name: string;
  brand?: string;
  qty: string;
  unit: string;
  listedPrice: number | null;
  slug?: string;
}

interface SiteRuntimeContextType {
  whatsappNumber: string;
  showPublicPrices: boolean;
  openDirectWhatsApp: (params: {
    items?: EnquiryItem[];
    customerName?: string;
    companyName?: string;
    deliveryLocation?: string;
    notes?: string;
    pageUrl?: string;
  }) => void;
}

const SiteRuntimeContext = createContext<SiteRuntimeContextType>({
  whatsappNumber: "918522095253",
  showPublicPrices: false,
  openDirectWhatsApp: () => {},
});

export function useSiteRuntime() {
  return useContext(SiteRuntimeContext);
}

interface QuoteCartContextType {
  items: QuoteCartItem[];
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (item: QuoteCartItem) => void;
  updateQty: (sku: string, qty: string) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
}

const QuoteCartContext = createContext<QuoteCartContextType>({
  items: [],
  isDrawerOpen: false,
  setDrawerOpen: () => {},
  addItem: () => {},
  updateQty: () => {},
  removeItem: () => {},
  clearCart: () => {},
});

export function useQuoteCart() {
  return useContext(QuoteCartContext);
}

interface InlineEditContextType {
  isAdmin: boolean;
  isEditMode: boolean;
  setEditMode: (v: boolean) => void;
}

const InlineEditContext = createContext<InlineEditContextType>({
  isAdmin: false,
  isEditMode: false,
  setEditMode: () => {},
});

export function useInlineEdit() {
  return useContext(InlineEditContext);
}

function AdminFloatingToolbar({
  isEditMode,
  setEditMode,
}: {
  isEditMode: boolean;
  setEditMode: (v: boolean) => void;
}) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-wrap items-center gap-2 rounded-lg border border-stone-700 bg-[#141A21] px-3 py-2 text-xs text-white shadow-2xl">
      <span className="font-mono text-[11px] text-stone-400 pr-2 border-r border-stone-700">
        ADMIN: {session.user.email}
      </span>
      <button
        type="button"
        onClick={() => {
          const next = !isEditMode;
          setEditMode(next);
          sileo.info({
            title: next ? "Inline Edit Mode Enabled" : "View Mode Enabled",
            description: next
              ? "Click any highlighted heading, paragraph, or price to edit in place."
              : "Live site preview restored.",
          });
        }}
        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
          isEditMode
            ? "bg-[#EA6A12] text-white"
            : "bg-stone-800 text-stone-200 hover:bg-stone-700"
        }`}
      >
        {isEditMode ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        {isEditMode ? "Exit Inline Edit" : "Edit Page Inline"}
      </button>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 rounded bg-stone-800 px-2.5 py-1.5 font-medium text-stone-200 hover:bg-stone-700 transition-colors"
      >
        <PackagePlus className="w-3.5 h-3.5" />
        Catalog
      </Link>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded bg-stone-800 px-2.5 py-1.5 font-medium text-stone-200 hover:bg-stone-700 transition-colors"
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        Dashboard
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-stone-400 hover:text-white cursor-pointer"
        title="Sign out"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function InnerProviders({
  children,
  whatsappNumber,
  showPublicPrices,
}: {
  children: React.ReactNode;
  whatsappNumber: string;
  showPublicPrices: boolean;
}) {
  const { data: session } = useSession();
  const [isEditMode, setEditMode] = useState(false);
  const [items, setItems] = useState<QuoteCartItem[]>([]);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("radiant_rfq_cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: QuoteCartItem[]) => {
    setItems(next);
    try {
      localStorage.setItem("radiant_rfq_cart", JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const addItem = (item: QuoteCartItem) => {
    const idx = items.findIndex((i) => i.sku === item.sku);
    if (idx >= 0) {
      const updated = [...items];
      const existingQty = Number(updated[idx].qty) || 1;
      const addQty = Number(item.qty) || 1;
      updated[idx] = { ...updated[idx], qty: String(existingQty + addQty) };
      persist(updated);
    } else {
      persist([...items, item]);
    }
    sileo.success({
      title: "Added to Quote List",
      description: `${item.name} (${item.sku})`,
    });
  };

  const updateQty = (sku: string, qty: string) => {
    persist(items.map((i) => (i.sku === sku ? { ...i, qty } : i)));
  };

  const removeItem = (sku: string) => {
    persist(items.filter((i) => i.sku !== sku));
  };

  const clearCart = () => persist([]);

  const openDirectWhatsApp: SiteRuntimeContextType["openDirectWhatsApp"] = (params) => {
    const cleanPhone = (whatsappNumber || "918522095253").replace(/[^\d]/g, "") || "918522095253";
    const list = params.items || [];
    const lines: string[] = [
      "Hello Radiant Industrial Co.,",
      list.length > 0
        ? "Please share your best price and delivery timeline for:"
        : "I would like to enquire about industrial/agricultural supplies:",
    ];

    if (list.length > 0) {
      lines.push("");
      list.forEach((it, idx) => {
        const brandStr = it.brand ? ` (${it.brand})` : "";
        const skuStr = it.sku ? `[${it.sku}] ` : "";
        const priceStr =
          showPublicPrices && it.listedPrice != null
            ? ` — Listed: ₹${Number(it.listedPrice).toLocaleString("en-IN")}/${it.unit || "NOS"}`
            : "";
        lines.push(
          `${idx + 1}. ${skuStr}${it.name}${brandStr} — Qty: ${it.qty || "1"} ${it.unit || "NOS"}${priceStr}`
        );
      });
    }

    if (params.customerName || params.companyName) {
      lines.push("");
      lines.push(
        `Name: ${[params.customerName, params.companyName].filter(Boolean).join(" | ")}`
      );
    }
    if (params.deliveryLocation) lines.push(`Delivery Location: ${params.deliveryLocation}`);
    if (params.notes) lines.push(`Notes: ${params.notes}`);
    const refUrl = params.pageUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (refUrl) lines.push(`Link: ${refUrl}`);

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");

    // Log enquiry silently in background
    fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        channel: "whatsapp",
        customerName: params.customerName || "WhatsApp Visitor",
        companyName: params.companyName || "",
        deliveryLocation: params.deliveryLocation || "",
        items: list,
        message: params.notes || "Opened direct WhatsApp quote",
        pageUrl: refUrl,
      }),
    }).catch(() => null);
  };

  return (
    <SiteRuntimeContext.Provider
      value={{ whatsappNumber, showPublicPrices, openDirectWhatsApp }}
    >
      <InlineEditContext.Provider
        value={{
          isAdmin: Boolean(session?.user),
          isEditMode: Boolean(session?.user) && isEditMode,
          setEditMode,
        }}
      >
        <QuoteCartContext.Provider
          value={{
            items,
            isDrawerOpen,
            setDrawerOpen,
            addItem,
            updateQty,
            removeItem,
            clearCart,
          }}
        >
          {children}
          <AdminFloatingToolbar isEditMode={isEditMode} setEditMode={setEditMode} />
        </QuoteCartContext.Provider>
      </InlineEditContext.Provider>
    </SiteRuntimeContext.Provider>
  );
}

export function Providers({
  children,
  whatsappNumber = "918522095253",
  showPublicPrices = false,
}: {
  children: React.ReactNode;
  whatsappNumber?: string;
  showPublicPrices?: boolean;
}) {
  return (
    <SessionProvider>
      <InnerProviders
        whatsappNumber={whatsappNumber}
        showPublicPrices={showPublicPrices}
      >
        <Toaster position="top-right" theme="light" />
        {children}
      </InnerProviders>
    </SessionProvider>
  );
}
