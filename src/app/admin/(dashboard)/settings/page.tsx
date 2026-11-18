import React from "react";
import { asc } from "drizzle-orm";
import { db, siteSettings, pageBlocks } from "@/db";
import { SettingsManager } from "@/components/SettingsManager";
import { getMonthlyAiUsageSummary } from "@/lib/ai-budget";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [allSettings, allBlocks, aiUsage] = await Promise.all([
    db.select().from(siteSettings).orderBy(asc(siteSettings.category), asc(siteSettings.key)),
    db.select().from(pageBlocks).orderBy(asc(pageBlocks.pageSlug), asc(pageBlocks.blockKey)),
    getMonthlyAiUsageSummary(),
  ]);

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
          Database-Driven Settings &amp; Credentials
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Configure Cloudflare R2, Nodemailer SMTP, Claude Haiku 5.5 API Key &amp; Monthly Cost Caps, WhatsApp Business Cloud API, SEO metadata, and every inline site block — all persisted in SQLite.
        </p>
      </div>

      <SettingsManager settings={allSettings} blocks={allBlocks} aiUsage={aiUsage} />
    </div>
  );
}
