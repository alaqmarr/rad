"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, ClipboardList, Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import { useQuoteCart } from "./Providers";

interface NavbarProps {
  logoUrl: string;
  companyName: string;
}

const DIVISION_LINKS = [
  {
    href: "/divisions/industrial",
    title: "Industrial & MRO Supply",
    desc: "Fasteners, bearings, valves, tools, welding & PPE",
    image: "/images/div-industrial.jpg",
  },
  {
    href: "/divisions/agricultural",
    title: "Agricultural Supply",
    desc: "Drip irrigation, water pumps, implements & nets",
    image: "/images/div-agricultural.jpg",
  },
  {
    href: "/divisions/general",
    title: "General & Facility",
    desc: "Storage racks, trolleys, packaging & cleaning",
    image: "/images/div-general.jpg",
  },
  {
    href: "/divisions/special-items",
    title: "Special Items (Custom)",
    desc: "Separate scope: CNC parts, calibration & alloys",
    image: "/images/div-technical.jpg",
  },
];

export function Navbar({ companyName }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { items, setDrawerOpen } = useQuoteCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname?.startsWith("/admin") || pathname === "/setup") {
    return null;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur-md">
      <div className="w-full flex h-[72px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Crisp Brand Mark + Typographic Lockup */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0 group" aria-label={companyName}>
          <img
            src="/logos/logo-short.png"
            alt={companyName}
            className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
          />
          <div className="flex flex-col">
            <span className="font-display text-[16px] sm:text-[17px] font-extrabold tracking-tight text-[#141A21] leading-none group-hover:text-[#EA6A12] transition-colors">
              RADIANT
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.18em] text-[#4E5D6C] uppercase leading-none mt-1">
              INDUSTRIAL CO.
            </span>
          </div>
        </Link>

        {/* Desktop Primary Navigation */}
        <nav className="hidden lg:flex items-center gap-7">
          <Link
            href="/products"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith("/products")
                ? "text-[#EA6A12]"
                : "text-[#141A21] hover:text-[#EA6A12]"
            }`}
          >
            Products
          </Link>

          <div className="relative group">
            <Link
              href="/divisions/industrial"
              className={`inline-flex items-center gap-1 py-6 text-sm font-medium transition-colors ${
                pathname?.startsWith("/divisions")
                  ? "text-[#EA6A12]"
                  : "text-[#141A21] hover:text-[#EA6A12]"
              }`}
            >
              Supply Areas
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
            </Link>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 absolute left-0 top-full w-[540px] rounded-md border border-stone-200 bg-white p-3 shadow-2xl grid grid-cols-2 gap-2">
              {DIVISION_LINKS.map((div) => (
                <Link
                  key={div.href}
                  href={div.href}
                  className="flex items-start gap-3 rounded p-2.5 hover:bg-stone-50 transition-colors"
                >
                  <img
                    src={div.image}
                    alt={div.title}
                    className="w-12 h-12 rounded object-cover shrink-0 border border-stone-200"
                  />
                  <div>
                    <div className="text-sm font-semibold text-[#141A21]">{div.title}</div>
                    <div className="text-xs text-stone-500 leading-snug mt-0.5">{div.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/brands"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith("/brands")
                ? "text-[#EA6A12]"
                : "text-[#141A21] hover:text-[#EA6A12]"
            }`}
          >
            Brands
          </Link>

          <Link
            href="/about"
            className={`text-sm font-medium transition-colors ${
              pathname === "/about"
                ? "text-[#EA6A12]"
                : "text-[#141A21] hover:text-[#EA6A12]"
            }`}
          >
            About Us
          </Link>

          <Link
            href="/contact"
            className={`text-sm font-medium transition-colors ${
              pathname === "/contact"
                ? "text-[#EA6A12]"
                : "text-[#141A21] hover:text-[#EA6A12]"
            }`}
          >
            Contact
          </Link>
        </nav>

        {/* Desktop Search + Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands..."
              className="w-60 xl:w-72 rounded-md border border-stone-300 bg-[#F7F7F5] pl-9 pr-3 py-2 text-sm text-[#141A21] placeholder:text-stone-400 focus:border-[#EA6A12] focus:bg-white outline-none transition-colors"
            />
          </form>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-[#141A21] hover:border-[#141A21] transition-colors cursor-pointer shrink-0"
          >
            <ClipboardList className="w-4 h-4 text-[#EA6A12]" />
            <span className="font-mono-num">Quote List ({items.length})</span>
          </button>

          <Link
            href="/contact"
            className="rounded-md bg-[#EA6A12] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C95609] transition-colors shrink-0"
          >
            Get a Quote
          </Link>
        </div>

        {/* Mobile & Tablet Controls (Visible anywhere below lg: 1024px) */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-[#141A21] cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5 text-[#EA6A12]" />
            <span>{items.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white p-2 text-[#141A21] hover:border-[#141A21] cursor-pointer"
            aria-label="Toggle Mobile Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-5 py-5 space-y-5 shadow-xl max-h-[calc(100vh-72px)] overflow-y-auto">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands..."
              className="w-full rounded-md border border-stone-300 bg-[#F7F7F5] pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
            />
          </form>

          <nav className="flex flex-col divide-y divide-stone-100">
            <Link
              href="/products"
              onClick={() => setMobileOpen(false)}
              className="py-3 flex items-center justify-between text-base font-semibold text-[#141A21]"
            >
              <span>Products Catalog</span>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </Link>
            <Link
              href="/brands"
              onClick={() => setMobileOpen(false)}
              className="py-3 flex items-center justify-between text-base font-semibold text-[#141A21]"
            >
              <span>Brands We Source</span>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className="py-3 flex items-center justify-between text-base font-semibold text-[#141A21]"
            >
              <span>About Us</span>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="py-3 flex items-center justify-between text-base font-semibold text-[#141A21]"
            >
              <span>Contact</span>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </Link>
          </nav>

          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-500">
              Supply Areas
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DIVISION_LINKS.map((div) => (
                <Link
                  key={div.href}
                  href={div.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded border border-stone-200 bg-[#F9F9F7] p-2.5"
                >
                  <img
                    src={div.image}
                    alt={div.title}
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div className="text-sm font-semibold text-[#141A21]">{div.title}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setDrawerOpen(true);
              }}
              className="w-full rounded-md border border-stone-300 bg-white py-3 text-sm font-semibold text-[#141A21]"
            >
              Open Quote List ({items.length})
            </button>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center rounded-md bg-[#EA6A12] py-3 text-sm font-semibold text-white"
            >
              Get a Quote
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
