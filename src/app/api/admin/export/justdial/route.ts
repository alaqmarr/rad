import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, products, brands, categories } from "@/db";
import { getSiteSettings } from "@/lib/settings";
import { getDetectedSiteOrigin } from "@/lib/seo";
import {
  JUSTDIAL_HEADERS,
  buildJustdialRow,
  buildJustdialSampleCsv,
  serializeJustdialCsv,
} from "@/lib/justdial-export";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const isTemplate = url.searchParams.get("template") === "1";
  const isPreview = url.searchParams.get("preview") === "1";
  const brandSlug = (url.searchParams.get("brand") || "").trim();
  const categorySlug = (url.searchParams.get("category") || "").trim();
  const pricedOnly = url.searchParams.get("pricedOnly") === "1";
  const withImagesOnly = url.searchParams.get("withImagesOnly") === "1";
  const categoryOverride = (url.searchParams.get("categoryOverride") || "").trim();
  const defaultPrice = (url.searchParams.get("defaultPrice") || "").trim();
  const importerNameOverride = (url.searchParams.get("importerName") || "").trim();
  const importerContactOverride = (url.searchParams.get("importerContact") || "").trim();
  const manufacturerContactOverride = (url.searchParams.get("manufacturerContact") || "").trim();
  const forceImporterForAll = url.searchParams.get("forceImporter") === "1";
  const limitParam = Number(url.searchParams.get("limit") || 0) || 0;
  const offsetParam = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  const [settings] = await Promise.all([getSiteSettings()]);
  const origin = await getDetectedSiteOrigin(settings);
  const companyName = settings["company_name"] || "Radiant Industrial Co.";
  const companyContact = [
    settings["contact_address"] ||
      "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India",
    settings["contact_phone"] || "",
    settings["contact_email"] || "",
  ]
    .filter(Boolean)
    .join(" | ");

  const exportOpts = {
    origin,
    companyName,
    companyContact,
    categoryOverride,
    defaultPrice,
    importerNameOverride,
    importerContactOverride,
    manufacturerContactOverride,
    forceImporterForAll,
  };

  if (isTemplate) {
    return new NextResponse(buildJustdialSampleCsv(exportOpts), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="justdial-sample-template.csv"',
      },
    });
  }

  const conditions = [eq(products.isActive, true)];
  if (pricedOnly) {
    conditions.push(eq(products.pricingMode, "priced"));
    conditions.push(isNotNull(products.basePrice));
  }
  if (withImagesOnly) {
    conditions.push(isNotNull(products.primaryImageUrl));
    conditions.push(ne(products.primaryImageUrl, ""));
  }

  if (brandSlug) {
    const [b] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, brandSlug))
      .limit(1);
    if (!b) {
      return NextResponse.json({ error: `Unknown brand: ${brandSlug}` }, { status: 404 });
    }
    conditions.push(eq(products.brandId, b.id));
  }

  if (categorySlug) {
    const [c] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, categorySlug))
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: `Unknown category: ${categorySlug}` }, { status: 404 });
    }
    conditions.push(eq(products.categoryId, c.id));
  }

  const baseQuery = db
    .select({
      product: {
        sku: products.sku,
        name: products.name,
        shortDescription: products.shortDescription,
        description: products.description,
        pricingMode: products.pricingMode,
        basePrice: products.basePrice,
        priceUnit: products.priceUnit,
        moq: products.moq,
        hsnCode: products.hsnCode,
        specificationsJson: products.specificationsJson,
        primaryImageUrl: products.primaryImageUrl,
        galleryJson: products.galleryJson,
      },
      categoryName: categories.name,
      brand: {
        slug: brands.slug,
        name: brands.name,
        countryOfOrigin: brands.countryOfOrigin,
        websiteUrl: brands.websiteUrl,
      },
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(and(...conditions))
    .orderBy(desc(products.isFeatured), asc(products.sku));

  const rowsRaw =
    isPreview
      ? await baseQuery.limit(5).offset(0)
      : limitParam > 0
      ? await baseQuery.limit(limitParam).offset(offsetParam)
      : await baseQuery;

  if (isPreview) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions));
    const sampleRows = rowsRaw.map((r) => buildJustdialRow(r, exportOpts));
    return NextResponse.json({
      totalMatched: Number(countRow?.count || 0),
      headers: JUSTDIAL_HEADERS,
      sampleRows,
    });
  }

  const csvRows = rowsRaw.map((r) => buildJustdialRow(r, exportOpts));
  const csvBody = serializeJustdialCsv(csvRows);

  const fileParts = ["justdial-catalog"];
  if (brandSlug) fileParts.push(brandSlug);
  if (categorySlug) fileParts.push(categorySlug);
  if (limitParam > 0) {
    const partNo = Math.floor(offsetParam / limitParam) + 1;
    fileParts.push(`part-${partNo}`);
  }
  const filename = `${fileParts.join("-")}.csv`;

  return new NextResponse(csvBody, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
