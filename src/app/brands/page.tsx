import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getActiveBrands } from "@/lib/catalog";
import { getPageBlocks, getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { EditableBlockText } from "@/components/InlineEdit";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [brandsList, blocks, settings] = await Promise.all([
    getActiveBrands(),
    getPageBlocks("brands"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);
  const title = blocks["page_title"]?.content || "Brands We Source";
  const description =
    blocks["page_lead"]?.content ||
    `Explore ${brandsList.length}+ Indian and international industrial, electrical, safety, and farm brands sourced by Radiant Industrial Co.`;

  return buildSeoMetadata({
    origin,
    path: "/brands",
    title,
    description,
    keywords: brandsList.slice(0, 12).map((b) => `${b.name} India wholesale`),
    settings,
    imageUrl: "/images/div-industrial.jpg",
  });
}

export default async function BrandsPage() {
  const [brandsList, blocks, settings] = await Promise.all([
    getActiveBrands(),
    getPageBlocks("brands"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);

  const brandsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Brands Sourced by Radiant Industrial Co.",
        url: buildAbsoluteUrl(origin, "/brands"),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: brandsList.length,
          itemListElement: brandsList.slice(0, 30).map((b, idx) => ({
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
          { "@type": "ListItem", position: 2, name: "Brands", item: buildAbsoluteUrl(origin, "/brands") },
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
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-14">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-3">
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
                "We supply genuine products across 24+ Indian and international brands. Unless marked authorized, we source these as an independent wholesale supplier."
              }
              as="p"
              multiline
              className="text-base text-stone-300 leading-relaxed max-w-2xl"
            />
          </div>
          <div className="lg:col-span-5 rounded-md border border-stone-800 bg-[#171E26] p-5 text-sm text-stone-300 leading-relaxed">
            <strong className="text-white block mb-1">
              Looking for another brand or part number?
            </strong>
            We regularly source items from many other manufacturers outside this list.{" "}
            <Link href="/contact" className="text-[#EA6A12] font-semibold hover:underline">
              Ask us for a custom quote →
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {brandsList.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="group rounded-lg border border-stone-200 bg-white overflow-hidden flex flex-col justify-between hover:border-stone-400 hover:shadow-md transition-all"
              >
                {brand.thumbnailUrl && (
                  <div className="h-36 w-full overflow-hidden border-b border-stone-100 bg-stone-100">
                    <img
                      src={brand.thumbnailUrl}
                      alt={brand.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="h-9 w-auto object-contain"
                        />
                      ) : (
                        <h2 className="text-lg font-bold text-[#141A21] group-hover:text-[#EA6A12] transition-colors">
                          {brand.name}
                        </h2>
                      )}
                      <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#EA6A12] shrink-0" />
                    </div>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      {brand.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <span>Origin: {brand.countryOfOrigin}</span>
                    <span className="font-medium text-[#141A21]">
                      {brand.sourcingType === "authorized" ? "Authorized Partner" : "Sourced on Order"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
