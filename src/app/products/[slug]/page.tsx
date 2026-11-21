import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Package, ChevronRight, Download } from "lucide-react";
import { getProductBySlug } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import {
  buildAbsoluteUrl,
  buildSeoMetadata,
  getDetectedSiteOrigin,
  stripTrailingCompanyName,
} from "@/lib/seo";
import { InlineProductPriceEditor } from "@/components/InlineEdit";
import { ProductDetailActions } from "@/components/ProductDetailActions";
import { ProductPrimaryMedia } from "@/components/ProductPrimaryMedia";
import { htmlToCleanText } from "@/lib/sanitize-text";
import type { SpecRow } from "@/db/schema";

export const dynamic = "force-dynamic";

const INTERNAL_SKU_PREFIX_RE =
  /^(?:DMC|KBL|TAP|BSH|MKT|MIT|FLK|BKD|DWT|HKK|ADD|FRM|ALK|TLT|ECO|PFP|DWS|FVL|FEV|FVK|MSL|FVB|BST|LOC|JDL|GODREJ|SUP|PLC|HAV|FES|HNY|NTN|LT-SW|LTV|JAIN|NTF|FLC|UNB|3M|ESAB|NRT|FEN|SKF|GAZ|KRM|UDY|STN|STR)-(.+)$/i;

function extractManufacturerPartNumber(sku: string, specs: SpecRow[]): string {
  for (const s of specs) {
    if (
      /^(mpn|part\s*(number|no\.?|designation)|model(\s*no\.?)?|catalog(?:ue)?\s*(code|no\.?|number))$/i.test(
        (s.label || "").trim()
      )
    ) {
      const val = (s.value || "").trim();
      if (val && val.length <= 64 && !/^(n\/?a|as applicable|-)$/i.test(val)) {
        return val;
      }
    }
  }
  const match = sku.trim().match(INTERNAL_SKU_PREFIX_RE);
  return match?.[1]?.trim() || sku.trim();
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleContainsCode(title: string, code: string): boolean {
  const normCode = normalizeToken(code);
  if (normCode.length < 2) return false;
  return normalizeToken(title).includes(normCode);
}

function buildCleanProductTitle(
  cleanName: string,
  mpn: string,
  sku: string,
  rawSeoTitle: string | null | undefined,
  companyName: string
): string {
  let candidate = rawSeoTitle
    ? stripTrailingCompanyName(htmlToCleanText(rawSeoTitle, true) || rawSeoTitle, companyName)
    : "";

  if (candidate) {
    const trailingParen = candidate.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (trailingParen) {
      const base = trailingParen[1].trim();
      const inside = trailingParen[2].trim();
      const normInside = normalizeToken(inside);
      const isKnownCode = normInside === normalizeToken(sku) || normInside === normalizeToken(mpn);
      if (isKnownCode && titleContainsCode(base, mpn)) {
        candidate = base;
      }
    }
    if (candidate) return candidate;
  }

  if (mpn && !titleContainsCode(cleanName, mpn)) {
    return `${cleanName} (${mpn})`;
  }
  return cleanName;
}

function parseSpecsJson(raw: string | null | undefined): SpecRow[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!data) return { title: "Product Not Found", robots: { index: false, follow: false } };

  const origin = await getDetectedSiteOrigin(settings);
  const { product, division, category, brand } = data;
  const companyName = settings["company_name"] || "Radiant Industrial Co.";
  const cleanName = htmlToCleanText(product.name, true) || product.name;
  const specs = parseSpecsJson(product.specificationsJson);
  const mpn = extractManufacturerPartNumber(product.sku, specs);
  const seoTitle = buildCleanProductTitle(cleanName, mpn, product.sku, product.seoTitle, companyName);

  const rawDesc =
    product.seoDescription ||
    product.shortDescription ||
    `${cleanName} (${mpn}) wholesale supply across India by ${companyName}.`;
  const cleanMetaDesc =
    htmlToCleanText(rawDesc, true) ||
    `${cleanName} wholesale supply across India by ${companyName}.`;

  const image = product.primaryImageUrl || division?.heroImageUrl || "/images/hero-industrial.jpg";

  return buildSeoMetadata({
    origin,
    path: `/products/${product.slug}`,
    title: seoTitle,
    description: cleanMetaDesc,
    keywords: [
      cleanName,
      mpn,
      product.sku,
      brand?.name || "",
      category?.name || "",
      division?.name || "",
      product.hsnCode ? `HSN ${product.hsnCode}` : "",
    ].filter(Boolean),
    settings,
    imageUrl: image,
  });
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
  const companyName = settings["company_name"] || "Radiant Industrial Co.";
  const cleanName = htmlToCleanText(product.name, true) || product.name;
  const cleanShortDesc = htmlToCleanText(product.shortDescription, true);
  const cleanDescription = htmlToCleanText(product.description, false);
  const specs = parseSpecsJson(product.specificationsJson);
  const mpn = extractManufacturerPartNumber(product.sku, specs);

  let gallery: string[] = [];
  try {
    gallery = JSON.parse(product.galleryJson || "[]");
  } catch {
    gallery = [];
  }

  const siteUrl = await getDetectedSiteOrigin(settings);
  const showPublicPrices = settings["show_public_prices"] === "true";
  const imageUrl = buildAbsoluteUrl(
    siteUrl,
    product.primaryImageUrl || division?.heroImageUrl || "/images/hero-industrial.jpg"
  );
  const imagesList = Array.from(
    new Set([imageUrl, ...gallery.map((g) => buildAbsoluteUrl(siteUrl, g))])
  );
  const productUrl = buildAbsoluteUrl(siteUrl, `/products/${product.slug}`);

  const hasVerifiedPrice =
    showPublicPrices &&
    product.pricingMode === "priced" &&
    product.basePrice != null &&
    Number(product.basePrice) > 0;

  const statusLower = (product.inStockStatus || "").toLowerCase();
  const schemaAvailability =
    statusLower.includes("in stock") &&
    !statusLower.includes("confirmed") &&
    !statusLower.includes("order")
      ? "https://schema.org/InStock"
      : "https://schema.org/PreOrder";

  const breadcrumbItems: Array<{ "@type": string; position: number; name: string; item: string }> = [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Products", item: `${siteUrl}/products` },
  ];
  if (division) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: division.name,
      item: `${siteUrl}/divisions/${division.slug}`,
    });
  }
  if (category) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: category.name,
      item: `${siteUrl}/categories/${category.slug}`,
    });
  }
  breadcrumbItems.push({
    "@type": "ListItem",
    position: breadcrumbItems.length + 1,
    name: cleanName,
    item: productUrl,
  });

  const productJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: cleanName,
        sku: product.sku,
        mpn,
        image: imagesList,
        description: cleanDescription || cleanShortDesc || undefined,
        brand: brand ? { "@type": "Brand", name: brand.name } : undefined,
        category: category?.name,
        url: productUrl,
        additionalProperty: specs.map((s) => ({
          "@type": "PropertyValue",
          name: s.label,
          value: s.value,
        })),
        ...(hasVerifiedPrice
          ? {
              offers: {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: "INR",
                price: product.basePrice,
                availability: schemaAvailability,
                seller: {
                  "@type": "Organization",
                  name: companyName,
                },
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
    ],
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
          {category && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href={`/categories/${category.slug}`} className="hover:text-[#141A21]">
                {category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-mono text-[#141A21]">{mpn}</span>
        </nav>

        {/* Main 12-Col Spec Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Product Media */}
          <div className="lg:col-span-5 space-y-4">
            <div className="aspect-[4/3] w-full rounded-lg border border-stone-200 bg-[#141A21] overflow-hidden flex items-center justify-center relative">
              <ProductPrimaryMedia
                imageUrl={product.primaryImageUrl}
                name={cleanName}
                sku={product.sku}
                brandName={brand?.name}
                categoryName={category?.name || division?.name}
              />
            </div>

            {gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {gallery.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded border border-[#E4E4E0] bg-white overflow-hidden"
                  >
                    <img
                      src={imgUrl}
                      alt={`${cleanName} ${idx + 1}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain p-1"
                    />
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
                    className="font-semibold text-[#C24D00] hover:underline"
                  >
                    {brand.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-stone-600">Multi-Brand Sourcing</span>
                )}
                <div className="flex items-center gap-3 font-mono text-stone-600">
                  {mpn !== product.sku && <span>MPN: {mpn}</span>}
                  <span>SKU: {product.sku}</span>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#141A21] tracking-tight">
                {cleanName}
              </h1>
              <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                {cleanShortDesc}
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
                {cleanDescription}
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

            <div className="rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
              <strong className="text-[#141A21]">Before Ordering:</strong> Specifications, dimensions, and part revisions can vary by batch. Please confirm your exact technical specifications with our team via WhatsApp or Email before placing an order.
            </div>
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
