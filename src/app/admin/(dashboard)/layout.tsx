import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminAiDrawer } from "@/components/AdminAiDrawer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Console",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FBFBFA]">
      <AdminSidebar userEmail={session.user.email || "admin"} />
      <div className="flex-1 min-w-0 p-6 sm:p-8 lg:p-10">{children}</div>
      <AdminAiDrawer />
    </div>
  );
}
