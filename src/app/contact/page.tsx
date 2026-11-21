import React from "react";
import type { Metadata } from "next";
import { getPageBlocks, getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, buildSeoMetadata, getDetectedSiteOrigin } from "@/lib/seo";
import { EditableBlockText, EditableSettingText } from "@/components/InlineEdit";
import { ContactQuoteForm } from "@/components/ContactQuoteForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [blocks, settings] = await Promise.all([getPageBlocks("contact"), getSiteSettings()]);
  const origin = await getDetectedSiteOrigin(settings);
  const title = blocks["page_title"]?.content || "Contact & Request Wholesale Quotation";
  const description =
    blocks["page_lead"]?.content ||
    "Submit a formal RFQ, upload a BOM/PO, or connect via WhatsApp or Email with Radiant Industrial Co. in Ranigunj, Secunderabad.";

  return buildSeoMetadata({
    origin,
    path: "/contact",
    title,
    description,
    settings,
    imageUrl: "/images/hero-industrial.jpg",
  });
}

export default async function ContactPage() {
  const [blocks, settings] = await Promise.all([
    getPageBlocks("contact"),
    getSiteSettings(),
  ]);
  const origin = await getDetectedSiteOrigin(settings);

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        name: "Request a Wholesale Quote — Radiant Industrial Co.",
        url: buildAbsoluteUrl(origin, "/contact"),
        mainEntity: {
          "@type": "LocalBusiness",
          name: settings["company_name"] || "Radiant Industrial Co.",
          telephone: settings["contact_phone"] || "+91 8522095253",
          email: settings["contact_email"] || "info@radiantindustrial.in",
          address: settings["contact_address"] || "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "Contact", item: buildAbsoluteUrl(origin, "/contact") },
        ],
      },
    ],
  };

  return (
    <div className="bg-[#F4F4F0] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      <section className="bg-radiant-banner text-white border-b border-stone-800 py-14">
        <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 space-y-3">
          <EditableBlockText
            pageSlug="contact"
            blockKey="page_title"
            label="Contact Headline"
            value={blocks["page_title"]?.content || "Ask for a Price Quote"}
            as="h1"
            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
          />
          <EditableBlockText
            pageSlug="contact"
            blockKey="page_lead"
            label="Contact Intro"
            value={
              blocks["page_lead"]?.content ||
              "Send your item list or attach a spreadsheet/PDF via Email, or send a ready-to-go message directly on WhatsApp."
            }
            as="p"
            multiline
            className="text-base text-stone-300 leading-relaxed max-w-2xl"
          />
        </div>
      </section>

      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 py-12 space-y-12">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <ContactQuoteForm />
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#141A21]">
                Secunderabad Procurement Desk
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs font-mono uppercase text-stone-500">Address</div>
                  <div className="text-[#141A21] mt-0.5">
                    <EditableSettingText
                      settingKey="contact_address"
                      label="HQ Address"
                      value={
                        settings["contact_address"] ||
                        "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India"
                      }
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase text-stone-500">Phone / WhatsApp</div>
                  <div className="font-mono text-[#141A21] mt-0.5">
                    <EditableSettingText
                      settingKey="contact_phone"
                      label="Phone"
                      value={settings["contact_phone"] || "+91 8522095253"}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase text-stone-500">Email</div>
                  <div className="font-mono text-[#141A21] mt-0.5">
                    <EditableSettingText
                      settingKey="contact_email"
                      label="Email"
                      value={settings["contact_email"] || "info@radiantindustrial.in"}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase text-stone-500">Operating Hours</div>
                  <div className="text-[#141A21] mt-0.5">
                    <EditableSettingText
                      settingKey="operating_hours"
                      label="Hours"
                      value={settings["operating_hours"] || "Mon – Sat, 9:00 AM – 6:00 PM IST"}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-2">
              <h3 className="text-sm font-bold text-[#141A21]">
                Standard Commercial Terms
              </h3>
              <EditableBlockText
                pageSlug="contact"
                blockKey="commercial_terms"
                label="Commercial Terms Summary"
                value={
                  blocks["commercial_terms"]?.content ||
                  "1. Quotations valid for 7 days unless stated otherwise. 2. Delivery & dispatch timelines are confirmed upon order. 3. Applicable GST charged as per HSN classification. 4. Orders processed against valid Purchase Order (PO) or advance PI confirmation."
                }
                as="p"
                multiline
                className="text-xs text-stone-600 leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
