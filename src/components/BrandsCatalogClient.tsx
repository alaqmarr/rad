"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, Sparkles, Package, Globe2, ShieldCheck, X } from "lucide-react";

export interface BrandDirectoryItem {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  thumbnailUrl: string | null;
  countryOfOrigin: string;
  sourcingType: string;
  description: string;
  websiteUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
  productCount: number;
  divisions: Array<{ slug: string; name: string }>;
}

type FilterTab = "all" | "catalog" | "international" | "india" | "authorized";
type SortBy = "featured" | "products" | "alpha";

function BrandLogoTile({ brand, eager }: { brand: BrandDirectoryItem; eager: boolean }) {
  const [failed, setFailed] = useState(false);

  if (!brand.logoUrl || failed) {
    const initials = brand.name
      .replace(/\(.*?\)/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("");
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#141A21] font-mono text-base font-extrabold text-white">
        {initials || "BR"}
      </div>
    );
  }

  return (
    <img
      src={brand.logoUrl}
      alt={`${brand.name} logo`}
      width={200}
      height={56}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className="max-h-14 max-w-[185px] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105"
    />
  );
}

export function BrandsCatalogClient({ brands }: { brands: BrandDirectoryItem[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [letter, setLetter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("featured");

  const featuredBrands = useMemo(
    () => brands.filter((b) => b.isFeatured).slice(0, 8),
    [brands]
  );

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      const ch = b.name.trim()[0]?.toUpperCase() || "";
      if (/[A-Z]/.test(ch)) set.add(ch);
      else if (ch) set.add("#");
    }
    return Array.from(set).sort();
  }, [brands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = brands.filter((b) => {
      if (tab === "catalog" && b.productCount <= 0) return false;
      if (tab === "india" && b.countryOfOrigin.toLowerCase() !== "india") return false;
      if (tab === "international" && b.countryOfOrigin.toLowerCase() === "india") return false;
      if (tab === "authorized" && b.sourcingType !== "authorized" && b.sourcingType !== "in_house") {
        return false;
      }
      if (letter !== "all") {
        const ch = b.name.trim()[0]?.toUpperCase() || "";
        const norm = /[A-Z]/.test(ch) ? ch : "#";
        if (norm !== letter) return false;
      }
      if (q) {
        const hay = `${b.name} ${b.countryOfOrigin} ${b.description} ${b.divisions
          .map((d) => d.name)
          .join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "products") {
      return [...list].sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
    }
    if (sortBy === "alpha") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [brands, query, tab, letter, sortBy]);

  const tabCounts = useMemo(
    () => ({
      all: brands.length,
      catalog: brands.filter((b) => b.productCount > 0).length,
      international: brands.filter((b) => b.countryOfOrigin.toLowerCase() !== "india").length,
      india: brands.filter((b) => b.countryOfOrigin.toLowerCase() === "india").length,
      authorized: brands.filter((b) => b.sourcingType === "authorized" || b.sourcingType === "in_house").length,
    }),
    [brands]
  );

  return (
    <div className="space-y-10">
      {/* Flagship OEM Quick Strip (visible at default state) */}
      {featuredBrands.length > 0 && tab === "all" && !query && letter === "all" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-[#B84700] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              High-Demand OEM &amp; Flagship Brands
            </h2>
            <span className="text-xs text-stone-600 font-mono">
              Click any OEM to view live stocked &amp; on-order catalog
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {featuredBrands.map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.slug}`}
                className="group rounded-md border border-stone-200 bg-white p-3 flex flex-col items-center justify-between text-center gap-2 hover:border-[#C24D00] hover:shadow-md transition-all"
              >
                <div className="h-11 w-full flex items-center justify-center">
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt={b.name}
                      width={120}
                      height={44}
                      loading="eager"
                      decoding="async"
                      className="max-h-10 max-w-[100px] w-auto h-auto object-contain"
                    />
                  ) : (
                    <span className="font-bold text-xs text-[#141A21]">{b.name}</span>
                  )}
                </div>
                <div className="w-full pt-1.5 border-t border-stone-100">
                  <div className="text-[11px] font-bold text-[#141A21] truncate group-hover:text-[#B84700]">
                    {b.name}
                  </div>
                  <div className="text-[10px] font-mono text-stone-600">
                    {b.productCount > 0 ? `${b.productCount.toLocaleString("en-IN")} SKUs` : "RFQ Sourcing"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search, Region Filter & A-Z Controls */}
      <div className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter brands by name, country or division"
              placeholder="Search brand (e.g. Bosch, Taparia, Mitutoyo, Karam, Loctite, Germany)..."
              className="w-full rounded-md border border-stone-300 bg-[#F8F8F6] pl-10 pr-9 py-2.5 text-sm text-[#141A21] placeholder:text-stone-500 focus:border-[#C24D00] focus:bg-white outline-none transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear brand filter"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-[#141A21] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort + Result Count */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono text-stone-600">
              Showing <strong className="text-[#141A21]">{filtered.length}</strong> of {brands.length} brands
            </span>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#141A21] outline-none focus:border-[#C24D00]"
              >
                <option value="featured">Recommended Order</option>
                <option value="products">Most Live Products</option>
                <option value="alpha">Alphabetical (A–Z)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
          {(
            [
              { id: "all", label: `All Brands (${tabCounts.all})` },
              { id: "catalog", label: `Live Catalog SKUs (${tabCounts.catalog})` },
              { id: "international", label: `International OEMs (${tabCounts.international})` },
              { id: "india", label: `Indian Brands (${tabCounts.india})` },
              { id: "authorized", label: `House & Authorized (${tabCounts.authorized})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? "bg-[#141A21] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* A-Z Quick Jump */}
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => setLetter("all")}
            className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
              letter === "all"
                ? "bg-[#C24D00] text-white"
                : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            ALL
          </button>
          {availableLetters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLetter(letter === l ? "all" : l)}
              className={`min-w-[26px] px-1.5 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                letter === l
                  ? "bg-[#C24D00] text-white"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Brands Directory Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white p-10 text-center space-y-4">
          <h3 className="text-lg font-bold text-[#141A21]">
            No directory match for &ldquo;{query || letter}&rdquo;
          </h3>
          <p className="text-sm text-stone-600 max-w-xl mx-auto">
            We regularly source unlisted OEM brands, imported automation modules, and custom industrial assemblies directly from manufacturers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTab("all");
                setLetter("all");
              }}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-[#141A21] hover:border-[#141A21] cursor-pointer"
            >
              Reset Brand Filters
            </button>
            <Link
              href={`/contact${query ? `?q=${encodeURIComponent(query)}` : ""}`}
              className="rounded-md bg-[#C24D00] px-5 py-2 text-xs font-bold text-white hover:bg-[#9E3E00]"
            >
              Request Custom Brand Quote →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filtered.map((brand, idx) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className="group rounded-lg border border-stone-200 bg-white overflow-hidden flex flex-col justify-between hover:border-[#C24D00]/70 hover:shadow-lg transition-all duration-200"
            >
              <div>
                {/* Framed Uniform OEM Logo Tray */}
                <div className="relative h-28 w-full border-b border-stone-200 bg-[#F8F8F6] px-6 py-4 flex items-center justify-center">
                  <BrandLogoTile brand={brand} eager={idx < 8} />
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 border border-stone-200 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#141A21]">
                    <Package className="w-3 h-3 text-[#B84700]" />
                    {brand.productCount > 0
                      ? `${brand.productCount.toLocaleString("en-IN")} SKUs`
                      : "On Order"}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-extrabold text-[#141A21] group-hover:text-[#B84700] transition-colors leading-snug">
                      {brand.name}
                    </h2>
                    <ArrowUpRight className="w-4 h-4 text-stone-500 group-hover:text-[#B84700] shrink-0 mt-0.5" />
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                    {brand.description ||
                      `Wholesale supply of genuine ${brand.name} industrial and commercial range across India.`}
                  </p>

                  {brand.divisions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {brand.divisions.slice(0, 2).map((d) => (
                        <span
                          key={d.slug}
                          className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700"
                        >
                          {d.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Metadata Bar */}
              <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                  <Globe2 className="w-3.5 h-3.5 text-stone-500" />
                  {brand.countryOfOrigin}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-[#141A21]">
                  {brand.sourcingType === "in_house" ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#B84700]" />
                      Radiant House Brand
                    </>
                  ) : brand.sourcingType === "authorized" ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Authorized Partner
                    </>
                  ) : (
                    <span className="text-[#B84700] group-hover:underline">
                      Explore Catalog →
                    </span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
