import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { getPublicDocuments } from "@/lib/catalog";
import { getPageBlocks, getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { EditableBlockText } from "@/components/InlineEdit";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [blocks, settings] = await Promise.all([
    getPageBlocks("documents"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);
  const title =
    blocks["page_title"]?.content || "Technical Documents, Catalogs & Commercial Terms";
  const description =
    blocks["page_lead"]?.content ||
    "Download Radiant Industrial Co. vendor registration profile, commercial terms, product datasheets, and brand catalogs.";

  return buildSeoMetadata({
    origin,
    path: "/documents",
    title,
    description,
    settings,
    imageUrl: "/logos/logo-long.png",
  });
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const activeCat = sp.category || "all";
  const [docs, blocks, settings] = await Promise.all([
    getPublicDocuments(activeCat),
    getPageBlocks("documents"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);

  const docsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Radiant Industrial Co. Documents & Catalogs",
        url: buildAbsoluteUrl(origin, "/documents"),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "Documents", item: buildAbsoluteUrl(origin, "/documents") },
        ],
      },
    ],
  };

  const categories = [
    { key: "all", label: "All Documents" },
    { key: "datasheet", label: "Product Datasheets" },
    { key: "catalog", label: "Brand Catalogs" },
    { key: "company_profile", label: "Vendor Profile" },
    { key: "terms", label: "Commercial Terms" },
    { key: "compliance", label: "Compliance & HSN" },
  ];

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-14">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-3">
          <EditableBlockText
            pageSlug="documents"
            blockKey="page_title"
            label="Documents Hub Title"
            value={
              blocks["page_title"]?.content ||
              "Company Documents & Product Brochures"
            }
            as="h1"
            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
          />
          <EditableBlockText
            pageSlug="documents"
            blockKey="page_lead"
            label="Documents Hub Intro"
            value={
              blocks["page_lead"]?.content ||
              "Download our company vendor profile, standard order terms, and product specification sheets."
            }
            as="p"
            multiline
            className="text-base text-stone-300 leading-relaxed max-w-2xl"
          />
        </div>
      </section>

      <section className="py-10">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.key}
                href={cat.key === "all" ? "/documents" : `/documents?category=${cat.key}`}
                className={`rounded px-3.5 py-2 text-xs font-semibold transition-colors ${
                  activeCat === cat.key
                    ? "bg-[#141A21] text-white"
                    : "bg-white border border-stone-200 text-stone-700 hover:border-stone-400"
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          <div className="divide-y divide-[#E4E4E0] rounded-md border border-[#E4E4E0] bg-white">
            {docs.length === 0 ? (
              <div className="p-8 text-sm text-stone-500">
                No documents found under this category yet. Upload PDFs or technical sheets from the Admin Documents Manager.
              </div>
            ) : (
              docs.map(({ document: doc, brand, product }) => (
                <div
                  key={doc.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FBFBFA] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded border border-stone-200 bg-stone-50 flex items-center justify-center shrink-0 text-[#EA6A12]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#141A21]">{doc.title}</h2>
                      {doc.description && (
                        <p className="text-sm text-stone-600 mt-1 max-w-2xl">
                          {doc.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs font-mono text-stone-500">
                        <span>TYPE: {doc.category.toUpperCase()}</span>
                        {brand && <span>BRAND: {brand.name}</span>}
                        {product && <span>SKU: {product.sku}</span>}
                        {doc.fileSize > 0 && (
                          <span>SIZE: {(doc.fileSize / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded border border-[#141A21] bg-white px-4 py-2 text-xs font-semibold text-[#141A21] hover:bg-[#141A21] hover:text-white transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Open / Download
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
