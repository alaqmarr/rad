import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Search, ArrowRight } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { db, products } from "@/db";
import { getBrandBySlug, queryProducts } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [brand, settings] = await Promise.all([getBrandBySlug(slug), getSiteSettings()]);
  if (!brand) return { title: "Brand Not Found", robots: { index: false, follow: false } };

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.brandId, brand.id), eq(products.isActive, true)));
  const totalCount = Number(countRow?.count || 0);

  const origin = await getDetectedSiteOrigin(settings);
  const pageNum = Math.max(1, Number(sp.page || 1) || 1);
  const title =
    brand.seoTitle ||
    `${brand.name} Wholesale Catalog India${totalCount > 0 ? ` (${totalCount.toLocaleString("en-IN")} Products)` : ""}${
      pageNum > 1 ? ` — Page ${pageNum}` : ""
    }`;
  const description =
    brand.seoDescription ||
    `${brand.description} Genuine wholesale ${brand.name} B2B supply across India from Radiant Industrial Co.`;

  return buildSeoMetadata({
    origin,
    path: pageNum > 1 ? `/brands/${brand.slug}?page=${pageNum}` : `/brands/${brand.slug}`,
    title,
    description,
    keywords: [
      brand.name,
      `${brand.name} supplier India`,
      `${brand.name} wholesale catalog`,
      `${brand.name} dealer Hyderabad Secunderabad`,
    ],
    settings,
    imageUrl: brand.thumbnailUrl || brand.logoUrl || "/images/div-industrial.jpg",
    noIndex: Boolean(sp.q),
  });
}

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [brand, settings] = await Promise.all([getBrandBySlug(slug), getSiteSettings()]);
  if (!brand) notFound();

  const q = (sp.q || "").trim();
  const currentPage = Math.max(1, Number(sp.page || 1) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [[countRow], brandProducts, origin] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.brandId, brand.id), eq(products.isActive, true))),
    queryProducts({ brand: brand.slug, q: q || undefined, limit: PAGE_SIZE, offset }),
    getDetectedSiteOrigin(settings),
  ]);

  const totalBrandProducts = Number(countRow?.count || 0);
  const totalPages = Math.max(1, Math.ceil((q ? brandProducts.length + offset : totalBrandProducts) / PAGE_SIZE));
  const brandUrl = buildAbsoluteUrl(origin, `/brands/${brand.slug}`);

  const brandJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${brand.name} Wholesale Catalog — Radiant Industrial Co.`,
        description: brand.description,
        url: brandUrl,
        about: {
          "@type": "Brand",
          name: brand.name,
          description: brand.description,
          url: brandUrl,
          logo: brand.logoUrl ? buildAbsoluteUrl(origin, brand.logoUrl) : undefined,
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: totalBrandProducts || brandProducts.length,
          itemListElement: brandProducts.slice(0, 20).map((row, idx) => ({
            "@type": "ListItem",
            position: offset + idx + 1,
            name: row.product.name,
            url: buildAbsoluteUrl(origin, `/products/${row.product.slug}`),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "Brands", item: buildAbsoluteUrl(origin, "/brands") },
          { "@type": "ListItem", position: 3, name: brand.name, item: brandUrl },
        ],
      },
    ],
  };

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandJsonLd) }}
      />
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-300">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/brands" className="hover:text-white">Brands</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-semibold">{brand.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-3">
              {brand.logoUrl && (
                <div className="inline-flex items-center justify-center bg-white rounded-md px-4 py-2.5 mb-1">
                  <img
                    src={brand.logoUrl}
                    alt={`${brand.name} logo`}
                    width={180}
                    height={44}
                    className="h-10 w-auto max-w-[180px] object-contain"
                  />
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {brand.name}
              </h1>
              <p className="text-base text-stone-300 leading-relaxed max-w-2xl">
                {brand.description}
              </p>
            </div>
            <div className="lg:col-span-4 rounded-md border border-stone-700 bg-[#171E26] p-5 space-y-2.5 text-xs">
              <div className="text-stone-300">
                Status:{" "}
                <strong className="text-white">
                  {brand.sourcingType === "in_house"
                    ? "Radiant House Brand"
                    : brand.sourcingType === "authorized"
                      ? "Authorized Partner"
                      : "Independent Sourcing (Sourced on Order)"}
                </strong>
              </div>
              <div className="text-stone-300">
                Origin: <strong className="text-white">{brand.countryOfOrigin}</strong> •{" "}
                <strong className="text-white">{totalBrandProducts.toLocaleString("en-IN")}</strong>{" "}
                SKUs
              </div>
              <p className="text-stone-300 leading-relaxed">
                {brand.sourcingNote ||
                  "We buy and supply genuine products from this brand directly against your order."}
              </p>
              <Link
                href={`/contact?brand=${encodeURIComponent(brand.name)}`}
                className="inline-block pt-1 font-bold text-[#FF984F] hover:underline"
              >
                Ask for {brand.name} Wholesale Quote →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          {/* Search & Pagination Meta Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-xs font-mono text-stone-700">
              <strong className="text-[#141A21]">{totalBrandProducts.toLocaleString("en-IN")}</strong>{" "}
              TOTAL ITEMS UNDER {brand.name.toUpperCase()}
              {totalPages > 1 && !q && ` • PAGE ${currentPage} OF ${totalPages}`}
            </div>

            <form method="GET" action={`/brands/${brand.slug}`} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  aria-label={`Search ${brand.name} catalog`}
                  placeholder={`Search within ${brand.name}...`}
                  className="w-full rounded border border-stone-300 bg-[#F8F8F6] pl-8 pr-3 py-1.5 text-xs text-[#141A21] outline-none focus:border-[#C24D00] focus:bg-white"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-[#141A21] px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          {brandProducts.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 space-y-3">
              <p className="text-sm text-stone-700">
                {q
                  ? `No listed ${brand.name} SKUs matched "${q}". Share the part number directly and we will quote it.`
                  : `All ${brand.name} products are priced on request. Tell us the model number or item you need and we will reply with a clear price quote.`}
              </p>
              <div className="flex flex-wrap gap-3">
                {q && (
                  <Link
                    href={`/brands/${brand.slug}`}
                    className="inline-block rounded-md border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-[#141A21]"
                  >
                    View All {brand.name} Items
                  </Link>
                )}
                <Link
                  href="/contact"
                  className="inline-block rounded-md bg-[#C24D00] px-5 py-2 text-xs font-bold text-white hover:bg-[#9E3E00]"
                >
                  Ask for {brand.name} Quote
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brandProducts.map((row) => (
                  <ProductCard
                    key={row.product.id}
                    item={{
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
                    }}
                  />
                ))}
              </div>

              {/* Clean Server Pagination */}
              {!q && totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
                  <div className="text-xs font-mono text-stone-600">
                    Page {currentPage} of {totalPages} ({totalBrandProducts.toLocaleString("en-IN")} total products)
                  </div>
                  <div className="flex items-center gap-2">
                    {currentPage > 1 && (
                      <Link
                        href={`/brands/${brand.slug}?page=${currentPage - 1}`}
                        className="rounded border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-[#141A21] hover:border-[#141A21]"
                      >
                        ← Previous
                      </Link>
                    )}
                    {currentPage < totalPages && (
                      <Link
                        href={`/brands/${brand.slug}?page=${currentPage + 1}`}
                        className="inline-flex items-center gap-1 rounded bg-[#141A21] px-4 py-2 text-xs font-bold text-white hover:bg-stone-800"
                      >
                        Next Page <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
