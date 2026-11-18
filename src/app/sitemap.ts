import type { MetadataRoute } from "next";
import { getActiveBrands, getActiveDivisions, queryProducts } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, getDetectedSiteOrigin } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, divisions, brands, items] = await Promise.all([
    getSiteSettings(),
    getActiveDivisions(),
    getActiveBrands(),
    queryProducts({ limit: 1000 }),
  ]);

  const baseUrl = await getDetectedSiteOrigin(settings);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      images: [buildAbsoluteUrl(baseUrl, "/images/hero-industrial.jpg")],
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/brands`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/documents`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    },
  ];

  const divisionRoutes: MetadataRoute.Sitemap = divisions.map((d) => ({
    url: `${baseUrl}/divisions/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.85,
    ...(d.heroImageUrl ? { images: [buildAbsoluteUrl(baseUrl, d.heroImageUrl)] } : {}),
  }));

  const brandRoutes: MetadataRoute.Sitemap = brands.map((b) => {
    const img = b.thumbnailUrl || b.logoUrl;
    return {
      url: `${baseUrl}/brands/${b.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.75,
      ...(img ? { images: [buildAbsoluteUrl(baseUrl, img)] } : {}),
    };
  });

  const productRoutes: MetadataRoute.Sitemap = items.map((row) => {
    const img = row.product.primaryImageUrl || row.division?.heroImageUrl;
    return {
      url: `${baseUrl}/products/${row.product.slug}`,
      lastModified: new Date(row.product.updatedAt || Date.now()),
      changeFrequency: "weekly",
      priority: 0.8,
      ...(img ? { images: [buildAbsoluteUrl(baseUrl, img)] } : {}),
    };
  });

  return [...staticRoutes, ...divisionRoutes, ...brandRoutes, ...productRoutes];
}
