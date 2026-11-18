import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { getPageBlocks, getSiteSettings } from "@/lib/settings";
import {
  getActiveDivisions,
  getActiveCategories,
  getActiveBrands,
  queryProducts,
  getCatalogSummaryCounts,
} from "@/lib/catalog";
import { EditableBlockText } from "@/components/InlineEdit";
import { HomeDivisionExplorer } from "@/components/HomeDivisionExplorer";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

function getBrandInitials(name: string) {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function HomePage() {
  const [
    blocks,
    settings,
    divisionsList,
    categoriesList,
    featuredBrands,
    featuredProducts,
    counts,
  ] = await Promise.all([
    getPageBlocks("home"),
    getSiteSettings(),
    getActiveDivisions(),
    getActiveCategories(),
    getActiveBrands(true),
    queryProducts({ featuredOnly: true, limit: 8 }),
    getCatalogSummaryCounts(),
  ]);

  const heroTitle =
    blocks["hero_title"]?.content ||
    "Industrial, Technical & Farm Supplies Delivered Across India.";
  const heroLead =
    blocks["hero_lead"]?.content ||
    "One dependable wholesale supplier for factory machine parts, power tools, safety gear, electrical cables, and farm equipment — sourced from 24+ trusted brands and shipped from Secunderabad.";

  const waDigits = (settings["whatsapp_number"] || "918522095253").replace(/[^\d]/g, "");

  return (
    <div className="bg-[#F4F4F0]">
      {/* Full-Bleed Architectural Hero */}
      <section className="relative bg-[#0B0F14] text-white overflow-hidden border-b border-stone-800">
        <img
          src="/images/hero-industrial.jpg"
          alt="Precision steel bearings, gears, and brass hydraulic fittings"
          className="absolute inset-0 h-full w-full object-cover object-right opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14] via-[#0B0F14]/90 to-[#0B0F14]/35" />

        <div className="relative z-10 w-full px-5 sm:px-8 lg:px-12 xl:px-16 pt-16 pb-14 lg:pt-24 lg:pb-20">
          <div className="max-w-3xl space-y-6">
            <EditableBlockText
              pageSlug="home"
              blockKey="hero_title"
              label="Hero Headline"
              value={heroTitle}
              as="h1"
              className="text-4xl sm:text-5xl lg:text-[58px] font-extrabold text-white tracking-[-0.03em] leading-[1.06]"
            />
            <EditableBlockText
              pageSlug="home"
              blockKey="hero_lead"
              label="Hero Description"
              value={heroLead}
              as="p"
              multiline
              className="text-base sm:text-lg text-stone-200 leading-relaxed max-w-2xl"
            />
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#C95609] transition-colors"
              >
                Browse All Products
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                  "Hello Radiant Industrial Co., I need help finding a product and getting a price quote."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-white/45 bg-[#0B0F14]/80 backdrop-blur-sm px-6 py-3.5 text-sm font-semibold text-white hover:border-white hover:bg-[#0B0F14] transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#4ADE80]" />
                WhatsApp Our Desk
              </a>
            </div>
          </div>
        </div>

        {/* Unified Bottom Fact Strip */}
        <div className="relative z-10 border-t border-white/15 bg-[#0B0F14]/80 backdrop-blur-sm">
          <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/15">
            <div className="py-4 pr-4">
              <div className="font-mono-num text-xl font-bold text-white">{counts.products}+</div>
              <div className="text-xs text-stone-400">Ready Catalog Items</div>
            </div>
            <div className="py-4 lg:px-6">
              <div className="font-mono-num text-xl font-bold text-white">{counts.brands}+</div>
              <div className="text-xs text-stone-400">Trusted Brands Sourced</div>
            </div>
            <div className="py-4 lg:px-6">
              <div className="font-mono-num text-xl font-bold text-white">7–14 Days</div>
              <div className="text-xs text-stone-400">Standard Pan-India Delivery</div>
            </div>
            <div className="py-4 lg:pl-6">
              <div className="font-mono-num text-xl font-bold text-white">100% GST</div>
              <div className="text-xs text-stone-400">Tax-Compliant Wholesale Billing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Supply Areas & Categories */}
      <section className="py-16 lg:py-20 border-b border-stone-200">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-8">
          <div className="max-w-2xl space-y-2">
            <EditableBlockText
              pageSlug="home"
              blockKey="divisions_heading"
              label="Divisions Section Heading"
              value={blocks["divisions_heading"]?.content || "What We Supply"}
              as="h2"
              className="text-3xl sm:text-4xl font-extrabold text-[#141A21] tracking-tight"
            />
            <EditableBlockText
              pageSlug="home"
              blockKey="divisions_lead"
              label="Divisions Section Intro"
              value={
                blocks["divisions_lead"]?.content ||
                "Pick a supply area to explore product categories, check available rates, or ask us for a quick price quote."
              }
              as="p"
              multiline
              className="text-sm sm:text-base text-stone-600 leading-relaxed"
            />
          </div>

          <HomeDivisionExplorer divisions={divisionsList} categories={categoriesList} />
        </div>
      </section>

      {/* Featured Products & Prices */}
      <section className="bg-white py-16 lg:py-20 border-b border-stone-200">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <EditableBlockText
                pageSlug="home"
                blockKey="featured_heading"
                label="Featured Catalog Heading"
                value={blocks["featured_heading"]?.content || "Popular Products & Prices"}
                as="h2"
                className="text-3xl sm:text-4xl font-extrabold text-[#141A21] tracking-tight"
              />
              <EditableBlockText
                pageSlug="home"
                blockKey="featured_lead"
                label="Featured Catalog Intro"
                value={
                  blocks["featured_lead"]?.content ||
                  "See upfront wholesale rates where prices are fixed, or click Ask for Price on custom and bulk items."
                }
                as="p"
                multiline
                className="text-sm sm:text-base text-stone-600 leading-relaxed"
              />
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#141A21] hover:border-[#141A21] shrink-0"
            >
              View All {counts.products} Products
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {featuredProducts.map((row) => (
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
        </div>
      </section>

      {/* Brands We Source */}
      <section className="py-16 lg:py-20 border-b border-stone-200">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <EditableBlockText
                pageSlug="home"
                blockKey="brands_heading"
                label="Brands Section Heading"
                value={blocks["brands_heading"]?.content || "Brands We Source For You"}
                as="h2"
                className="text-3xl sm:text-4xl font-extrabold text-[#141A21] tracking-tight"
              />
              <EditableBlockText
                pageSlug="home"
                blockKey="brands_disclosure"
                label="Independent Sourcing Disclosure"
                value={
                  blocks["brands_disclosure"]?.content ||
                  "We are not an official authorized dealer for these brands yet. Instead, we act as your independent wholesale buyer — sourcing genuine brand-name parts and equipment directly against your order."
                }
                as="p"
                multiline
                className="text-sm sm:text-base text-stone-600 leading-relaxed"
              />
            </div>
            <Link
              href="/brands"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EA6A12] hover:underline shrink-0"
            >
              See All {counts.brands} Brands <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {featuredBrands.slice(0, 12).map((brand) => {
              const shortName = brand.name.replace(/\s*\(.*?\)/g, "");
              return (
                <Link
                  key={brand.id}
                  href={`/brands/${brand.slug}`}
                  className="group rounded-md border border-stone-200 bg-white p-4 hover:border-stone-400 hover:shadow-sm transition-all flex items-center gap-3"
                >
                  {brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="h-9 w-9 rounded object-contain shrink-0 bg-stone-50 p-1 border border-stone-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded bg-[#141A21] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-[#EA6A12] transition-colors">
                      {getBrandInitials(brand.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#141A21] group-hover:text-[#EA6A12] transition-colors truncate">
                      {shortName}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      {brand.countryOfOrigin}
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-[#EA6A12] shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How Ordering Works + Clean Light CTA (Contrasting cleanly against Dark Footer) */}
      <section className="bg-white py-16 lg:py-20">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-12">
          <div className="max-w-2xl space-y-2">
            <EditableBlockText
              pageSlug="home"
              blockKey="workflow_heading"
              label="Procurement Workflow Heading"
              value={blocks["workflow_heading"]?.content || "How Ordering Works"}
              as="h2"
              className="text-3xl font-extrabold text-[#141A21] tracking-tight"
            />
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Fast, straightforward ordering from enquiry to doorstep delivery anywhere in India.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-md border border-stone-200 bg-[#F9F9F7] p-7">
              <div className="font-mono text-xs font-bold text-[#EA6A12] mb-2">STEP 01</div>
              <h3 className="text-lg font-bold text-[#141A21]">Send Your Item List</h3>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Share product names, brands, or upload your requirement sheet via WhatsApp or Email.
              </p>
            </div>
            <div className="rounded-md border border-stone-200 bg-[#F9F9F7] p-7">
              <div className="font-mono text-xs font-bold text-[#EA6A12] mb-2">STEP 02</div>
              <h3 className="text-lg font-bold text-[#141A21]">Get Clear GST Pricing</h3>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Receive a written quote showing unit prices, brand make, GST, and exact dispatch dates.
              </p>
            </div>
            <div className="rounded-md border border-stone-200 bg-[#F9F9F7] p-7">
              <div className="font-mono text-xs font-bold text-[#EA6A12] mb-2">STEP 03</div>
              <h3 className="text-lg font-bold text-[#141A21]">Confirm &amp; Receive Delivery</h3>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Confirm with your Purchase Order and we ship everything together within 2–14 working days.
              </p>
            </div>
          </div>

          {/* Warm Light Contrast CTA Banner */}
          <div className="rounded-md border border-stone-300 bg-[#F4F4F0] p-8 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl space-y-2">
              <EditableBlockText
                pageSlug="home"
                blockKey="cta_heading"
                label="Bottom CTA Heading"
                value={blocks["cta_heading"]?.content || "Send Us Your Requirement List"}
                as="h2"
                className="text-2xl sm:text-3xl font-extrabold text-[#141A21] tracking-tight"
              />
              <EditableBlockText
                pageSlug="home"
                blockKey="cta_lead"
                label="Bottom CTA Description"
                value={
                  blocks["cta_lead"]?.content ||
                  "Need one part or a full factory list? Message us on WhatsApp or send an email with your items — we will reply quickly with prices, GST details, and delivery dates."
                }
                as="p"
                multiline
                className="text-sm sm:text-base text-stone-600 leading-relaxed"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded bg-[#EA6A12] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#C95609] transition-colors"
              >
                Send Email Quote Request
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                  "Hello Radiant Industrial Co., I would like a price quote for some items."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded border border-stone-400 bg-white px-6 py-3.5 text-sm font-semibold text-[#141A21] hover:border-[#141A21] transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#16A34A]" />
                Message Us on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
