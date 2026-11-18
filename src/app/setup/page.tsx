import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db, users } from "@/db";
import { SetupForm } from "@/components/SetupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Initial Admin Setup",
  robots: { index: false, follow: false },
};

export default async function SetupPage() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (Number(row?.count || 0) > 0) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-md border border-[#E4E4E0] bg-white p-8 shadow-sm space-y-6">
        <div className="space-y-2 border-b border-stone-200 pb-5">
          <img src="/logos/logo-long.png" alt="Radiant Industrial Co." className="h-9 w-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
            Initial Admin Setup
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            Create the primary administrator account for Radiant Industrial Co. Once created, this route locks automatically.
          </p>
        </div>

        <SetupForm />

        <p className="text-xs text-stone-500 pt-2 border-t border-stone-100">
          After signing in, configure Cloudflare R2, SMTP Email, Claude Haiku 5.5 API Key, and WhatsApp settings directly in <strong>Admin → Settings</strong>.
        </p>
      </div>
    </div>
  );
}
