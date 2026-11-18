import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { sql } from "drizzle-orm";
import Link from "next/link";
import { db, users } from "@/db";
import { authOptions } from "@/lib/auth";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (Number(row?.count || 0) === 0) {
    redirect("/setup");
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-md border border-[#E4E4E0] bg-white p-8 shadow-sm space-y-6">
        <div className="space-y-2 border-b border-stone-200 pb-5">
          <Link href="/">
            <img src="/logos/logo-long.png" alt="Radiant Industrial Co." className="h-9 w-auto mb-3" />
          </Link>
          <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
            Admin Console Sign In
          </h1>
          <p className="text-sm text-stone-600">
            Manage products, sourced brands, R2 documents, enquiries, and live inline page content.
          </p>
        </div>

        <AdminLoginForm />

        <div className="text-xs text-stone-500 pt-2 border-t border-stone-100 flex justify-between">
          <Link href="/" className="hover:text-[#141A21]">← Return to Storefront</Link>
          <span>RapidShift Labs CMS</span>
        </div>
      </div>
    </div>
  );
}
