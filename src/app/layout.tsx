import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuoteSheetDrawer } from "@/components/QuoteSheetDrawer";
import { AiProcurementDrawer } from "@/components/AiProcurementDrawer";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, getDetectedSiteOrigin } from "@/lib/seo";

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
  const origin = await getDetectedSiteOrigin(s);
  const companyName = s["company_name"] || "Radiant Industrial Co.";
  const title =
    s["seo_default_title"] ||
    "Radiant Industrial Co. | Wholesale Industrial MRO, Farm & Special Supplies India";
  const description =
    s["seo_default_description"] ||
    "Wholesale MRO, factory hardware, fasteners, bearings, valves, safety gear, electricals, agricultural irrigation, facility equipment, and custom Special Items across India.";
  const keywords = (s["seo_keywords"] || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const heroImg = buildAbsoluteUrl(origin, s["logo_primary"] || "/images/hero-industrial.jpg");
  const googleVerification = (s["google_site_verification"] || "").trim();

  return {
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: `%s | ${companyName}`,
    },
    description,
    applicationName: companyName,
    authors: [{ name: companyName }],
    creator: companyName,
    publisher: companyName,
    keywords: keywords.length
      ? keywords
      : [
          "B2B industrial procurement India",
          "wholesale industrial MRO supply",
          "agricultural irrigation equipment India",
          "safety PPE wholesale",
          "Secunderabad industrial supplier",
        ],
    alternates: {
      canonical: origin,
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: origin,
      siteName: companyName,
      title,
      description,
      images: [
        {
          url: heroImg,
          width: 1200,
          height: 630,
          alt: companyName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [heroImg],
    },
    icons: {
      icon: "/icon.png",
      apple: "/logos/logo-short.png",
    },
    verification: googleVerification ? { google: googleVerification } : undefined,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const origin = await getDetectedSiteOrigin(settings);
  const companyName = settings["company_name"] || "Radiant Industrial Co.";
  const rawTagId = (settings["google_tag_id"] || "GTM-N7CK5GLP").trim() || "GTM-N7CK5GLP";
  const gaMeasurementId = (settings["google_analytics_id"] || (rawTagId.startsWith("G-") ? rawTagId : "")).trim();
  const gtmId = rawTagId.startsWith("GTM-") ? rawTagId : "GTM-N7CK5GLP";

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WholesaleStore",
        "@id": `${origin}/#organization`,
        name: companyName,
        url: origin,
        logo: buildAbsoluteUrl(origin, settings["logo_primary"] || "/logos/logo-long.png"),
        image: buildAbsoluteUrl(origin, "/images/hero-industrial.jpg"),
        description:
          settings["seo_default_description"] ||
          "Wholesale industrial MRO, agricultural supplies, facility equipment, and custom Special Items across India.",
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
        areaServed: {
          "@type": "Country",
          name: "India",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: companyName,
        publisher: { "@id": `${origin}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${origin}/products?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <body className="min-h-screen flex flex-col bg-[#FBFBFA] text-[#141A21] selection:bg-[#EA6A12]/20 selection:text-[#141A21]">
        <Script id="google-tag-datalayer" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${gaMeasurementId ? `gtag('config', '${gaMeasurementId}', { send_page_view: true });` : ""}
dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});`}
        </Script>
        <Script
          id="google-tag-manager"
          strategy="lazyOnload"
          src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`}
        />
        {gaMeasurementId && (
          <Script
            id="google-analytics-gtag"
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
          />
        )}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
            height="0"
            width="0"
            title="Google Tag Manager"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <Providers
          whatsappNumber={settings["whatsapp_number"] || "918522095253"}
          showPublicPrices={settings["show_public_prices"] === "true"}
        >
          <WebVitalsReporter />
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
