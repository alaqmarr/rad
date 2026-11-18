import type { MetadataRoute } from "next";
import { getActiveBrands, getActiveDivisions, queryProducts } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, divisions, brands, items] = await Promise.all([
    getSiteSettings(),
    getActiveDivisions(),
    getActiveBrands(),
    queryProducts({ limit: 500 }),
  ]);

  const baseUrl = (settings["site_url"] || "https://radiantindustrial.in").replace(/\/+$/, "");

  const staticRoutes = ["", "/products", "/brands", "/documents", "/about", "/contact"].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1.0 : 0.8,
    })
  );

  const divisionRoutes = divisions.map((d) => ({
    url: `${baseUrl}/divisions/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  const brandRoutes = brands.map((b) => ({
    url: `${baseUrl}/brands/${b.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const productRoutes = items.map((row) => ({
    url: `${baseUrl}/products/${row.product.slug}`,
    lastModified: new Date(row.product.updatedAt || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...divisionRoutes, ...brandRoutes, ...productRoutes];
}
