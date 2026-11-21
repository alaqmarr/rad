import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getActiveBrandsWithMeta, getCatalogSummaryCounts } from "@/lib/catalog";
import { getPageBlocks, getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { EditableBlockText } from "@/components/InlineEdit";
import { BrandsCatalogClient } from "@/components/BrandsCatalogClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [brandsList, counts, blocks, settings] = await Promise.all([
    getActiveBrandsWithMeta(),
    getCatalogSummaryCounts(),
    getPageBlocks("brands"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);
  const title =
    blocks["page_title"]?.content ||
    `Brands We Source (${brandsList.length}+ OEMs & Indian Brands)`;
  const description =
    blocks["page_lead"]?.content ||
    `Wholesale B2B supplier for ${brandsList.length}+ industrial, electrical, safety PPE, fastener, and engineering brands across India (${counts.products.toLocaleString(
      "en-IN"
    )}+ SKUs including Bosch, DeWalt, Taparia, Mitutoyo, Fluke, Festo, SKF, Karam, Loctite & Havells).`;

  return buildSeoMetadata({
    origin,
    path: "/brands",
    title,
    description,
    keywords: [
      ...brandsList.slice(0, 15).map((b) => `${b.name} supplier India`),
      "industrial brands wholesale India",
      "multi-brand MRO distributor Secunderabad",
    ],
    settings,
    imageUrl: "/images/div-industrial.jpg",
  });
}

export default async function BrandsPage() {
  const [brandsList, counts, blocks, settings] = await Promise.all([
    getActiveBrandsWithMeta(),
    getCatalogSummaryCounts(),
    getPageBlocks("brands"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);
  const uniqueOrigins = new Set(brandsList.map((b) => b.countryOfOrigin).filter(Boolean));

  const brandsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Brands Sourced by Radiant Industrial Co.",
        description: `Complete multi-brand industrial & engineering wholesale directory (${brandsList.length} brands, ${counts.products.toLocaleString(
          "en-IN"
        )}+ products).`,
        url: buildAbsoluteUrl(origin, "/brands"),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: brandsList.length,
          itemListElement: brandsList.map((b, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: b.name,
            url: buildAbsoluteUrl(origin, `/brands/${b.slug}`),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          {
            "@type": "ListItem",
            position: 2,
            name: "Brands",
            item: buildAbsoluteUrl(origin, "/brands"),
          },
        ],
      },
    ],
  };

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandsJsonLd) }}
      />

      {/* Command Banner */}
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-14">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-widest text-[#FF984F]">
                MULTI-BRAND WHOLESALE DIRECTORY
              </div>
              <EditableBlockText
                pageSlug="brands"
                blockKey="page_title"
                label="Brands Directory Title"
                value={blocks["page_title"]?.content || "Brands We Source"}
                as="h1"
                className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
              />
              <EditableBlockText
                pageSlug="brands"
                blockKey="page_lead"
                label="Brands Directory Intro"
                value={
                  blocks["page_lead"]?.content ||
                  `We supply genuine products across ${brandsList.length}+ Indian and international brands. Unless marked authorized, we source these as an independent wholesale supplier.`
                }
                as="p"
                multiline
                className="text-base text-stone-300 leading-relaxed max-w-2xl"
              />
            </div>

            <div className="lg:col-span-5 rounded-md border border-stone-700 bg-[#171E26] p-5 space-y-3 text-sm text-stone-300 leading-relaxed">
              <div>
                <strong className="text-white block mb-1">
                  Looking for another OEM brand or exact part number?
                </strong>
                We source unlisted global brands, legacy machinery spares, and custom B2B bills of material on request.
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded bg-[#C24D00] px-4 py-2 text-xs font-bold text-white hover:bg-[#A64000] transition-colors"
              >
                Ask Us for a Custom Quote →
              </Link>
            </div>
          </div>

          {/* Authority Stat Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {brandsList.length}
              </div>
              <div className="text-xs text-stone-300 mt-0.5">Active OEM &amp; Indian Brands</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {counts.products.toLocaleString("en-IN")}+
              </div>
              <div className="text-xs text-stone-300 mt-0.5">Catalog SKUs Indexed</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {uniqueOrigins.size} Countries
              </div>
              <div className="text-xs text-stone-300 mt-0.5">Global Manufacturing Origins</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                Pan-India
              </div>
              <div className="text-xs text-stone-300 mt-0.5">Lead Time Confirmed Upon Order</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Brand Directory */}
      <section className="py-10 sm:py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16">
          <BrandsCatalogClient brands={brandsList} />
        </div>
      </section>
    </div>
  );
}
