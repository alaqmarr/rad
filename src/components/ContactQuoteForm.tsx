"use client";

import React, { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { sileo } from "sileo";
import { DropzoneUploader } from "./DropzoneUploader";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { useSiteRuntime } from "./Providers";

export function ContactQuoteForm() {
  const { openDirectWhatsApp } = useSiteRuntime();
  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "contact_form",
          customerName,
          companyName,
          email,
          phone,
          gstNumber,
          deliveryLocation,
          attachmentUrl,
          items: [
            {
              name: "Custom Product / Supply Requirement",
              qty: "As listed",
              unit: "REQ",
              listedPrice: null,
            },
          ],
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit request");

      setSubmittedRef(data.referenceNo);
      sileo.success({
        title: "Email Enquiry Sent",
        description: data.emailSent
          ? `Reference ${data.referenceNo} sent to our team${
              data.customerThankYouSent ? " + thank-you mail sent to you." : "."
            }`
          : `Saved as ${data.referenceNo}.`,
      });
    } catch (err) {
      sileo.error({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Error submitting form",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectWhatsApp = () => {
    openDirectWhatsApp({
      customerName: customerName || undefined,
      companyName: companyName || undefined,
      deliveryLocation: deliveryLocation || undefined,
      notes: message || "I would like to discuss a product requirement and get a quote.",
    });
  };

  if (submittedRef) {
    return (
      <div className="rounded-md border border-emerald-200 bg-white p-8 space-y-4">
        <div className="inline-flex items-center gap-2 text-emerald-700 font-bold text-lg">
          <CheckCircle2 className="w-5 h-5" />
          Enquiry Received — {submittedRef}
        </div>
        <p className="text-sm text-stone-600 leading-relaxed">
          Thank you, {customerName}. Our Secunderabad sales team has logged your requirement, sent a confirmation email to <strong>{email}</strong>, and will reply shortly with pricing and delivery timelines.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setSubmittedRef(null);
              setMessage("");
              setAttachmentUrl(null);
            }}
            className="rounded bg-[#141A21] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
          >
            Send Another Enquiry
          </button>
          <button
            type="button"
            onClick={handleDirectWhatsApp}
            className="inline-flex items-center gap-2 rounded bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Also Follow Up on WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Direct Instant WhatsApp Card (Always Opens User's WhatsApp Directly) */}
      <div className="rounded-md border border-[#16A34A]/30 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#141A21]">
            Need a faster reply? Message us directly on WhatsApp
          </h2>
          <p className="text-xs text-stone-600 mt-0.5">
            Opens WhatsApp right away with a pre-filled message — no form needed.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDirectWhatsApp}
          className="inline-flex items-center justify-center gap-2 rounded bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#15803D] transition-colors shrink-0 cursor-pointer"
        >
          <WhatsAppIcon className="w-4 h-4" />
          Enquire on WhatsApp
        </button>
      </div>

      {/* Email Enquiry Form */}
      <form
        onSubmit={handleEmailSubmit}
        className="rounded-md border border-[#E4E4E0] bg-white p-6 sm:p-8 space-y-5"
      >
        <div className="border-b border-stone-200 pb-3">
          <h2 className="text-lg font-bold text-[#141A21] flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#EA6A12]" />
            Send Email Enquiry
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Send your item list or attach a spreadsheet/PDF — we will email you an instant confirmation and quote.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Full Name *</label>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your Full Name"
              className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Company Name</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Factory / Business Name"
              className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Email Address *
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.in"
              className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
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
              className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              GSTIN (Optional)
            </label>
            <input
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="36AA..."
              className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#EA6A12]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Delivery City &amp; State
            </label>
            <input
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              placeholder="Hyderabad, Telangana"
              className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Items, Brands, Sizes &amp; Quantities Needed *
          </label>
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Example:&#10;1. SKF 6205-2Z Bearings — 50 NOS&#10;2. Polycab 4C x 4 sqmm Copper Cable — 400 MTRS&#10;3. ESAB Leather Welding Aprons — 10 NOS"
            className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
          />
        </div>

        <DropzoneUploader
          folder="rfq-bom"
          scope="rfq"
          label="Attach Item List, Spreadsheet, or Drawing (Optional)"
          helperText="Drag & drop PDF, Excel (.xlsx/.csv), Word, or Image up to 15 MB"
          currentUrl={attachmentUrl}
          onUploaded={(meta) => setAttachmentUrl(meta.url)}
          onClear={() => setAttachmentUrl(null)}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded bg-[#EA6A12] py-3.5 text-sm font-semibold text-white hover:bg-[#C95609] transition-colors cursor-pointer"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Send Email Enquiry
        </button>
      </form>
    </div>
  );
}
