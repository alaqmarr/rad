"use client";

import React, { useState, useEffect } from "react";
import { X, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { sileo } from "sileo";
import type { EnquiryItem } from "@/db/schema";

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: EnquiryItem;
  pageUrl?: string;
}

export function QuickQuoteModal({ isOpen, onClose, item, pageUrl }: QuickQuoteModalProps) {
  const [qty, setQty] = useState(item.qty || "1");
  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQty(item.qty || "1");
      setNotes(
        `Please share your best wholesale price, GST rate, and delivery timeline for ${item.name}${
          item.sku ? ` (Code: ${item.sku})` : ""
        }${item.brand ? ` — Brand: ${item.brand}` : ""}.`
      );
      setDoneRef(null);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const activeItem: EnquiryItem = { ...item, qty: qty || "1" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          gstNumber,
          deliveryLocation,
          items: [activeItem],
          message: notes,
          pageUrl: pageUrl || (typeof window !== "undefined" ? window.location.href : ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send email enquiry");

      setDoneRef(data.referenceNo);
      sileo.success({
        title: "Email Enquiry Sent",
        description: data.emailSent
          ? `Reference ${data.referenceNo} dispatched${data.customerThankYouSent ? " + confirmation emailed to you." : "."}`
          : `Saved as ${data.referenceNo}.`,
      });
    } catch (err) {
      sileo.error({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141A21]/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-lg border border-stone-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-[#EA6A12]" />
            <div>
              <h3 className="text-lg font-bold text-[#141A21] tracking-tight">
                Quick Email Enquiry
              </h3>
              <p className="text-xs font-mono text-stone-500 mt-0.5">
                {item.sku ? `${item.sku} — ` : ""}
                {item.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-stone-500 hover:bg-stone-200 hover:text-[#141A21] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {doneRef ? (
          <div className="p-8 text-left space-y-4">
            <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Email Enquiry Sent — {doneRef}
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              Thank you! Our Ranigunj sales team has received your enquiry for{" "}
              <strong className="text-[#141A21]">{item.name}</strong> ({qty} {item.unit || "NOS"}) and sent a confirmation email to{" "}
              <strong>{email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setDoneRef(null);
                onClose();
              }}
              className="rounded bg-[#141A21] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="rounded border border-stone-200 bg-[#F9F9F7] px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#141A21]">{item.name}</span>
              <span className="font-mono text-stone-500">
                {item.brand ? `${item.brand} • ` : ""}
                {item.sku || "CUSTOM"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Quantity ({item.unit || "NOS"}) *
                </label>
                <input
                  required
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono focus:border-[#EA6A12] outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Your Name *
                </label>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-[#EA6A12] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.in"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-[#EA6A12] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Phone / WhatsApp *
                </label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-[#EA6A12] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Company</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company / Plant"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-[#EA6A12] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Delivery City
                </label>
                <input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="Hyderabad"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-[#EA6A12] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  GSTIN (Opt.)
                </label>
                <input
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="36AA..."
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono focus:border-[#EA6A12] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Pre-filled Enquiry Message
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-[#EA6A12] outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609] cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Email Enquiry
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
