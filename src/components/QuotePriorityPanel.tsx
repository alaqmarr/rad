import React from "react";
import Link from "next/link";
import { TrendingUp, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import type { QuotePriorityReport } from "@/lib/quote-priority";

export function QuotePriorityPanel({ report }: { report: QuotePriorityReport }) {
  return (
    <div className="rounded-md border border-[#E4E4E0] bg-white p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#C24D00] font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            QUOTE-DRIVEN SEO &amp; SPEC PRIORITY QUEUE
          </div>
          <h2 className="text-lg font-extrabold text-[#141A21] mt-0.5">
            High-Demand Products &amp; Categories From Quote History
          </h2>
          <p className="text-xs text-stone-600 mt-0.5">
            Analyzed {report.totalEnquiriesAnalyzed} quote requests &amp;{" "}
            {report.totalWhatsappMessagesAnalyzed} WhatsApp logs to rank parts and categories needing verified specs, compatibility links, and SEO titles first.
          </p>
        </div>
        <div className="text-xs font-mono text-stone-500 bg-stone-100 rounded px-3 py-1.5">
          CLI: <span className="text-[#141A21] font-semibold">npx tsx scripts/quote-priority-report.ts</span>
        </div>
      </div>

      {/* Top Demanded Categories */}
      <div className="flex flex-wrap gap-2">
        {report.topCategories.slice(0, 8).map((c) => (
          <Link
            key={c.categoryId}
            href={`/categories/${c.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#FBFBFA] px-3 py-1 text-xs font-medium text-[#141A21] hover:border-[#C24D00] transition-colors"
          >
            <span>{c.name}</span>
            <span className="font-mono text-[11px] text-stone-500">
              {c.enquiryCount > 0 ? `${c.enquiryCount} RFQs` : `${c.productCount} SKUs`}
            </span>
          </Link>
        ))}
      </div>

      {/* Product Priority Table */}
      <div className="overflow-x-auto border border-[#E4E4E0] rounded">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#141A21] text-white font-mono uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-3.5 py-2.5">MPN / SKU</th>
              <th className="px-3.5 py-2.5">Product &amp; Category</th>
              <th className="px-3.5 py-2.5">Demand Source</th>
              <th className="px-3.5 py-2.5">Specs</th>
              <th className="px-3.5 py-2.5">Readiness</th>
              <th className="px-3.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E4E0]">
            {report.topProducts.slice(0, 12).map((p) => (
              <tr key={p.productId} className="hover:bg-[#FBFBFA]">
                <td className="px-3.5 py-2.5 font-mono">
                  <div className="font-bold text-[#141A21]">{p.mpn}</div>
                  <div className="text-[11px] text-stone-500">{p.sku}</div>
                </td>
                <td className="px-3.5 py-2.5 max-w-xs">
                  <div className="font-semibold text-[#141A21] truncate">{p.name}</div>
                  <div className="text-[11px] text-stone-500">
                    {p.brandName} • {p.categoryName}
                  </div>
                </td>
                <td className="px-3.5 py-2.5">
                  {p.enquiryCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 font-mono font-bold text-[#C24D00]">
                      {p.enquiryCount} RFQs ({p.totalRequestedQty} qty)
                    </span>
                  ) : (
                    <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-stone-600">
                      Strategic Buyer Search Target
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[#141A21]">{p.specCount} specs</td>
                <td className="px-3.5 py-2.5">
                  {p.gaps.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {p.readinessScore}% Ready
                    </span>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" /> {p.readinessScore}%
                      </span>
                      <div className="text-[11px] text-stone-500">{p.gaps.join(", ")}</div>
                    </div>
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-right whitespace-nowrap space-x-2">
                  <Link
                    href={`/products/${p.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#141A21] hover:border-[#C24D00]"
                  >
                    Live <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Link
                    href={`/admin/products?q=${encodeURIComponent(p.sku)}`}
                    className="inline-flex items-center rounded bg-[#141A21] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#C24D00]"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
