import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, asc, eq, like, or } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, products, brands, categories } from "@/db";
import {
  buildBrandedCatalogueHtml,
  getCatalogueScopeCount,
  type CatalogueLayout,
  type CatalogueScope,
} from "@/lib/catalogue-builder";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);

  // Quick live product picker for Individual Product Datasheet mode
  if (url.searchParams.get("searchProducts") === "1") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ items: [] });
    }
    const pattern = `%${q}%`;
    const items = await db
      .select({
        id: products.id,
        slug: products.slug,
        sku: products.sku,
        name: products.name,
        brandName: brands.name,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.isActive, true),
          or(
            like(products.sku, pattern),
            like(products.name, pattern),
            like(products.slug, pattern)
          )
        )
      )
      .orderBy(asc(products.name))
      .limit(20);

    return NextResponse.json({ items });
  }

  const rawScope = (url.searchParams.get("scope") || "brand") as CatalogueScope;
  const scope: CatalogueScope = ["master", "category", "brand", "product"].includes(rawScope)
    ? rawScope
    : "brand";
  const slug = (url.searchParams.get("slug") || "").trim() || undefined;
  const layout: CatalogueLayout =
    url.searchParams.get("layout") === "linesheet" ? "linesheet" : "cards";
  const includeImages = url.searchParams.get("images") !== "0";
  const showPrices = url.searchParams.get("prices") === "1";
  const featuredOnly = url.searchParams.get("featured") === "1";
  const preparedFor = (url.searchParams.get("preparedFor") || "").trim() || undefined;
  const limit = Number(url.searchParams.get("limit") || 0) || undefined;
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
  const isMeta = url.searchParams.get("meta") === "1";
  const isDownload = url.searchParams.get("download") === "1";
  const isAutoPrint = url.searchParams.get("print") === "1";

  if (isMeta) {
    const totalMatching = await getCatalogueScopeCount({ scope, slug, featuredOnly });
    return NextResponse.json({ scope, slug, totalMatching });
  }

  try {
    const result = await buildBrandedCatalogueHtml({
      scope,
      slug,
      layout,
      includeImages,
      showPrices,
      featuredOnly,
      limit,
      offset,
      preparedFor,
      autoPrint: isAutoPrint,
    });

    const headers: Record<string, string> = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    };
    if (isDownload) {
      headers["Content-Disposition"] = `attachment; filename="${result.filename}"`;
    }

    return new NextResponse(result.html, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate catalogue" },
      { status: 400 }
    );
  }
}
