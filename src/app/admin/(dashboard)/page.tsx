import React from "react";
import { desc, sql } from "drizzle-orm";
import { db, enquiries, aiConversations } from "@/db";
import { getCatalogSummaryCounts } from "@/lib/catalog";
import { getMonthlyAiUsageSummary } from "@/lib/ai-budget";
import { getQuotePriorityReport } from "@/lib/quote-priority";
import { EnquiriesManager } from "@/components/EnquiriesManager";
import { QuotePriorityPanel } from "@/components/QuotePriorityPanel";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [counts, allEnquiries, [aiCount], aiUsage, priorityReport] = await Promise.all([
    getCatalogSummaryCounts(),
    db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(100),
    db.select({ count: sql<number>`count(*)` }).from(aiConversations),
    getMonthlyAiUsageSummary(),
    getQuotePriorityReport(12),
  ]);

  const newLeads = allEnquiries.filter((e) => e.status === "new").length;

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#141A21] tracking-tight">
          Procurement Command Center
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Monitor incoming WhatsApp, Email, and AI-captured RFQs alongside catalog inventory.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="text-xs font-mono text-stone-500">NEW LEADS</div>
          <div className="font-mono-num text-2xl font-bold text-[#EA6A12] mt-1">{newLeads}</div>
        </div>
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="text-xs font-mono text-stone-500">TOTAL ENQUIRIES</div>
          <div className="font-mono-num text-2xl font-bold text-[#141A21] mt-1">
            {allEnquiries.length}
          </div>
        </div>
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="text-xs font-mono text-stone-500">PRODUCTS</div>
          <div className="font-mono-num text-2xl font-bold text-[#141A21] mt-1">
            {counts.products}
          </div>
        </div>
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="text-xs font-mono text-stone-500">BRANDS</div>
          <div className="font-mono-num text-2xl font-bold text-[#141A21] mt-1">
            {counts.brands}
          </div>
        </div>
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="text-xs font-mono text-stone-500">AI SESSIONS</div>
          <div className="font-mono-num text-2xl font-bold text-[#141A21] mt-1">
            {Number(aiCount?.count || 0)}
          </div>
        </div>
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="text-xs font-mono text-stone-500">AI SPEND ({aiUsage.monthKey})</div>
          <div className="font-mono-num text-xl font-bold text-[#141A21] mt-1">
            ${aiUsage.totalCostUsd.toFixed(2)}{" "}
            <span className="text-xs font-normal text-stone-500">
              / ${aiUsage.budgetUsd.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <EnquiriesManager enquiries={allEnquiries} />

      <QuotePriorityPanel report={priorityReport} />
    </div>
  );
}
