"use client";

import React, { useState } from "react";
import { X, Trash2, Mail, Loader2, FileSpreadsheet } from "lucide-react";
import { sileo } from "sileo";
import { useQuoteCart, useSiteRuntime } from "./Providers";
import { DropzoneUploader } from "./DropzoneUploader";
import { WhatsAppIcon } from "./WhatsAppIcon";

export function QuoteSheetDrawer() {
  const { items, isDrawerOpen, setDrawerOpen, updateQty, removeItem, clearCart } = useQuoteCart();
  const { openDirectWhatsApp } = useSiteRuntime();

  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isDrawerOpen) return null;

  const handleInstantWhatsApp = () => {
    if (items.length === 0 && !notes.trim()) {
      sileo.warning({ title: "Quote List Empty", description: "Add items or enter a note first." });
      return;
    }
    openDirectWhatsApp({
      items,
      customerName: customerName || undefined,
      companyName: companyName || undefined,
      deliveryLocation: deliveryLocation || undefined,
      notes: notes || (attachmentUrl ? `Attached file: ${attachmentUrl}` : undefined),
    });
    sileo.success({ title: "Opening WhatsApp Quote" });
  };

  const handleEmailEnquiry = async () => {
    if (items.length === 0 && !attachmentUrl && !notes.trim()) {
      sileo.warning({ title: "Quote List Empty", description: "Add items or attach a file first." });
      return;
    }
    if (!customerName.trim() || !email.trim()) {
      sileo.warning({
        title: "Name & Email Needed",
        description: "Enter your name and email address below to dispatch the multi-item email.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          customerName,
          companyName,
          email,
          phone,
          deliveryLocation,
          items,
          attachmentUrl,
          message:
            notes ||
            `Multi-product email enquiry for ${items.length} item(s). Please share pricing & GST quote.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email enquiry");

      sileo.success({
        title: "Multi-Item Email Dispatched",
        description: `Reference ${data.referenceNo} sent to our team${
          data.customerThankYouSent ? " + thank-you confirmation sent to your email." : "."
        }`,
      });
      clearCart();
      setDrawerOpen(false);
    } catch (err) {
      sileo.error({
        title: "Email Failed",
        description: err instanceof Error ? err.message : "Could not submit",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#141A21]/50 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-lg flex-col bg-white border-l border-stone-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
          <div>
            <h2 className="text-lg font-bold text-[#141A21] tracking-tight">
              Your Quote List ({items.length})
            </h2>
            <p className="text-xs text-stone-500">
              Send all items directly on WhatsApp or dispatch a smart Email enquiry
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded p-1.5 text-stone-500 hover:bg-stone-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="rounded border border-dashed border-stone-300 bg-stone-50 p-6 text-left">
              <FileSpreadsheet className="w-6 h-6 text-stone-400 mb-2" />
              <p className="text-sm font-medium text-[#141A21]">Your Quote List is empty.</p>
              <p className="text-xs text-stone-500 mt-1">
                Click + List on any product to bundle multiple items together, or upload an existing requirement file below.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-200 border border-stone-200 rounded-md">
              {items.map((item) => (
                <div key={item.sku} className="p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-stone-500">{item.sku}</div>
                    <div className="text-sm font-semibold text-[#141A21] leading-snug">{item.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {item.brand ? `${item.brand} • ` : ""}Ask for Price
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      value={item.qty}
                      onChange={(e) => updateQty(item.sku, e.target.value)}
                      className="w-16 rounded border border-stone-300 px-2 py-1 text-xs font-mono text-center"
                    />
                    <span className="text-xs font-mono text-stone-500">{item.unit}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.sku)}
                      className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DropzoneUploader
            folder="rfq-bom"
            scope="rfq"
            label="Attach Requirement List / PO / Drawing (Optional)"
            helperText="PDF, Excel (.xlsx), Word, or Image up to 15 MB"
            currentUrl={attachmentUrl}
            onUploaded={(meta) => setAttachmentUrl(meta.url)}
            onClear={() => setAttachmentUrl(null)}
          />

          <div className="space-y-3 pt-2 border-t border-stone-200">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Your Contact Details (Required for Email Dispatch)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your Name *"
                className="rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
              />
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company Name"
                className="rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address *"
                className="rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone / WhatsApp"
                className="rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
              />
            </div>
            <input
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              placeholder="Delivery City & PIN Code"
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
            />
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra notes, unlisted products, or target delivery dates..."
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12] resize-none"
            />
          </div>
        </div>

        <div className="border-t border-stone-200 bg-stone-50 p-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleInstantWhatsApp}
            className="flex items-center justify-center gap-2 rounded bg-[#16A34A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#15803D] cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            WhatsApp Quote
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleEmailEnquiry}
            className="flex items-center justify-center gap-2 rounded bg-[#141A21] px-4 py-3 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Enquire via Email
          </button>
        </div>
      </div>
    </div>
  );
}
