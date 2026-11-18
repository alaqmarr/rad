"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import { Mail, FileText, Loader2, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { BulkSelectionBar } from "./BulkSelectionBar";
import { useBulkSelection } from "@/lib/selection";
import {
  updateEnquiryStatusAction,
  deleteEnquiryAction,
  bulkDeleteEnquiriesAction,
} from "@/app/admin/actions";
import type { EnquiryItem } from "@/db/schema";

interface EnquiryRow {
  id: number;
  referenceNo: string;
  channel: string;
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  gstNumber: string;
  deliveryLocation: string;
  itemsJson: string;
  attachmentUrl: string | null;
  message: string;
  status: string;
  emailSent: boolean;
  whatsappDispatched: boolean;
  adminNotes: string;
  createdAt: string;
}

export function EnquiriesManager({ enquiries }: { enquiries: EnquiryRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusDraft, setStatusDraft] = useState("new");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = enquiries.filter((e) => (filter === "all" ? true : e.status === filter));
  const selection = useBulkSelection(filtered.map((e) => e.id));

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (
      !confirm(
        `Delete ${selection.selectedIds.length} selected enquiry record(s) permanently?`
      )
    ) {
      return;
    }
    selection.setBulkDeleting(true);
    try {
      const res = await bulkDeleteEnquiriesAction(selection.selectedIds);
      selection.clearSelection();
      router.refresh();
      sileo.success({
        title: "Enquiries Deleted",
        description: `${res.deleted} enquiry record(s) removed.`,
      });
    } catch (err) {
      sileo.error({
        title: "Bulk Delete Failed",
        description: err instanceof Error ? err.message : "Could not delete enquiries",
      });
    } finally {
      selection.setBulkDeleting(false);
    }
  };

  const handleDeleteOne = async (id: number, referenceNo: string) => {
    if (!confirm(`Delete enquiry ${referenceNo} permanently?`)) return;
    try {
      await deleteEnquiryAction(id);
      router.refresh();
      sileo.success({ title: "Enquiry Deleted" });
    } catch (err) {
      sileo.error({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Error",
      });
    }
  };

  const saveStatus = async (id: number) => {
    setSaving(true);
    try {
      await updateEnquiryStatusAction({
        id,
        status: statusDraft,
        adminNotes: notesDraft,
      });
      setEditingId(null);
      router.refresh();
      sileo.success({ title: "Enquiry Updated" });
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not update",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#141A21]">Recent RFQs &amp; AI Captured Leads</h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {["all", "new", "in_progress", "quoted", "closed"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`rounded px-3 py-1.5 font-mono uppercase cursor-pointer ${
                filter === st
                  ? "bg-[#141A21] text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-400"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <BulkSelectionBar
        totalCount={filtered.length}
        selectedCount={selection.selectedIds.length}
        entityLabel="enquiry(s)"
        allSelected={selection.allVisibleSelected}
        deleting={selection.bulkDeleting}
        onToggleAll={selection.toggleAllVisible}
        onClear={selection.clearSelection}
        onBulkDelete={handleBulkDelete}
      />

      <div className="rounded-md border border-[#E4E4E0] bg-white divide-y divide-[#E4E4E0]">
        {filtered.length === 0 ? (
          <div className="p-8 text-sm text-stone-500">
            No enquiries under this status filter yet.
          </div>
        ) : (
          filtered.map((enq) => {
            let items: EnquiryItem[] = [];
            try {
              items = JSON.parse(enq.itemsJson || "[]");
            } catch {
              items = [];
            }

            const isEditing = editingId === enq.id;
            const isSelected = selection.selectedSet.has(enq.id);

            return (
              <div
                key={enq.id}
                className={`p-5 space-y-3 transition-colors ${
                  isSelected ? "bg-orange-50/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select enquiry ${enq.referenceNo}`}
                      checked={isSelected}
                      onChange={() => selection.toggleOne(enq.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#EA6A12] cursor-pointer"
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                        <span className="font-bold text-[#141A21]">{enq.referenceNo}</span>
                        <span className="uppercase text-[#EA6A12]">{enq.channel}</span>
                        <span className="text-stone-400">{enq.createdAt}</span>
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 uppercase">
                          {enq.status}
                        </span>
                      </div>
                      <div className="text-base font-bold text-[#141A21]">
                        {enq.customerName}
                        {enq.companyName && (
                          <span className="font-normal text-stone-500"> — {enq.companyName}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-stone-600">
                        {enq.phone && <span>Tel: {enq.phone}</span>}
                        {enq.email && <span>Email: {enq.email}</span>}
                        {enq.deliveryLocation && <span>Loc: {enq.deliveryLocation}</span>}
                        {enq.gstNumber && <span className="font-mono">GSTIN: {enq.gstNumber}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {enq.phone && (
                      <a
                        href={`https://wa.me/${enq.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                          `Hello ${enq.customerName}, regarding your enquiry ${enq.referenceNo} with Radiant Industrial Co.:`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-[#16A34A]/40 px-2.5 py-1.5 text-xs font-semibold text-[#15803D] hover:bg-[#16A34A] hover:text-white"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    {enq.email && (
                      <a
                        href={`mailto:${enq.email}?subject=${encodeURIComponent(
                          `Quotation for ${enq.referenceNo} — Radiant Industrial Co.`
                        )}`}
                        className="inline-flex items-center gap-1 rounded border border-stone-300 px-2.5 py-1.5 text-xs font-semibold text-[#141A21] hover:border-[#141A21]"
                      >
                        <Mail className="w-3.5 h-3.5" /> Reply Email
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(isEditing ? null : enq.id);
                        setStatusDraft(enq.status);
                        setNotesDraft(enq.adminNotes);
                      }}
                      className="rounded bg-[#141A21] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
                    >
                      {isEditing ? "Close" : "Manage"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete enquiry ${enq.referenceNo}`}
                      onClick={() => handleDeleteOne(enq.id, enq.referenceNo)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="rounded bg-[#FBFBFA] border border-stone-200 p-3 text-xs space-y-1">
                    {items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="font-medium text-[#141A21]">
                          {it.sku ? `[${it.sku}] ` : ""}
                          {it.name}
                          {it.brand ? ` (${it.brand})` : ""}
                        </span>
                        <span className="font-mono text-stone-600 shrink-0">
                          Qty: {it.qty} {it.unit || "NOS"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {enq.message && (
                  <p className="text-sm text-stone-600 whitespace-pre-wrap">{enq.message}</p>
                )}

                {enq.attachmentUrl && (
                  <a
                    href={enq.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EA6A12] hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Attached BOM / Specification
                  </a>
                )}

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Status</label>
                      <select
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        className="w-full rounded border border-stone-300 px-2.5 py-2 text-xs"
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="quoted">Quoted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Internal Notes
                      </label>
                      <input
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Quoted rate, vendor availability, PO ref..."
                        className="w-full rounded border border-stone-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveStatus(enq.id)}
                      className="rounded bg-[#EA6A12] py-2 text-xs font-semibold text-white hover:bg-[#C95609] inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save Update
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
