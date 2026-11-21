import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, ensureDbReady, divisions, categories, brands, products } from "../src/db";

const TARGET_BRAND_SLUGS = [
  "3m-industrial",
  "dowty",
  "dowsil",
  "esab",
  "falcon-agri",
  "fevibond",
  "fevicol",
  "feviseal",
  "honeywell-safety",
  "jain-irrigation",
  "kirloskar",
  "lt-switchgear",
  "lt-valves",
  "netafim",
  "ntn",
  "unbrako",
];

interface ExportBundle {
  generatedAt: string;
  divisions: Array<{
    slug: string;
    name: string;
    tagline: string;
    description: string;
    heroImageUrl: string | null;
    sortOrder: number;
    seoTitle: string;
    seoDescription: string;
  }>;
  categories: Array<{
    slug: string;
    name: string;
    description: string;
    thumbnailUrl: string | null;
    divisionSlug: string;
    sortOrder: number;
  }>;
  brands: Array<{
    slug: string;
    name: string;
    logoUrl: string | null;
    thumbnailUrl: string | null;
    countryOfOrigin: string;
    sourcingType: string;
    sourcingNote: string;
    description: string;
    websiteUrl: string | null;
    isFeatured: boolean;
    sortOrder: number;
    seoTitle: string;
    seoDescription: string;
  }>;
  products: Array<{
    slug: string;
    sku: string;
    name: string;
    shortDescription: string;
    description: string;
    divisionSlug: string;
    categorySlug: string;
    brandSlug: string;
    pricingMode: string;
    basePrice: number | null;
    priceUnit: string;
    gstPercent: number;
    moq: string;
    leadTime: string;
    hsnCode: string;
    specificationsJson: string;
    primaryImageUrl: string | null;
    galleryJson: string;
    inStockStatus: string;
    isFeatured: boolean;
    seoTitle: string;
    seoDescription: string;
  }>;
}

async function exportBundle(outPath: string) {
  await ensureDbReady();

  const allDivs = await db.select().from(divisions).where(eq(divisions.isActive, true));
  const divById = new Map(allDivs.map((d) => [d.id, d]));

  const allCats = await db.select().from(categories).where(eq(categories.isActive, true));
  const catById = new Map(allCats.map((c) => [c.id, c]));

  const targetBrands = await db
    .select()
    .from(brands)
    .where(and(inArray(brands.slug, TARGET_BRAND_SLUGS), eq(brands.isActive, true)));
  const brandById = new Map(targetBrands.map((b) => [b.id, b]));
  const brandIds = targetBrands.map((b) => b.id);

  const targetProducts = brandIds.length
    ? await db
        .select()
        .from(products)
        .where(and(inArray(products.brandId, brandIds), eq(products.isActive, true)))
    : [];

  const bundle: ExportBundle = {
    generatedAt: new Date().toISOString(),
    divisions: allDivs.map((d) => ({
      slug: d.slug,
      name: d.name,
      tagline: d.tagline,
      description: d.description,
      heroImageUrl: d.heroImageUrl,
      sortOrder: d.sortOrder,
      seoTitle: d.seoTitle,
      seoDescription: d.seoDescription,
    })),
    categories: allCats.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      divisionSlug: divById.get(c.divisionId)?.slug || "industrial",
      sortOrder: c.sortOrder,
    })),
    brands: targetBrands.map((b) => ({
      slug: b.slug,
      name: b.name,
      logoUrl: b.logoUrl,
      thumbnailUrl: b.thumbnailUrl,
      countryOfOrigin: b.countryOfOrigin,
      sourcingType: b.sourcingType,
      sourcingNote: b.sourcingNote,
      description: b.description,
      websiteUrl: b.websiteUrl,
      isFeatured: b.isFeatured,
      sortOrder: b.sortOrder,
      seoTitle: b.seoTitle,
      seoDescription: b.seoDescription,
    })),
    products: targetProducts
      .map((p) => {
        const div = divById.get(p.divisionId);
        const cat = catById.get(p.categoryId);
        const br = p.brandId ? brandById.get(p.brandId) : undefined;
        if (!div || !cat || !br) return null;
        return {
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          shortDescription: p.shortDescription,
          description: p.description,
          divisionSlug: div.slug,
          categorySlug: cat.slug,
          brandSlug: br.slug,
          pricingMode: p.pricingMode,
          basePrice: p.basePrice,
          priceUnit: p.priceUnit,
          gstPercent: p.gstPercent,
          moq: p.moq,
          leadTime: p.leadTime,
          hsnCode: p.hsnCode,
          specificationsJson: p.specificationsJson,
          primaryImageUrl: p.primaryImageUrl,
          galleryJson: p.galleryJson,
          inStockStatus: p.inStockStatus,
          isFeatured: p.isFeatured,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), "utf8"), { level: 9 });
  fs.writeFileSync(outPath, gz);
  console.log(
    `Exported ${bundle.brands.length} brands and ${bundle.products.length} products to ${outPath} (${(
      gz.length / 1024
    ).toFixed(1)} KB gzipped).`
  );
}

async function importBundle(inPath: string) {
  await ensureDbReady();
  if (!fs.existsSync(inPath)) {
    throw new Error(`Bundle not found: ${inPath}`);
  }
  const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(inPath)).toString("utf8")) as ExportBundle;

  // 1. Ensure divisions
  const divIdBySlug = new Map<string, number>();
  for (const d of bundle.divisions) {
    await db
      .insert(divisions)
      .values({ ...d, isActive: true })
      .onConflictDoNothing({ target: divisions.slug });
    const [row] = await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.slug, d.slug)).limit(1);
    if (row) divIdBySlug.set(d.slug, row.id);
  }

  // 2. Ensure categories
  const catIdBySlug = new Map<string, { id: number; divisionId: number }>();
  for (const c of bundle.categories) {
    const divId = divIdBySlug.get(c.divisionSlug) || Array.from(divIdBySlug.values())[0];
    if (!divId) continue;
    await db
      .insert(categories)
      .values({
        slug: c.slug,
        name: c.name,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        divisionId: divId,
        sortOrder: c.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing({ target: categories.slug });
    const [row] = await db
      .select({ id: categories.id, divisionId: categories.divisionId })
      .from(categories)
      .where(eq(categories.slug, c.slug))
      .limit(1);
    if (row) catIdBySlug.set(c.slug, row);
  }

  // 3. Ensure brands
  const brandIdBySlug = new Map<string, number>();
  for (const b of bundle.brands) {
    await db
      .insert(brands)
      .values({ ...b, isActive: true })
      .onConflictDoNothing({ target: brands.slug });
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, b.slug)).limit(1);
    if (row) brandIdBySlug.set(b.slug, row.id);
  }

  // 4. Insert missing products cleanly (never overwrites existing products)
  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  for (const p of bundle.products) {
    if (existingSkus.has(p.sku)) continue;
    const cat = catIdBySlug.get(p.categorySlug);
    const brId = brandIdBySlug.get(p.brandSlug);
    if (!cat || !brId) continue;

    let slug = p.slug;
    if (existingSlugs.has(slug)) {
      let sfx = 2;
      while (existingSlugs.has(`${slug}-${sfx}`)) sfx++;
      slug = `${slug}-${sfx}`;
    }
    existingSkus.add(p.sku);
    existingSlugs.add(slug);

    toInsert.push({
      slug,
      sku: p.sku,
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      divisionId: cat.divisionId,
      categoryId: cat.id,
      brandId: brId,
      pricingMode: p.pricingMode || "rfq_only",
      basePrice: p.basePrice,
      priceUnit: p.priceUnit || "NOS",
      gstPercent: p.gstPercent ?? 18,
      moq: p.moq || "1 NOS",
      leadTime: "Confirmed Upon Order",
      hsnCode: p.hsnCode || "",
      specificationsJson: p.specificationsJson || "[]",
      primaryImageUrl: p.primaryImageUrl,
      galleryJson: p.galleryJson || "[]",
      inStockStatus: p.inStockStatus || "Available to Order",
      isFeatured: Boolean(p.isFeatured),
      isActive: true,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    });
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }

  try {
    await db.run(sql`INSERT INTO products_fts(products_fts) VALUES('rebuild')`);
  } catch {
    // non-fatal if FTS absent
  }

  console.log(
    `Imported ${toInsert.length} missing products across ${bundle.brands.length} supplemental brands (skipped ${
      bundle.products.length - toInsert.length
    } already present).`
  );
}

const args = new Set(process.argv.slice(2));
const bundlePath = path.resolve(process.cwd(), "scripts/data/catalog-supplement.json.gz");

if (args.has("--export")) {
  exportBundle(bundlePath)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  importBundle(bundlePath)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
