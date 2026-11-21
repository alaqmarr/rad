import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, Search, Package, Layers, CheckCircle2, HelpCircle } from "lucide-react";
import {
  getActiveCategories,
  getCategoryBySlug,
  getCategoryProductCount,
  getCategoryTopBrands,
  getProductsBySlugs,
  queryProducts,
} from "@/lib/catalog";
import { getCategoryProcurementGuide } from "@/lib/category-guides";
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
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [found, settings] = await Promise.all([getCategoryBySlug(slug), getSiteSettings()]);
  if (!found) {
    return { title: "Category Not Found", robots: { index: false, follow: false } };
  }

  const { category, division } = found;
  const guide = getCategoryProcurementGuide(category.slug);
  const [totalCount, topBrands, origin] = await Promise.all([
    getCategoryProductCount(category.id),
    getCategoryTopBrands(category.id, 8),
    getDetectedSiteOrigin(settings),
  ]);

  const currentPage = Math.max(1, Number(sp.page || 1) || 1);
  const brandSnippet = topBrands.length
    ? ` featuring ${topBrands
        .slice(0, 5)
        .map((b) => b.name)
        .join(", ")}`
    : "";

  const baseTitle = guide?.seoTitle || `${category.name} — Wholesale B2B Supply India`;
  const title = `${baseTitle}${currentPage > 1 ? ` (Page ${currentPage})` : ""}`;
  const description =
    guide?.seoDescription ||
    category.description ||
    `Source ${totalCount.toLocaleString("en-IN")}+ genuine ${category.name} products across India${brandSnippet}. Request wholesale GST quotes from Radiant Industrial Co.`;

  return buildSeoMetadata({
    origin,
    path: currentPage > 1 ? `/categories/${category.slug}?page=${currentPage}` : `/categories/${category.slug}`,
    title,
    description,
    keywords: [
      category.name,
      `${category.name} wholesale India`,
      `${category.name} supplier`,
      ...(division ? [division.name] : []),
      ...topBrands.slice(0, 6).map((b) => `${b.name} ${category.name}`),
    ],
    settings,
    imageUrl: category.thumbnailUrl || division?.heroImageUrl || "/images/div-industrial.jpg",
    noIndex: Boolean(sp.q || sp.brand),
  });
}

function buildPaginationNumbers(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | "..."> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export default async function CategoryLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [found, settings] = await Promise.all([getCategoryBySlug(slug), getSiteSettings()]);
  if (!found) notFound();

  const { category, division } = found;
  const guide = getCategoryProcurementGuide(category.slug);
  const q = (sp.q || "").trim();
  const brandSlug = (sp.brand || "").trim();
  const currentPage = Math.max(1, Number(sp.page || 1) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const allGuideSlugs = guide
    ? Array.from(new Set(guide.types.flatMap((t) => t.modelSlugs)))
    : [];

  const [totalCount, topBrands, siblingCategories, items, guideModels, origin] = await Promise.all([
    getCategoryProductCount(category.id),
    getCategoryTopBrands(category.id, 14),
    division ? getActiveCategories(division.id) : Promise.resolve([]),
    queryProducts({
      category: category.slug,
      brand: brandSlug || undefined,
      q: q || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getProductsBySlugs(allGuideSlugs),
    getDetectedSiteOrigin(settings),
  ]);

  const guideModelMap = new Map(guideModels.map((m) => [m.product.slug, m]));
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const categoryUrl = buildAbsoluteUrl(origin, `/categories/${category.slug}`);

  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: guide?.seoTitle || category.name,
        description:
          guide?.seoDescription ||
          category.description ||
          `Wholesale ${category.name} catalog supplied across India by Radiant Industrial Co.`,
        url: categoryUrl,
        image: category.thumbnailUrl
          ? buildAbsoluteUrl(origin, category.thumbnailUrl)
          : division?.heroImageUrl
          ? buildAbsoluteUrl(origin, division.heroImageUrl)
          : undefined,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: totalCount,
          itemListElement: items.slice(0, 24).map((row, idx) => ({
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
          ...(division
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: division.name,
                  item: buildAbsoluteUrl(origin, `/divisions/${division.slug}`),
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: division ? 3 : 2,
            name: category.name,
            item: categoryUrl,
          },
        ],
      },
      ...(guide && guide.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: guide.faqs.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: f.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };

  const pageNumbers = buildPaginationNumbers(currentPage, totalPages);

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />

      {/* Category Banner */}
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-stone-300">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            {division && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <Link href={`/divisions/${division.slug}`} className="hover:text-white">
                  {division.name}
                </Link>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-semibold">{category.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-widest text-[#FF984F]">
                <Package className="w-3.5 h-3.5" />
                {totalCount.toLocaleString("en-IN")} PRODUCTS INDEXED
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {category.name}
              </h1>
              <p className="text-base text-stone-300 leading-relaxed max-w-2xl">
                {category.description ||
                  `Wholesale industrial & B2B sourcing across ${category.name}. Pan-India GST dispatch confirmed upon order.`}
              </p>
            </div>

            <div className="lg:col-span-4 rounded-md border border-stone-700 bg-[#171E26] p-5 space-y-3 text-xs">
              <div className="font-bold text-white text-sm">Need a Bulk {category.name} Quote?</div>
              <p className="text-stone-300 leading-relaxed">
                Send your BOM or part numbers for consolidated GST pricing across all stocked &amp; on-order brands.
              </p>
              <Link
                href={`/contact?category=${encodeURIComponent(category.name)}`}
                className="inline-flex items-center gap-1.5 rounded bg-[#C24D00] px-4 py-2 font-bold text-white hover:bg-[#9E3E00] transition-colors"
              >
                Request {category.name} Quote <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Top Brands in Category */}
          {topBrands.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-stone-300">
                Top Brands in {category.name}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/categories/${category.slug}`}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    !brandSlug
                      ? "bg-[#C24D00] text-white"
                      : "bg-white/10 text-stone-200 hover:bg-white/20"
                  }`}
                >
                  All Brands ({totalCount.toLocaleString("en-IN")})
                </Link>
                {topBrands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/categories/${category.slug}?brand=${encodeURIComponent(b.slug)}`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      brandSlug === b.slug
                        ? "bg-[#C24D00] text-white"
                        : "bg-white/10 text-stone-200 hover:bg-white/20"
                    }`}
                  >
                    {b.name} ({b.productCount.toLocaleString("en-IN")})
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="py-10">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          {/* Sibling Categories + Search Bar */}
          <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-mono text-stone-700">
                {brandSlug ? `FILTERED BY BRAND: ${brandSlug.toUpperCase()} • ` : ""}
                SHOWING {items.length} OF {totalCount.toLocaleString("en-IN")} ITEMS
                {!q && !brandSlug && totalPages > 1 && ` • PAGE ${currentPage} OF ${totalPages}`}
              </div>

              <form
                method="GET"
                action={`/categories/${category.slug}`}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                {brandSlug && <input type="hidden" name="brand" value={brandSlug} />}
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    name="q"
                    defaultValue={q}
                    aria-label={`Search ${category.name}`}
                    placeholder={`Search inside ${category.name}...`}
                    className="w-full rounded border border-stone-300 bg-[#F8F8F6] pl-8 pr-3 py-1.5 text-xs text-[#141A21] outline-none focus:border-[#C24D00] focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded bg-[#141A21] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>

            {siblingCategories.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-stone-100">
                <span className="text-[11px] font-mono uppercase text-stone-500 mr-1">
                  Related Categories:
                </span>
                {siblingCategories.map((sc) => (
                  <Link
                    key={sc.id}
                    href={`/categories/${sc.slug}`}
                    className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                      sc.slug === category.slug
                        ? "bg-[#141A21] text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {sc.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Category Sub-Types & Model Links (Page 1 Unfiltered) */}
          {guide && guide.types.length > 0 && currentPage === 1 && !q && !brandSlug && (
            <div className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#C24D00] font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    {guide.badgeLabel}
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#141A21] mt-0.5">
                    {guide.typesTitle}
                  </h2>
                </div>
                <span className="text-xs text-stone-600 max-w-md">{guide.introSummary}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guide.types.map((t) => {
                  const linkedModels = t.modelSlugs
                    .map((s) => guideModelMap.get(s))
                    .filter((m): m is NonNullable<typeof m> => Boolean(m));
                  return (
                    <div
                      key={t.name}
                      className="rounded-md border border-stone-200 bg-[#FBFBFA] p-4 space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-[#141A21]">{t.name}</h3>
                          <span className="rounded bg-[#141A21] px-2 py-0.5 text-[10px] font-mono font-semibold text-white">
                            {t.standard}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-semibold text-[#C24D00]">
                          {t.specRange}
                        </div>
                        <p className="text-xs text-stone-600 leading-relaxed">{t.summary}</p>
                      </div>

                      {linkedModels.length > 0 && (
                        <div className="pt-2 border-t border-stone-200/80 space-y-1.5">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                            Featured Models in Catalog:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {linkedModels.map((m) => (
                              <Link
                                key={m.product.id}
                                href={`/products/${m.product.slug}`}
                                className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-[#141A21] hover:border-[#C24D00] hover:text-[#C24D00] transition-colors"
                              >
                                <span className="font-mono font-bold">
                                  {m.product.sku.replace(/^(?:FESTO|DMC)-/i, "")}
                                </span>
                                <span className="hidden sm:inline truncate max-w-[170px] text-stone-600">
                                  — {m.product.name}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Grid */}
          {items.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 space-y-3">
              <p className="text-sm text-stone-700">
                No listed items matched your filter in {category.name}. Share the exact model or specification and our procurement team will quote it promptly.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/categories/${category.slug}`}
                  className="rounded border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-[#141A21]"
                >
                  Reset Category Filters
                </Link>
                <Link
                  href="/contact"
                  className="rounded bg-[#C24D00] px-5 py-2 text-xs font-bold text-white hover:bg-[#9E3E00]"
                >
                  Request Custom Quote
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((row) => (
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
                    fallbackImageUrl: division?.heroImageUrl || null,
                    specificationsJson: row.product.specificationsJson,
                    brandName: row.brand?.name || null,
                    brandSlug: row.brand?.slug || null,
                    categoryName: row.category?.name || category.name,
                  }}
                />
              ))}
            </div>
          )}

          {/* Crawlable Pagination */}
          {!q && !brandSlug && totalPages > 1 && (
            <nav
              aria-label={`${category.name} pagination`}
              className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stone-200"
            >
              <div className="text-xs font-mono text-stone-600">
                Page {currentPage} of {totalPages} ({totalCount.toLocaleString("en-IN")} total products)
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {currentPage > 1 && (
                  <Link
                    href={
                      currentPage === 2
                        ? `/categories/${category.slug}`
                        : `/categories/${category.slug}?page=${currentPage - 1}`
                    }
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-[#141A21] hover:border-[#141A21]"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNumbers.map((pn, i) =>
                  pn === "..." ? (
                    <span key={`e-${i}`} className="px-2 text-xs text-stone-500">
                      …
                    </span>
                  ) : (
                    <Link
                      key={pn}
                      href={pn === 1 ? `/categories/${category.slug}` : `/categories/${category.slug}?page=${pn}`}
                      aria-current={pn === currentPage ? "page" : undefined}
                      className={`rounded px-3 py-1.5 text-xs font-mono font-bold transition-colors ${
                        pn === currentPage
                          ? "bg-[#141A21] text-white"
                          : "border border-stone-300 bg-white text-[#141A21] hover:border-[#C24D00]"
                      }`}
                    >
                      {pn}
                    </Link>
                  )
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/categories/${category.slug}?page=${currentPage + 1}`}
                    className="inline-flex items-center gap-1 rounded bg-[#C24D00] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#9E3E00]"
                  >
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </nav>
          )}

          {/* Technical Sizing Matrix, Ordering Checklist & Buyer FAQs */}
          {guide && (
            <div className="space-y-6 pt-4">
              {guide.sizingRows.length > 0 && (
                <div className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#141A21]">{guide.sizingTitle}</h2>
                    <p className="text-xs text-stone-600 mt-0.5">{guide.introHeadline}</p>
                  </div>
                  <div className="overflow-x-auto border border-stone-200 rounded-md">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141A21] text-white font-mono uppercase tracking-wider text-[11px]">
                        <tr>
                          {guide.sizingColumns.map((col) => (
                            <th key={col} className="px-3.5 py-2.5 font-semibold whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {guide.sizingRows.map((row, idx) => (
                          <tr key={row.series} className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFBFA]"}>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-[#141A21]">
                              {row.series}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-stone-700">{row.standard}</td>
                            <td className="px-3.5 py-2.5 font-mono text-stone-700">{row.boresOrRange}</td>
                            <td className="px-3.5 py-2.5 font-mono text-stone-700">{row.strokeOrVariant}</td>
                            <td className="px-3.5 py-2.5 text-stone-700">{row.cushioningOrRating}</td>
                            <td className="px-3.5 py-2.5 text-stone-600">{row.portsOrNotes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 rounded-lg border border-stone-200 bg-white p-5 sm:p-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#141A21]">
                    <CheckCircle2 className="w-4 h-4 text-[#C24D00] shrink-0" />
                    <h2>{guide.orderingTitle}</h2>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
                    {guide.orderingChecklist.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#C24D00] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {guide.faqs.length > 0 && (
                  <div className="lg:col-span-6 rounded-lg border border-stone-200 bg-white p-5 sm:p-6 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-[#141A21]">
                      <HelpCircle className="w-4 h-4 text-[#C24D00] shrink-0" />
                      <h2>Procurement FAQs — {category.name}</h2>
                    </div>
                    <div className="space-y-3">
                      {guide.faqs.map((faq) => (
                        <div key={faq.question} className="border-t border-stone-100 first:border-t-0 pt-2.5 first:pt-0">
                          <h3 className="text-xs sm:text-sm font-bold text-[#141A21]">
                            {faq.question}
                          </h3>
                          <p className="text-xs text-stone-600 mt-1 leading-relaxed">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
