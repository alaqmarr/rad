import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBrandBySlug, queryProducts } from "@/lib/catalog";
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
  const [brand, settings] = await Promise.all([getBrandBySlug(slug), getSiteSettings()]);
  if (!brand) return { title: "Brand Not Found", robots: { index: false, follow: false } };

  const origin = await getDetectedSiteOrigin(settings);
  return buildSeoMetadata({
    origin,
    path: `/brands/${brand.slug}`,
    title: brand.seoTitle || `${brand.name} Wholesale Procurement India`,
    description: brand.seoDescription || brand.description,
    keywords: [brand.name, `${brand.name} supplier India`, `${brand.name} wholesale`],
    settings,
    imageUrl: brand.thumbnailUrl || brand.logoUrl || "/images/div-industrial.jpg",
  });
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [brand, settings] = await Promise.all([getBrandBySlug(slug), getSiteSettings()]);
  if (!brand) notFound();

  const [brandProducts, origin] = await Promise.all([
    queryProducts({ brand: brand.slug, limit: 100 }),
    getDetectedSiteOrigin(settings),
  ]);
  const brandUrl = buildAbsoluteUrl(origin, `/brands/${brand.slug}`);

  const brandJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Brand",
        name: brand.name,
        description: brand.description,
        url: brandUrl,
        logo: brand.logoUrl ? buildAbsoluteUrl(origin, brand.logoUrl) : undefined,
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
          <nav className="flex items-center gap-1.5 text-xs text-stone-400">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/brands" className="hover:text-white">Brands</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-medium">{brand.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-3">
              {brand.logoUrl && (
                <div className="inline-block bg-white rounded p-2 mb-2">
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-10 w-auto object-contain"
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
            <div className="lg:col-span-4 rounded-md border border-stone-800 bg-[#171E26] p-5 space-y-2 text-xs">
              <div className="text-stone-400">
                Status:{" "}
                <strong className="text-white">
                  {brand.sourcingType === "authorized"
                    ? "Authorized Partner"
                    : "Independent Sourcing (Not Authorized Dealer)"}
                </strong>
              </div>
              <p className="text-stone-300 leading-relaxed">
                {brand.sourcingNote ||
                  "We buy and supply genuine products from this brand directly against your order."}
              </p>
              <Link
                href="/contact"
                className="inline-block pt-2 font-semibold text-[#EA6A12] hover:underline"
              >
                Ask for {brand.name} Prices →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          <div className="text-xs font-mono text-stone-600">
            {brandProducts.length} ITEMS LISTED UNDER {brand.name.toUpperCase()}
          </div>

          {brandProducts.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 space-y-3">
              <p className="text-sm text-stone-600">
                All {brand.name} products are priced on request. Tell us the model number or item you need and we will reply with a clear price quote.
              </p>
              <Link
                href="/contact"
                className="inline-block rounded-md bg-[#EA6A12] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Ask for {brand.name} Quote
              </Link>
            </div>
          ) : (
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
          )}
        </div>
      </section>
    </div>
  );
}
