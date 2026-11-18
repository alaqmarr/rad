import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuoteSheetDrawer } from "@/components/QuoteSheetDrawer";
import { AiProcurementDrawer } from "@/components/AiProcurementDrawer";
import { getSiteSettings } from "@/lib/settings";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteUrl = s["site_url"] || "https://radiantindustrial.in";
  const title =
    s["seo_default_title"] ||
    "Radiant Industrial Co. | B2B Wholesale Industrial & Agricultural Procurement India";
  const description =
    s["seo_default_description"] ||
    "Premier B2B wholesale supply and multi-brand industrial procurement partner in Secunderabad, India.";
  const keywords = (s["seo_keywords"] || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: "%s | Radiant Industrial Co.",
    },
    description,
    keywords: keywords.length
      ? keywords
      : [
          "B2B industrial procurement India",
          "wholesale industrial supply",
          "agricultural equipment India",
          "safety PPE wholesale",
          "Secunderabad industrial supplier",
        ],
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: siteUrl,
      siteName: s["company_name"] || "Radiant Industrial Co.",
      title,
      description,
      images: [
        {
          url: s["logo_primary"] || "/logos/logo-long.png",
          width: 1200,
          height: 630,
          alt: s["company_name"] || "Radiant Industrial Co.",
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const siteUrl = settings["site_url"] || "https://radiantindustrial.in";
  const companyName = settings["company_name"] || "Radiant Industrial Co.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    name: companyName,
    url: siteUrl,
    logo: `${siteUrl}${settings["logo_primary"] || "/logos/logo-long.png"}`,
    telephone: settings["contact_phone"] || "+91-8522095253",
    email: settings["contact_email"] || "info@radiantindustrial.in",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Sai Vaishnavi Complex, Ranigunj",
      addressLocality: "Secunderabad",
      addressRegion: "Telangana",
      postalCode: "500003",
      addressCountry: "IN",
    },
    areaServed: "IN",
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-[#FBFBFA] text-[#141A21] selection:bg-[#EA6A12]/20 selection:text-[#141A21]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers
          whatsappNumber={settings["whatsapp_number"] || "918522095253"}
          showPublicPrices={settings["show_public_prices"] === "true"}
        >
          <Navbar
            logoUrl={settings["logo_primary"] || "/logos/logo-long.png"}
            companyName={companyName}
          />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
          <QuoteSheetDrawer />
          {settings["ai_enabled"] !== "false" && <AiProcurementDrawer />}
        </Providers>
      </body>
    </html>
  );
}
