"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  Building2,
  FileText,
  Settings,
  ArrowLeftRight,
  ExternalLink,
  LogOut,
} from "lucide-react";

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Overview & Enquiries", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products & Pricing", icon: Package },
    { href: "/admin/brands", label: "Brands & Categories", icon: Building2 },
    { href: "/admin/documents", label: "Documents (R2)", icon: FileText },
    { href: "/admin/data", label: "Import & Export", icon: ArrowLeftRight },
    { href: "/admin/settings", label: "Settings & Credentials", icon: Settings },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[#E4E4E0] bg-[#141A21] text-stone-200 flex flex-col justify-between">
      <div>
        <div className="p-5 border-b border-stone-800">
          <Link href="/" className="inline-block bg-white rounded px-2.5 py-1.5 mb-3">
            <img src="/logos/logo-long.png" alt="Radiant Industrial Co." className="h-7 w-auto" />
          </Link>
          <div className="text-[11px] font-mono text-stone-400 truncate">{userEmail}</div>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#EA6A12] text-white"
                    : "text-stone-300 hover:bg-stone-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-stone-800 space-y-2">
        <Link
          href="/"
          className="flex items-center justify-between rounded border border-stone-700 px-3 py-2 text-xs font-medium text-stone-200 hover:border-[#EA6A12] hover:text-white transition-colors"
        >
          <span>Open Live Site (Inline Edit)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="w-full flex items-center gap-2 rounded px-3 py-2 text-xs font-medium text-stone-400 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
