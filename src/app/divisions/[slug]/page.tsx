import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  getActiveCategories,
  getActiveDivisions,
  getDivisionBySlug,
  queryProducts,
} from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSlug = slug === "special-technical" ? "special-items" : slug;
  const [division, settings] = await Promise.all([
    getDivisionBySlug(resolvedSlug),
    getSiteSettings(),
  ]);
  if (!division) return { title: "Supply Area Not Found", robots: { index: false, follow: false } };

  const cats = await getActiveCategories(division.id);
  const origin = await getDetectedSiteOrigin(settings);

  return buildSeoMetadata({
    origin,
    path: `/divisions/${division.slug}`,
    title: division.seoTitle || division.name,
    description: division.seoDescription || division.description || division.tagline,
    keywords: [division.name, ...cats.map((c) => c.name)],
    settings,
    imageUrl: division.heroImageUrl || "/images/div-industrial.jpg",
  });
}

export default async function DivisionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "special-technical") {
    redirect("/divisions/special-items");
  }
  const [division, allDivisions] = await Promise.all([
    getDivisionBySlug(slug),
    getActiveDivisions(),
  ]);
  if (!division) notFound();

  const [settings, cats, divProducts] = await Promise.all([
    getSiteSettings(),
    getActiveCategories(division.id),
    queryProducts({ division: division.slug, limit: 60 }),
  ]);
  const origin = await getDetectedSiteOrigin(settings);

  const divisionJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: division.name,
        description: division.description || division.tagline,
        url: buildAbsoluteUrl(origin, `/divisions/${division.slug}`),
        image: division.heroImageUrl ? buildAbsoluteUrl(origin, division.heroImageUrl) : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          {
            "@type": "ListItem",
            position: 2,
            name: division.name,
            item: buildAbsoluteUrl(origin, `/divisions/${division.slug}`),
          },
        ],
      },
    ],
  };

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(divisionJsonLd) }}
      />
      {/* Division Switcher */}
      <div className="border-b border-stone-200 bg-white">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 flex flex-wrap gap-2 py-3 text-xs">
          {allDivisions.map((d) => (
            <Link
              key={d.id}
              href={`/divisions/${d.slug}`}
              className={`rounded-md px-3.5 py-1.5 font-semibold transition-colors ${
                d.slug === division.slug
                  ? "bg-[#141A21] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {d.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Dark Visual Header */}
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-14">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              {division.name}
            </h1>
            <p className="text-lg text-stone-200 leading-relaxed">{division.tagline}</p>
            <p className="text-sm text-stone-400 leading-relaxed max-w-2xl">
              {division.description}
            </p>
            <div className="pt-2">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-md bg-[#EA6A12] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609]"
              >
                Ask for {division.name} Quote
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="aspect-[16/10] rounded-lg border border-stone-800 overflow-hidden bg-stone-900">
              <img
                src={division.heroImageUrl || "/images/div-industrial.jpg"}
                alt={division.name}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories Strip */}
      <section className="border-b border-stone-200 bg-white py-10">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-4">
          <h2 className="text-lg font-bold text-[#141A21]">Categories in {division.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cats.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="group rounded-md border border-stone-200 bg-[#F9F9F7] overflow-hidden hover:border-stone-400 transition-colors flex items-center gap-4 p-3"
              >
                {c.thumbnailUrl && (
                  <img
                    src={c.thumbnailUrl}
                    alt={c.name}
                    className="w-16 h-16 rounded object-cover shrink-0 border border-stone-200"
                  />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm text-[#141A21] group-hover:text-[#EA6A12]">
                    {c.name}
                  </div>
                  <div className="text-xs text-stone-500 line-clamp-2 mt-0.5">
                    {c.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Division Catalog */}
      <section className="py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#141A21]">
              {division.name} Items ({divProducts.length})
            </h2>
            <Link
              href={`/products?division=${division.slug}`}
              className="text-sm font-semibold text-[#EA6A12] hover:underline"
            >
              Filter All Items →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {divProducts.map((row) => (
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
                  fallbackImageUrl: division.heroImageUrl || null,
                  specificationsJson: row.product.specificationsJson,
                  brandName: row.brand?.name || null,
                  brandSlug: row.brand?.slug || null,
                  categoryName: row.category?.name || null,
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
