import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPageBlocks, getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { EditableBlockText, EditableSettingText } from "@/components/InlineEdit";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [blocks, settings] = await Promise.all([getPageBlocks("about"), getSiteSettings()]);
  const origin = await getDetectedSiteOrigin(settings);
  const title = blocks["hero_title"]?.content || "About Radiant Industrial Co.";
  const description =
    blocks["hero_lead"]?.content ||
    "Headquartered in Ranigunj, Secunderabad, Radiant Industrial Co. is a B2B multi-brand wholesale procurement partner across industrial, technical, agricultural, and facility supplies in India.";

  return buildSeoMetadata({
    origin,
    path: "/about",
    title,
    description,
    settings,
    imageUrl: "/images/hero-industrial.jpg",
  });
}

export default async function AboutPage() {
  const [blocks, settings] = await Promise.all([
    getPageBlocks("about"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);

  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        name: "About Radiant Industrial Co.",
        url: buildAbsoluteUrl(origin, "/about"),
        description:
          blocks["hero_lead"]?.content ||
          "Wholesale industrial MRO, farm, facility, and special items procurement across India.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "About Us", item: buildAbsoluteUrl(origin, "/about") },
        ],
      },
    ],
  };

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-16">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-8 space-y-4">
            <EditableBlockText
              pageSlug="about"
              blockKey="hero_title"
              label="About Headline"
              value={
                blocks["hero_title"]?.content ||
                "One Trusted Supplier for Factories, Workshops & Farms."
              }
              as="h1"
              className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]"
            />
            <EditableBlockText
              pageSlug="about"
              blockKey="hero_lead"
              label="About Lead"
              value={
                blocks["hero_lead"]?.content ||
                "Based in Ranigunj, Secunderabad, Radiant Industrial Co. saves you the hassle of dealing with dozens of separate shops and vendors."
              }
              as="p"
              multiline
              className="text-base sm:text-lg text-stone-300 leading-relaxed max-w-2xl"
            />
          </div>

          <div className="lg:col-span-4 rounded-lg border border-stone-800 bg-[#171E26] p-6 space-y-3 text-sm">
            <div className="font-mono text-xs uppercase tracking-wider text-[#EA6A12]">
              Contact Office
            </div>
            <div>
              <div className="font-semibold text-white">Office Address</div>
              <div className="text-stone-300 mt-0.5">
                <EditableSettingText
                  settingKey="contact_address"
                  label="Office Address"
                  value={
                    settings["contact_address"] ||
                    "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India"
                  }
                />
              </div>
            </div>
            <div>
              <div className="font-semibold text-white">Phone / WhatsApp</div>
              <div className="font-mono text-stone-300 mt-0.5">
                {settings["contact_phone"] || "+91 8522095253"}
              </div>
            </div>
            <div>
              <div className="font-semibold text-white">Email</div>
              <div className="font-mono text-stone-300 mt-0.5">
                {settings["contact_email"] || "info@radiantindustrial.in"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 rounded-md border border-[#E4E4E0] bg-white p-8 space-y-4">
            <EditableBlockText
              pageSlug="about"
              blockKey="story_title"
              label="Our Story Title"
              value={blocks["story_title"]?.content || "Why Multi-Brand Consolidation Matters"}
              as="h2"
              className="text-2xl font-bold text-[#141A21] tracking-tight"
            />
            <EditableBlockText
              pageSlug="about"
              blockKey="story_body"
              label="Our Story Body"
              value={
                blocks["story_body"]?.content ||
                "Procurement teams routinely waste weeks chasing dozens of single-brand dealers for bearings, safety PPE, cables, hydraulic pumps, storage racks, and irrigation hardware. Radiant Industrial Co. bridges that gap as an agile, single-point B2B sourcing partner—matching exact OEM specifications, consolidating freight, and issuing compliant GST documentation."
              }
              as="p"
              multiline
              className="text-base text-stone-600 leading-relaxed"
            />
          </div>

          <div className="lg:col-span-5 rounded-md border border-[#E4E4E0] bg-[#141A21] text-white p-8 space-y-4">
            <EditableBlockText
              pageSlug="about"
              blockKey="mission_title"
              label="Our Mission Title"
              value={blocks["mission_title"]?.content || "Commercial Discipline & Speed"}
              as="h2"
              className="text-2xl font-bold tracking-tight"
            />
            <EditableBlockText
              pageSlug="about"
              blockKey="mission_body"
              label="Our Mission Body"
              value={
                blocks["mission_body"]?.content ||
                "Every quotation carries explicit brand make, technical specs, lead time (confirmed upon order), and standard 7-day rate validity. Orders are processed swiftly upon formal Purchase Order receipt."
              }
              as="p"
              multiline
              className="text-sm sm:text-base text-stone-300 leading-relaxed"
            />
            <div className="pt-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609]"
              >
                Partner With Radiant
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
