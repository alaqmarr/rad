import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Package, ChevronRight, Download } from "lucide-react";
import { getProductBySlug } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { InlineProductPriceEditor } from "@/components/InlineEdit";
import { ProductDetailActions } from "@/components/ProductDetailActions";
import type { SpecRow } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: "Product Not Found" };

  return {
    title: data.product.seoTitle || `${data.product.name} (${data.product.sku})`,
    description: data.product.seoDescription || data.product.shortDescription,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!data) notFound();

  const { product, division, category, brand, documents } = data;
  let specs: SpecRow[] = [];
  let gallery: string[] = [];
  try {
    specs = JSON.parse(product.specificationsJson || "[]");
  } catch {
    specs = [];
  }
  try {
    gallery = JSON.parse(product.galleryJson || "[]");
  } catch {
    gallery = [];
  }

  const siteUrl = settings["site_url"] || "https://radiantindustrial.in";

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description || product.shortDescription,
    brand: brand ? { "@type": "Brand", name: brand.name } : undefined,
    category: category?.name,
    url: `${siteUrl}/products/${product.slug}`,
    offers:
      product.pricingMode === "priced" && product.basePrice != null
        ? {
            "@type": "Offer",
            priceCurrency: "INR",
            price: product.basePrice,
            availability: "https://schema.org/InStock",
          }
        : undefined,
  };

  return (
    <div className="bg-[#FBFBFA] min-h-screen py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-8">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          <Link href="/" className="hover:text-[#141A21]">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/products" className="hover:text-[#141A21]">Products</Link>
          {division && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href={`/divisions/${division.slug}`} className="hover:text-[#141A21]">
                {division.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-mono text-[#141A21]">{product.sku}</span>
        </nav>

        {/* Main 12-Col Spec Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Product Media */}
          <div className="lg:col-span-5 space-y-4">
            <div className="aspect-[4/3] w-full rounded-lg border border-stone-200 bg-[#0F141A] overflow-hidden flex items-center justify-center relative">
              {product.primaryImageUrl ? (
                <img
                  src={product.primaryImageUrl}
                  alt={product.name}
                  className="h-full w-full object-contain bg-white p-4"
                />
              ) : (
                <>
                  <img
                    src={division?.heroImageUrl || "/images/div-industrial.jpg"}
                    alt={product.name}
                    className="h-full w-full object-cover opacity-55"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F141A] via-[#0F141A]/40 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <div className="font-mono text-xs text-[#EA6A12]">{product.sku}</div>
                    <div className="text-sm font-semibold mt-0.5">{brand?.name || division?.name}</div>
                  </div>
                </>
              )}
            </div>

            {gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {gallery.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded border border-[#E4E4E0] bg-white overflow-hidden"
                  >
                    <img src={imgUrl} alt={`${product.name} ${idx + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Commercial Spec & Dual Quote Actions */}
          <div className="lg:col-span-7 rounded-md border border-[#E4E4E0] bg-white p-6 sm:p-8 space-y-6">
            <div className="space-y-2 border-b border-stone-200 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {brand ? (
                  <Link
                    href={`/brands/${brand.slug}`}
                    className="font-semibold text-[#EA6A12] hover:underline"
                  >
                    {brand.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-stone-600">Multi-Brand Sourcing</span>
                )}
                <span className="font-mono text-stone-500">SKU: {product.sku}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#141A21] tracking-tight">
                {product.name}
              </h1>
              <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                {product.shortDescription}
              </p>
            </div>

            {/* Pricing (Inline editable when Admin is in Edit Mode) */}
            <div className="rounded border border-stone-200 bg-[#FBFBFA] p-4">
              <InlineProductPriceEditor
                productId={product.id}
                pricingMode={product.pricingMode as "priced" | "rfq_only"}
                basePrice={product.basePrice}
                priceUnit={product.priceUnit}
                gstPercent={product.gstPercent}
              />
            </div>

            {/* Commercial Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E4E4E0] border border-[#E4E4E0] rounded overflow-hidden text-xs">
              <div className="bg-white p-3">
                <div className="text-stone-500">HSN Code</div>
                <div className="font-mono font-semibold text-[#141A21] mt-0.5">
                  {product.hsnCode || "As Applicable"}
                </div>
              </div>
              <div className="bg-white p-3">
                <div className="text-stone-500">MOQ</div>
                <div className="font-mono font-semibold text-[#141A21] mt-0.5">{product.moq}</div>
              </div>
              <div className="bg-white p-3">
                <div className="text-stone-500">Lead Time</div>
                <div className="font-mono font-semibold text-[#141A21] mt-0.5">
                  {product.leadTime}
                </div>
              </div>
              <div className="bg-white p-3">
                <div className="text-stone-500">Availability</div>
                <div className="font-semibold text-[#141A21] mt-0.5">{product.inStockStatus}</div>
              </div>
            </div>

            <ProductDetailActions
              item={{
                productId: product.id,
                sku: product.sku,
                name: product.name,
                brand: brand?.name,
                qty: "1",
                unit: product.priceUnit,
                listedPrice: product.pricingMode === "priced" ? product.basePrice : null,
              }}
            />

            {brand && brand.sourcingType === "independent" && (
              <div className="text-xs text-stone-500 border-t border-stone-100 pt-4">
                Sourcing Note: Radiant Industrial Co. procures genuine {brand.name} products as an independent B2B wholesale supply partner (not an authorized OEM distributor).
              </div>
            )}
          </div>
        </div>

        {/* Lower Details: Description, Technical Specs Table, Attached R2 Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 rounded-md border border-[#E4E4E0] bg-white p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#141A21] mb-2">Overview &amp; Application</h2>
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {specs.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[#141A21] mb-3">
                  Technical Specifications
                </h2>
                <div className="border border-[#E4E4E0] rounded overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-[#E4E4E0]">
                      {specs.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#FBFBFA]" : "bg-white"}>
                          <th className="py-2.5 px-4 font-medium text-stone-600 w-2/5">
                            {row.label}
                          </th>
                          <td className="py-2.5 px-4 font-mono text-xs sm:text-sm text-[#141A21]">
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 rounded-md border border-[#E4E4E0] bg-white p-6 sm:p-8 space-y-4">
            <h2 className="text-lg font-bold text-[#141A21]">
              Datasheets &amp; Commercial Docs
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-stone-500">
                No product-specific PDF uploaded yet. You can request an OEM datasheet along with your quote, or browse our general{" "}
                <Link href="/documents" className="text-[#EA6A12] underline">
                  Documents Hub
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2.5">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded border border-stone-200 p-3 hover:border-[#EA6A12] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-[#EA6A12] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#141A21] truncate">
                          {doc.title}
                        </div>
                        <div className="text-xs font-mono text-stone-500">{doc.fileName}</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-stone-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
