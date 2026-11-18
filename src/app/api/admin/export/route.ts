import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { asc, desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, products, brands, categories, divisions, enquiries, pageBlocks } from "@/db";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") || "products";
  const format = url.searchParams.get("format") || "csv";
  const isTemplate = url.searchParams.get("template") === "1";

  const [allDivs, allCats, allBrands] = await Promise.all([
    db.select().from(divisions).orderBy(asc(divisions.sortOrder)),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(brands).orderBy(asc(brands.name)),
  ]);

  const divById = Object.fromEntries(allDivs.map((d) => [d.id, d]));
  const catById = Object.fromEntries(allCats.map((c) => [c.id, c]));
  const brandById = Object.fromEntries(allBrands.map((b) => [b.id, b]));

  if (entity === "all" || format === "json") {
    if (entity === "products") {
      const prods = await db.select().from(products).orderBy(asc(products.name));
      return new NextResponse(JSON.stringify({ products: prods }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="radiant-products.json"',
        },
      });
    }
    const [prods, blocks] = await Promise.all([
      db.select().from(products).orderBy(asc(products.name)),
      db.select().from(pageBlocks),
    ]);
    return new NextResponse(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          divisions: allDivs,
          categories: allCats,
          brands: allBrands,
          products: prods,
          pageBlocks: blocks,
        },
        null,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="radiant-full-catalog-backup.json"',
        },
      }
    );
  }

  if (entity === "products") {
    const headers = [
      "sku",
      "name",
      "slug",
      "shortDescription",
      "description",
      "divisionSlug",
      "categorySlug",
      "brandSlug",
      "pricingMode",
      "basePrice",
      "priceUnit",
      "gstPercent",
      "moq",
      "leadTime",
      "hsnCode",
      "inStockStatus",
      "isFeatured",
      "isActive",
      "primaryImageUrl",
      "specificationsJson",
    ];

    if (isTemplate) {
      const sampleRows = [
        [
          "RIC-SAMPLE-001",
          "SKF 6305-2RS Deep Groove Ball Bearing",
          "skf-6305-2rs-deep-groove-ball-bearing",
          "25x62x17 mm sealed deep groove bearing for electric motors and pumps.",
          "Heavy-duty rubber-sealed SKF ball bearing built for continuous industrial operation.",
          "industrial",
          "bearings-transmission",
          "skf",
          "rfq_only",
          "",
          "NOS",
          "18",
          "10 NOS",
          "2-5 Working Days",
          "84821011",
          "Available to Order",
          "false",
          "true",
          "",
          '[{"label":"Bore x OD x Width","value":"25 x 62 x 17 mm"},{"label":"Sealing","value":"2RS Rubber Seals"}]',
        ],
      ];
      return new NextResponse(toCsv(headers, sampleRows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="radiant-products-template.csv"',
        },
      });
    }

    const prods = await db.select().from(products).orderBy(asc(products.sku));
    const rows = prods.map((p) => [
      p.sku,
      p.name,
      p.slug,
      p.shortDescription,
      p.description,
      divById[p.divisionId]?.slug || "",
      catById[p.categoryId]?.slug || "",
      p.brandId ? brandById[p.brandId]?.slug || "" : "",
      p.pricingMode,
      p.basePrice ?? "",
      p.priceUnit,
      p.gstPercent,
      p.moq,
      p.leadTime,
      p.hsnCode,
      p.inStockStatus,
      String(p.isFeatured),
      String(p.isActive),
      p.primaryImageUrl || "",
      p.specificationsJson,
    ]);

    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="radiant-products.csv"',
      },
    });
  }

  if (entity === "brands") {
    const headers = [
      "slug",
      "name",
      "countryOfOrigin",
      "sourcingType",
      "sourcingNote",
      "description",
      "logoUrl",
      "thumbnailUrl",
      "websiteUrl",
      "isFeatured",
      "isActive",
    ];
    const rows = allBrands.map((b) => [
      b.slug,
      b.name,
      b.countryOfOrigin,
      b.sourcingType,
      b.sourcingNote,
      b.description,
      b.logoUrl || "",
      b.thumbnailUrl || "",
      b.websiteUrl || "",
      String(b.isFeatured),
      String(b.isActive),
    ]);
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="radiant-brands.csv"',
      },
    });
  }

  if (entity === "categories") {
    const headers = ["slug", "name", "divisionSlug", "description", "thumbnailUrl", "isActive"];
    const rows = allCats.map((c) => [
      c.slug,
      c.name,
      divById[c.divisionId]?.slug || "",
      c.description,
      c.thumbnailUrl || "",
      String(c.isActive),
    ]);
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="radiant-categories.csv"',
      },
    });
  }

  if (entity === "enquiries") {
    const enqRows = await db.select().from(enquiries).orderBy(desc(enquiries.createdAt));
    const headers = [
      "referenceNo",
      "channel",
      "customerName",
      "companyName",
      "email",
      "phone",
      "gstNumber",
      "deliveryLocation",
      "status",
      "message",
      "adminNotes",
      "createdAt",
    ];
    const rows = enqRows.map((e) => [
      e.referenceNo,
      e.channel,
      e.customerName,
      e.companyName,
      e.email,
      e.phone,
      e.gstNumber,
      e.deliveryLocation,
      e.status,
      e.message,
      e.adminNotes,
      e.createdAt,
    ]);
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="radiant-enquiries.csv"',
      },
    });
  }

  return NextResponse.json({ error: "Unsupported export entity" }, { status: 400 });
}
