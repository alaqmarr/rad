"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Send, Trash2 } from "lucide-react";
import { sileo } from "sileo";
import {
  updateSiteSettingsAction,
  updatePageBlockAction,
  testSmtpAction,
  clearAiUsageLogsAction,
} from "@/app/admin/actions";
import type { MonthlyAiUsageSummary } from "@/lib/ai-budget";

interface SettingRow {
  key: string;
  category: string;
  label: string;
  value: string;
  valueType: string;
  isSecret: boolean;
}

interface PageBlockRow {
  id: number;
  pageSlug: string;
  blockKey: string;
  label: string;
  content: string;
  contentType: string;
}

export function SettingsManager({
  settings,
  blocks,
  aiUsage,
}: {
  settings: SettingRow[];
  blocks: PageBlockRow[];
  aiUsage: MonthlyAiUsageSummary;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("general");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [blockDrafts, setBlockDrafts] = useState<Record<number, string>>(() =>
    Object.fromEntries(blocks.map((b) => [b.id, b.content]))
  );
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingMail, setTestingMail] = useState(false);

  const tabs = [
    { id: "general", label: "General & Contact", cats: ["general", "contact", "branding"] },
    { id: "seo", label: "SEO Metadata", cats: ["seo"] },
    { id: "r2", label: "Cloudflare R2", cats: ["r2"] },
    { id: "smtp", label: "Nodemailer SMTP", cats: ["smtp"] },
    { id: "ai", label: "AI (Claude Haiku 5.5)", cats: ["ai"] },
    { id: "whatsapp", label: "WhatsApp & Cloud API", cats: ["whatsapp"] },
    { id: "blocks", label: "All Page Content Blocks", cats: [] },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];
  const visibleSettings = settings.filter((s) => currentTab.cats.includes(s.category));

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const s of visibleSettings) {
        payload[s.key] = values[s.key] ?? "";
      }
      await updateSiteSettingsAction(payload);
      router.refresh();
      sileo.success({
        title: "Settings Saved",
        description: `${currentTab.label} updated in SQLite database.`,
      });
    } catch (err) {
      sileo.error({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async (account: "admin" | "customer") => {
    if (!testEmail.trim()) {
      sileo.warning({ title: "Enter Target Email" });
      return;
    }
    setTestingMail(true);
    try {
      const res = await testSmtpAction(testEmail.trim(), account);
      if (res.sent) {
        sileo.success({
          title: `${account === "customer" ? "Customer" : "Admin"} SMTP Test Sent`,
          description: `Sent to ${testEmail}`,
        });
      } else {
        sileo.error({ title: "SMTP Error", description: res.error || "Check SMTP fields" });
      }
    } finally {
      setTestingMail(false);
    }
  };

  const saveBlock = async (b: PageBlockRow) => {
    try {
      await updatePageBlockAction({
        pageSlug: b.pageSlug,
        blockKey: b.blockKey,
        label: b.label,
        content: blockDrafts[b.id] ?? b.content,
      });
      router.refresh();
      sileo.success({ title: "Block Saved", description: `${b.pageSlug}.${b.blockKey}` });
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Failed" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E4E4E0] pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#141A21] text-white"
                : "bg-white border border-stone-200 text-stone-700 hover:border-stone-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "blocks" ? (
        <div className="space-y-4">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="rounded-md border border-[#E4E4E0] bg-white p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-[#141A21]">{b.label}</div>
                  <div className="font-mono text-[11px] text-stone-500">
                    {b.pageSlug}.{b.blockKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => saveBlock(b)}
                  className="rounded bg-[#141A21] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#EA6A12] cursor-pointer"
                >
                  Save Block
                </button>
              </div>
              {b.contentType === "textarea" ? (
                <textarea
                  rows={3}
                  value={blockDrafts[b.id] ?? ""}
                  onChange={(e) =>
                    setBlockDrafts({ ...blockDrafts, [b.id]: e.target.value })
                  }
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              ) : (
                <input
                  value={blockDrafts[b.id] ?? ""}
                  onChange={(e) =>
                    setBlockDrafts({ ...blockDrafts, [b.id]: e.target.value })
                  }
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-5"
        >
          {activeTab === "ai" && (
            <div className="rounded-md border border-[#EA6A12]/30 bg-orange-50/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-[#141A21]">
                    Monthly AI Token &amp; Spend Guardrail ({aiUsage.monthKey})
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    Estimated spend stops billable API calls once your cap is reached and switches customer chat to free database search.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-mono text-xs">
                    <div className="font-bold text-[#141A21]">
                      ${aiUsage.totalCostUsd.toFixed(4)} / ${aiUsage.budgetUsd.toFixed(2)}
                    </div>
                    <div className="text-stone-500">{aiUsage.percentUsed}% used</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Reset recorded AI usage counters for all endpoints?")) return;
                      await clearAiUsageLogsAction();
                      router.refresh();
                      sileo.success({ title: "AI Usage Counters Reset" });
                    }}
                    className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:border-red-400 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Reset Logs
                  </button>
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    aiUsage.percentUsed >= 90 ? "bg-red-600" : "bg-[#EA6A12]"
                  }`}
                  style={{ width: `${Math.min(100, aiUsage.percentUsed)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="rounded border border-stone-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Requests</div>
                  <div className="font-mono font-bold text-[#141A21]">{aiUsage.totalRequests}</div>
                </div>
                <div className="rounded border border-stone-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Input Tokens</div>
                  <div className="font-mono font-bold text-[#141A21]">
                    {aiUsage.totalInputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="rounded border border-stone-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Cached Reads</div>
                  <div className="font-mono font-bold text-emerald-700">
                    {aiUsage.totalCacheReadTokens.toLocaleString()}
                  </div>
                </div>
                <div className="rounded border border-stone-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Output Tokens</div>
                  <div className="font-mono font-bold text-[#141A21]">
                    {aiUsage.totalOutputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="rounded border border-stone-200 bg-white px-3 py-2">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Web Searches</div>
                  <div className="font-mono font-bold text-[#141A21]">
                    {aiUsage.totalWebSearches}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleSettings.map((s) => (
              <div
                key={s.key}
                className={s.valueType === "textarea" ? "md:col-span-2" : ""}
              >
                <label className="block text-xs font-semibold text-[#141A21] mb-1">
                  {s.label}
                  <span className="ml-2 font-mono text-[10px] font-normal text-stone-400">
                    {s.key}
                  </span>
                </label>
                {s.valueType === "textarea" ? (
                  <textarea
                    rows={3}
                    value={values[s.key] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [s.key]: e.target.value })
                    }
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                  />
                ) : s.valueType === "boolean" ? (
                  <select
                    value={values[s.key] ?? "false"}
                    onChange={(e) =>
                      setValues({ ...values, [s.key]: e.target.value })
                    }
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                  >
                    <option value="true">Enabled / True</option>
                    <option value="false">Disabled / False</option>
                  </select>
                ) : (
                  <input
                    type={s.isSecret ? "password" : "text"}
                    value={values[s.key] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [s.key]: e.target.value })
                    }
                    placeholder={s.isSecret ? "Stored securely in SQLite DB" : ""}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#EA6A12]"
                  />
                )}
              </div>
            ))}
          </div>

          {activeTab === "smtp" && (
            <div className="rounded border border-stone-200 bg-[#FBFBFA] p-4 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Send Test Email (Save SMTP changes first)
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@radiantindustrial.in"
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={testingMail}
                onClick={() => handleTestSmtp("admin")}
                className="inline-flex items-center gap-2 rounded border border-[#141A21] bg-white px-4 py-2 text-sm font-semibold text-[#141A21] hover:bg-[#141A21] hover:text-white cursor-pointer"
              >
                {testingMail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Test Admin SMTP
              </button>
              <button
                type="button"
                disabled={testingMail}
                onClick={() => handleTestSmtp("customer")}
                className="inline-flex items-center gap-2 rounded border border-[#EA6A12] bg-white px-4 py-2 text-sm font-semibold text-[#EA6A12] hover:bg-[#EA6A12] hover:text-white cursor-pointer"
              >
                {testingMail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Test Customer SMTP
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-stone-200 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609] cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save {currentTab.label}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
