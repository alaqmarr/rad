import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import {
  getActiveBrands,
  getActiveCategories,
  getActiveDivisions,
  queryProducts,
} from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { ProductsCatalogClient } from "@/components/ProductsCatalogClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; division?: string; category?: string; brand?: string }>;
}): Promise<Metadata> {
  const [sp, settings] = await Promise.all([searchParams, getSiteSettings()]);
  const origin = await getDetectedSiteOrigin(settings);
  const parts = [sp.brand, sp.category, sp.division, sp.q].filter(Boolean);
  const filterTitle = parts.length
    ? `${parts.join(" • ")} — Products Catalog`
    : "Products & Wholesale Supply Catalog";
  const description = parts.length
    ? `Explore genuine wholesale ${parts.join(", ")} supplies sourced across India by Radiant Industrial Co.`
    : "Browse industrial MRO machine parts, fasteners, bearings, valves, power tools, safety PPE, electricals, agricultural irrigation, facility equipment, and custom Special Items.";

  const canonicalParams = new URLSearchParams();
  if (sp.division) canonicalParams.set("division", sp.division);
  if (sp.category) canonicalParams.set("category", sp.category);
  if (sp.brand) canonicalParams.set("brand", sp.brand);
  const canonicalPath = canonicalParams.toString() ? `/products?${canonicalParams.toString()}` : "/products";

  return buildSeoMetadata({
    origin,
    path: canonicalPath,
    title: filterTitle,
    description,
    keywords: [
      "industrial MRO catalog India",
      "wholesale tools fasteners bearings",
      "agricultural pumps irrigation supplies",
      "custom special industrial items",
    ],
    settings,
    imageUrl: "/images/div-industrial.jpg",
    noIndex: Boolean(sp.q),
  });
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    division?: string;
    category?: string;
    brand?: string;
    pricing?: "all" | "priced" | "rfq_only";
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q || "";
  const division = sp.division || "";
  const category = sp.category || "";
  const brand = sp.brand || "";
  const pricing = sp.pricing || "all";

  const [settings, divisionsList, categoriesList, brandsList, items] = await Promise.all([
    getSiteSettings(),
    getActiveDivisions(),
    getActiveCategories(),
    getActiveBrands(),
    queryProducts({ q, division, category, brand, pricing, limit: 150 }),
  ]);
  const origin = await getDetectedSiteOrigin(settings);

  const catalogJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Radiant Industrial Co. Products Catalog",
    url: buildAbsoluteUrl(origin, "/products"),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 20).map((row, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: buildAbsoluteUrl(origin, `/products/${row.product.slug}`),
        name: row.product.name,
      })),
    },
  };

  const cardItems = items.map((row) => ({
    id: row.product.id,
    slug: row.product.slug,
    sku: row.product.sku,
    name: row.product.name,
    shortDescription: row.product.shortDescription,
    pricingMode: row.product.pricingMode,
    basePrice: row.product.basePrice,
    priceUnit: row.product.priceUnit,
    gstPercent: row.product.gstPercent,
    leadTime: row.product.leadTime,
    primaryImageUrl: row.product.primaryImageUrl,
    fallbackImageUrl: row.division?.heroImageUrl || null,
    specificationsJson: row.product.specificationsJson,
    brandName: row.brand?.name || null,
    brandSlug: row.brand?.slug || null,
    categoryName: row.category?.name || null,
  }));

  return (
    <div className="bg-[#F4F4F0] min-h-screen pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(catalogJsonLd) }}
      />
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-11">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Product Catalog
            </h1>
            <p className="mt-2 text-sm sm:text-base text-stone-100/90 leading-relaxed max-w-2xl">
              Check standard wholesale prices where listed, or click Get Quote for custom quantities and delivery rates.
            </p>
          </div>
          {q && (
            <div className="flex items-center gap-3 text-xs font-mono bg-[#171E26] border border-stone-700 rounded px-3.5 py-2">
              <span>Search: &ldquo;{q}&rdquo;</span>
              <Link href="/products" className="text-[#EA6A12] hover:underline">
                Clear
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="py-8">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Sidebar Without Nested Scrollbars */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24 rounded-md border border-stone-200 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#141A21]">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#EA6A12]" />
                Filters
              </span>
              {(q || division || category || brand || pricing !== "all") && (
                <Link href="/products" className="text-xs font-medium text-[#EA6A12] hover:underline">
                  Reset
                </Link>
              )}
            </div>

            <div>
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-stone-500 mb-2">
                Price Type
              </h3>
              <div className="space-y-1 text-sm">
                {[
                  { key: "all", label: "All Products" },
                  { key: "priced", label: "Fixed Price Shown" },
                  { key: "rfq_only", label: "Ask for Price" },
                ].map((opt) => (
                  <Link
                    key={opt.key}
                    href={`/products?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      ...(division ? { division } : {}),
                      ...(category ? { category } : {}),
                      ...(brand ? { brand } : {}),
                      pricing: opt.key,
                    }).toString()}`}
                    className={`block rounded px-2.5 py-1.5 transition-colors ${
                      pricing === opt.key
                        ? "bg-[#141A21] text-white font-medium"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-stone-500 mb-2">
                Supply Area
              </h3>
              <div className="space-y-1 text-sm">
                <Link
                  href={`/products?${new URLSearchParams({
                    ...(q ? { q } : {}),
                    ...(pricing !== "all" ? { pricing } : {}),
                  }).toString()}`}
                  className={`block rounded px-2.5 py-1.5 ${
                    !division ? "bg-stone-100 font-semibold text-[#141A21]" : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  All Areas
                </Link>
                {divisionsList.map((d) => (
                  <Link
                    key={d.id}
                    href={`/products?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      division: d.slug,
                      ...(pricing !== "all" ? { pricing } : {}),
                    }).toString()}`}
                    className={`block rounded px-2.5 py-1.5 ${
                      division === d.slug
                        ? "bg-[#141A21] text-white font-medium"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {d.name}
                  </Link>
                ))}
              </div>
            </div>

            <details open className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-stone-500 mb-2">
                <span>Category ({categoriesList.length})</span>
                <span className="text-stone-400 group-open:hidden">+</span>
                <span className="text-stone-400 hidden group-open:inline">−</span>
              </summary>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {categoriesList.map((c) => (
                  <Link
                    key={c.id}
                    href={`/products?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      category: c.slug,
                      ...(pricing !== "all" ? { pricing } : {}),
                    }).toString()}`}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      category === c.slug
                        ? "bg-[#141A21] text-white font-medium"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </details>

            <details open={Boolean(brand)} className="group border-t border-stone-100 pt-4">
              <summary className="cursor-pointer list-none flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-stone-500 mb-2">
                <span>Brand ({brandsList.length})</span>
                <span className="text-stone-400 group-open:hidden">+</span>
                <span className="text-stone-400 hidden group-open:inline">−</span>
              </summary>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {brandsList.map((b) => (
                  <Link
                    key={b.id}
                    href={`/products?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      brand: b.slug,
                      ...(pricing !== "all" ? { pricing } : {}),
                    }).toString()}`}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      brand === b.slug
                        ? "bg-[#EA6A12] text-white font-medium"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {b.name.replace(/\s*\(.*?\)/g, "")}
                  </Link>
                ))}
              </div>
            </details>
          </aside>

          {/* Catalog Results */}
          <div className="lg:col-span-9">
            {cardItems.length === 0 ? (
              <div className="rounded-md border border-stone-200 bg-white p-10 space-y-4">
                <h2 className="text-xl font-bold text-[#141A21]">
                  No matching products found
                </h2>
                <p className="text-sm text-stone-600 max-w-xl">
                  We source hundreds of items beyond what is listed online. Tell us the item name, size, or brand you need and we will quote it for you.
                </p>
                <Link
                  href="/contact"
                  className="inline-block rounded bg-[#EA6A12] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Ask Us to Source This Item
                </Link>
              </div>
            ) : (
              <ProductsCatalogClient items={cardItems} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
