import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, products, brands, categories, divisions } from "@/db";
import { parseCsv, slugifyText } from "@/lib/csv";

function toBool(val: string | undefined, fallback = true): boolean {
  if (!val) return fallback;
  const v = val.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const entity = String(formData.get("entity") || "products");
    const file = formData.get("file");
    const rawText = formData.get("rawText");

    let text = "";
    let fileName = "";
    if (file instanceof File) {
      text = await file.text();
      fileName = file.name.toLowerCase();
    } else if (typeof rawText === "string") {
      text = rawText;
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "No CSV or JSON content provided." }, { status: 400 });
    }

    const isJson = fileName.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[");

    const [allDivs, allCats, allBrands] = await Promise.all([
      db.select().from(divisions),
      db.select().from(categories),
      db.select().from(brands),
    ]);

    const divBySlug = new Map(allDivs.map((d) => [d.slug, d.id]));
    const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));
    const brandBySlug = new Map(allBrands.map((b) => [b.slug, b.id]));
    const defaultDivId = allDivs[0]?.id || 1;
    const defaultCatId = allCats[0]?.id || 1;

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    let rows: Array<Record<string, string>> = [];
    if (isJson) {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed[entity] || parsed.products || parsed.brands || parsed.categories || [];
      if (!Array.isArray(list)) {
        return NextResponse.json({ error: "Invalid JSON array structure." }, { status: 400 });
      }
      rows = list.map((item) =>
        Object.fromEntries(
          Object.entries(item as Record<string, unknown>).map(([k, v]) => [
            k,
            v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v),
          ])
        )
      );
    } else {
      const parsed = parseCsv(text);
      rows = parsed.rows;
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in file." }, { status: 400 });
    }

    if (entity === "brands") {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = (r.name || "").trim();
        if (!name) {
          errors.push(`Row ${i + 1}: Missing brand name.`);
          continue;
        }
        const slug = (r.slug || "").trim() || slugifyText(name);
        const existing = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug)).limit(1);

        const payload = {
          name,
          slug,
          countryOfOrigin: r.countryOfOrigin || "India",
          sourcingType: r.sourcingType === "authorized" ? "authorized" : "independent",
          sourcingNote:
            r.sourcingNote ||
            "We are not an official authorized dealer yet; we source genuine items directly against your order.",
          description: r.description || "",
          logoUrl: r.logoUrl || null,
          thumbnailUrl: r.thumbnailUrl || null,
          websiteUrl: r.websiteUrl || null,
          isFeatured: toBool(r.isFeatured, false),
          isActive: toBool(r.isActive, true),
        };

        if (existing.length > 0) {
          await db.update(brands).set(payload).where(eq(brands.id, existing[0].id));
          updated++;
        } else {
          await db.insert(brands).values({
            ...payload,
            seoTitle: `${name} | Radiant Industrial Co.`,
            seoDescription: payload.description,
          });
          inserted++;
        }
      }
    } else if (entity === "categories") {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = (r.name || "").trim();
        if (!name) {
          errors.push(`Row ${i + 1}: Missing category name.`);
          continue;
        }
        const slug = (r.slug || "").trim() || slugifyText(name);
        const divisionId = divBySlug.get((r.divisionSlug || "").trim()) || defaultDivId;
        const existing = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, slug))
          .limit(1);

        const payload = {
          name,
          slug,
          divisionId,
          description: r.description || "",
          thumbnailUrl: r.thumbnailUrl || null,
          isActive: toBool(r.isActive, true),
        };

        if (existing.length > 0) {
          await db.update(categories).set(payload).where(eq(categories.id, existing[0].id));
          updated++;
        } else {
          await db.insert(categories).values(payload);
          inserted++;
        }
      }
    } else if (entity === "products") {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = (r.name || "").trim();
        const sku = (r.sku || "").trim();
        if (!name || !sku) {
          errors.push(`Row ${i + 1}: Both "sku" and "name" are required.`);
          continue;
        }

        const slug = (r.slug || "").trim() || slugifyText(`${name}-${sku}`);
        const divisionId =
          (r.divisionId ? Number(r.divisionId) : undefined) ||
          divBySlug.get((r.divisionSlug || "").trim()) ||
          defaultDivId;
        const categoryId =
          (r.categoryId ? Number(r.categoryId) : undefined) ||
          catBySlug.get((r.categorySlug || "").trim()) ||
          defaultCatId;
        const brandId =
          (r.brandId ? Number(r.brandId) : undefined) ||
          brandBySlug.get((r.brandSlug || "").trim()) ||
          null;

        const basePriceNum = r.basePrice ? Number(r.basePrice) : null;
        const pricingMode =
          r.pricingMode === "priced" || (basePriceNum !== null && !Number.isNaN(basePriceNum) && basePriceNum > 0)
            ? r.pricingMode === "rfq_only"
              ? "rfq_only"
              : "priced"
            : "rfq_only";

        const existingBySku = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.sku, sku))
          .limit(1);

        const payload = {
          sku,
          name,
          slug,
          shortDescription: r.shortDescription || name,
          description: r.description || r.shortDescription || name,
          divisionId,
          categoryId,
          brandId,
          pricingMode,
          basePrice: pricingMode === "priced" && basePriceNum !== null && !Number.isNaN(basePriceNum) ? basePriceNum : null,
          priceUnit: r.priceUnit || "NOS",
          gstPercent: r.gstPercent ? Number(r.gstPercent) || 18 : 18,
          moq: r.moq || "1 NOS",
          leadTime: r.leadTime || "Confirmed Upon Order",
          hsnCode: r.hsnCode || "",
          inStockStatus: r.inStockStatus || "Available to Order",
          isFeatured: toBool(r.isFeatured, false),
          isActive: toBool(r.isActive, true),
          primaryImageUrl: r.primaryImageUrl || null,
          specificationsJson: r.specificationsJson || "[]",
          seoTitle: `${name} (${sku}) | Radiant Industrial Co.`,
          seoDescription: r.shortDescription || name,
          updatedAt: new Date().toISOString(),
        };

        if (existingBySku.length > 0) {
          await db.update(products).set(payload).where(eq(products.id, existingBySku[0].id));
          updated++;
        } else {
          await db.insert(products).values(payload);
          inserted++;
        }
      }
    } else {
      return NextResponse.json({ error: "Unsupported import entity." }, { status: 400 });
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/brands");
    revalidatePath("/admin/products");
    revalidatePath("/admin/brands");

    return NextResponse.json({ success: true, inserted, updated, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
