import { eq } from "drizzle-orm";
import { brands, categories, db, divisions, products } from "../src/db";

interface SterilaCategoryGroup {
  groupTitle: string;
  keyPrefix: string;
  items: Array<{
    productNo: string;
    size: string;
    skuOverride?: string;
  }>;
}

const STERILA_GROUPS: SterilaCategoryGroup[] = [
  {
    groupTitle: "Combination Wrench (SS304 / SS316)",
    keyPrefix: "combination-wrench",
    items: [
      { productNo: "SSJAA-6", size: "6 mm" },
      { productNo: "SSJAA-7", size: "7 mm" },
      { productNo: "SSJAA-8", size: "8 mm" },
      { productNo: "SSJAA-9", size: "9 mm" },
      { productNo: "SSJAA-10", size: "10 mm" },
      { productNo: "SSJAA-11", size: "11 mm" },
      { productNo: "SSJAA-12", size: "12 mm" },
      { productNo: "SSJAA-13", size: "13 mm" },
      { productNo: "SSJAA-14", size: "14 mm" },
      { productNo: "SSJAA-15", size: "15 mm" },
      { productNo: "SSJAA-16", size: "16 mm" },
      { productNo: "SSJAA-17", size: "17 mm" },
      { productNo: "SSJAA-18", size: "18 mm" },
      { productNo: "SSJAA-19", size: "19 mm" },
      { productNo: "SSJAA-20", size: "20 mm" },
      { productNo: "SSJAA-21", size: "21 mm" },
      { productNo: "SSJAA-22", size: "22 mm" },
      { productNo: "SSJAA-23", size: "23 mm" },
      { productNo: "SSJAA-24", size: "24 mm" },
      { productNo: "SSJAA-25", size: "25 mm" },
      { productNo: "SSJAA-26", size: "26 mm" },
      { productNo: "SSJAA-27", size: "27 mm" },
      { productNo: "SSJAA-30", size: "30 mm" },
      { productNo: "SSJAA-32", size: "32 mm" },
    ],
  },
  {
    groupTitle: "D/E Open End Wrench (SS304 / SS316)",
    keyPrefix: "de-open-wrench",
    items: [
      { productNo: "SSJBA-0607", size: "6 x 7 mm" },
      { productNo: "SSJBA-0809", size: "8 x 9 mm" },
      { productNo: "SSJBA-1011", size: "10 x 11 mm" },
      { productNo: "SSJBA-1213", size: "12 x 13 mm" },
      { productNo: "SSJBA-1415", size: "14 x 15 mm" },
      { productNo: "SSJBA-1617", size: "16 x 17 mm" },
      { productNo: "SSJBA-1819", size: "18 x 19 mm" },
      { productNo: "SSJBA-2022", size: "20 x 22 mm" },
      { productNo: "SSJBA-2123", size: "21 x 23 mm" },
      { productNo: "SSJBA-2426", size: "24 x 26 mm" },
      { productNo: "SSJBA-2427", size: "24 x 27 mm" },
      { productNo: "SSJBA-2528", size: "25 x 28 mm" },
      { productNo: "SSJBA-3032", size: "30 x 32 mm" },
    ],
  },
  {
    groupTitle: "D/E Ring Wrench (SS304 / SS316)",
    keyPrefix: "de-ring-wrench",
    items: [
      { productNo: "SSJGA-0607", size: "6 x 7 mm" },
      { productNo: "SSJGA-0809", size: "8 x 9 mm" },
      { productNo: "SSJGA-1011", size: "10 x 11 mm" },
      { productNo: "SSJGA-1213", size: "12 x 13 mm" },
      { productNo: "SSJGA-1415", size: "14 x 15 mm" },
      { productNo: "SSJGA-1617", size: "16 x 17 mm" },
      { productNo: "SSJGA-1819", size: "18 x 19 mm" },
      { productNo: "SSJGA-2022", size: "20 x 22 mm" },
      { productNo: "SSJGA-2123", size: "21 x 23 mm" },
      { productNo: "SSJGA-2426", size: "24 x 26 mm" },
      { productNo: "SSJGA-2427", size: "24 x 27 mm" },
      { productNo: "SSJGA-2528", size: "25 x 28 mm" },
      { productNo: "SSJGA-3032", size: "30 x 32 mm" },
    ],
  },
  {
    groupTitle: "Adjustable Wrench (SS304 / SS316)",
    keyPrefix: "adj-wrench",
    items: [
      { productNo: "SSKE-1004", size: "18 x 150 mm" },
      { productNo: "SSKE-1006", size: "24 x 200 mm" },
      { productNo: "SSKE-1008", size: "30 x 250 mm" },
      { productNo: "SSKE-1010", size: "36 x 300 mm" },
      { productNo: "SSKE-1012", size: "46 x 375 mm" },
      { productNo: "SSKE-1014", size: "55 x 450 mm" },
      { productNo: "SSKE-1016", size: "65 x 600 mm" },
    ],
  },
  {
    groupTitle: "Pipe Wrench (SS304 / SS316)",
    keyPrefix: "pipe-wrench",
    items: [
      { productNo: "SSKFA-1002", size: "250 mm" },
      { productNo: "SSKFA-1004", size: "300 mm" },
      { productNo: "SSKFA-1006", size: "350 mm" },
      { productNo: "SSKFA-1008", size: "450 mm" },
      { productNo: "SSKFA-1010", size: "600 mm" },
    ],
  },
  {
    groupTitle: "Allen Key (SS304 / SS316)",
    keyPrefix: "allen-key",
    items: [
      { productNo: "SSLZ-1.5", size: "1.5 mm" },
      { productNo: "SSLZ-2", size: "2 mm" },
      { productNo: "SSLZ-2.5", size: "2.5 mm" },
      { productNo: "SSLZ-3", size: "3 mm" },
      { productNo: "SSLZ-4", size: "4 mm" },
      { productNo: "SSLZ-5", size: "5 mm" },
      { productNo: "SSLZ-6", size: "6 mm" },
      { productNo: "SSLZ-7", size: "7 mm" },
      { productNo: "SSLZ-8", size: "8 mm" },
      { productNo: "SSLZ-9", size: "9 mm" },
      { productNo: "SSLZ-10", size: "10 mm" },
      { productNo: "SSLZ-12", size: "12 mm" },
      { productNo: "SSLZ-14", size: "14 mm" },
      { productNo: "SSLZ-1002", size: '1/16"' },
      { productNo: "SSLZ-1004", size: '5/64"' },
      { productNo: "SSLZ-1006", size: '3/32"' },
      { productNo: "SSLZ-1010", size: '1/8"' },
      { productNo: "SSLZ-1014", size: '5/32"' },
      { productNo: "SSLZ-1016", size: '3/16"' },
      { productNo: "SSLZ-1018", size: '7/32"' },
      { productNo: "SSLZ-1020", size: '1/4"' },
      { productNo: "SSLZ-1024", size: '5/16"' },
      { productNo: "SSLZ-1028", size: '3/8"' },
      { productNo: "SSLZ-1030", size: '7/64"' },
      { productNo: "SSLZ-1032", size: '9/64"' },
    ],
  },
  {
    groupTitle: "T-Allen Key Ball End (SS304 / SS316)",
    keyPrefix: "t-allen-key-ball-end",
    items: [
      { productNo: "SSLZA-1002", size: "3 mm" },
      { productNo: "SSLZA-1004", size: "4 mm" },
      { productNo: "SSLZA-1006", size: "5 mm" },
      { productNo: "SSLZA-1008", size: "6 mm" },
      { productNo: "SSLZA-1010", size: "7 mm" },
      { productNo: "SSLZA-1012", size: "8 mm" },
      { productNo: "SSLZA-1014", size: "9 mm" },
      { productNo: "SSLZA-1016", size: "10 mm" },
    ],
  },
  {
    groupTitle: "Phillips Screwdriver With SS Handle",
    keyPrefix: "phillips-screwdriver",
    items: [
      { productNo: "SSTC-1002", size: "3 x 50 mm" },
      { productNo: "SSTC-1004", size: "4 x 75 mm" },
      { productNo: "SSTC-1006", size: "5 x 100 mm" },
      { productNo: "SSTC-1008", size: "6 x 150 mm" },
      { productNo: "SSTC-1010", size: "8 x 200 mm" },
      { productNo: "SSTC-1012", size: "9 x 250 mm" },
      { productNo: "SSTC-1014", size: "10 x 300 mm" },
    ],
  },
  {
    groupTitle: "Slotted Screwdriver With SS Handle",
    keyPrefix: "slotted-screwdriver",
    items: [
      { productNo: "SSTD-1002", size: "50 mm" },
      { productNo: "SSTD-1004", size: "75 mm" },
      { productNo: "SSTD-1006", size: "100 mm" },
      { productNo: "SSTD-1008", size: "150 mm" },
      { productNo: "SSTD-1010", size: "200 mm" },
      { productNo: "SSTD-1012", size: "250 mm" },
      { productNo: "SSTD-1014", size: "300 mm" },
    ],
  },
  {
    groupTitle: "Combination Plier With SS Handle",
    keyPrefix: "combination-plier",
    items: [
      { productNo: "SSEA-1002", size: "150 mm" },
      { productNo: "SSEA-1006", size: "200 mm" },
    ],
  },
  {
    groupTitle: "Diagonal Cutting Plier With SS Handle",
    keyPrefix: "diagonal-cutting-plier",
    items: [
      { productNo: "SSTC-1002", size: "150 mm", skuOverride: "STR-DIAG-SSTC-1002" },
      { productNo: "SSTC-1004", size: "190 mm", skuOverride: "STR-DIAG-SSTC-1004" },
    ],
  },
  {
    groupTitle: "Mini Plier (SS304 / SS316)",
    keyPrefix: "mini-plier",
    items: [
      { productNo: "SSTC-1002", size: "150 mm", skuOverride: "STR-MINI-SSTC-1002" },
    ],
  },
  {
    groupTitle: "Long Nose Plier With SS Handle",
    keyPrefix: "long-nose-plier",
    items: [
      { productNo: "SSEB-1002", size: "165 mm" },
      { productNo: "SSEB-1006", size: "200 mm" },
    ],
  },
  {
    groupTitle: "Ball Pein Hammer With SS Handle",
    keyPrefix: "ball-pein-hammer",
    items: [
      { productNo: "SSNAA-1002", size: "230 g" },
      { productNo: "SSNAA-1006", size: "450 g" },
    ],
  },
  {
    groupTitle: "Nylon Hammer With SS Handle",
    keyPrefix: "nylon-hammer",
    items: [
      { productNo: "SSOC-1002", size: "800 g" },
      { productNo: "SSOC-1004", size: "1000 g" },
    ],
  },
];

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureSterilaBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "sterila"));
  const brandData = {
    slug: "sterila",
    name: "Sterila",
    countryOfOrigin: "India",
    sourcingType: "independent",
    sourcingNote:
      "We are not an official authorized dealer yet; we source genuine items directly against your order.",
    description:
      "Stainless steel hand tools (SS304 & SS316) engineered for critical cleanroom, pharmaceutical, food-grade, chemical, and non-magnetic applications.",
    websiteUrl: null,
    isFeatured: true,
    sortOrder: 32,
    seoTitle: "Sterila Stainless Steel Hand Tools (SS304 & SS316) | Radiant Industrial Co.",
    seoDescription:
      "Source Sterila SS304 & SS316 corrosion-resistant, non-magnetic stainless steel wrenches, Allen keys, screwdrivers, pliers, and hammers through Radiant Industrial Co.",
    isActive: true,
  };

  if (existing) {
    await db.update(brands).set(brandData).where(eq(brands.id, existing.id));
    return existing.id;
  }

  await db.insert(brands).values(brandData).onConflictDoNothing({ target: brands.slug });
  const [created] = await db.select().from(brands).where(eq(brands.slug, "sterila"));
  if (!created) {
    throw new Error("Failed to create or retrieve 'sterila' brand.");
  }
  return created.id;
}

async function main() {
  console.log(
    "Adding Sterila Stainless Steel Tools (SS304 & SS316) while keeping all existing server products..."
  );

  const brandId = await ensureSterilaBrand();

  const [industrialDiv] = await db
    .select()
    .from(divisions)
    .where(eq(divisions.slug, "industrial"));
  const [toolsCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "tools-cutting-machining"));

  if (!industrialDiv || !toolsCat) {
    throw new Error(
      "Missing 'industrial' division or 'tools-cutting-machining' category in database."
    );
  }

  const existingRows = await db
    .select({ id: products.id, sku: products.sku, slug: products.slug })
    .from(products);
  const existingBySku = new Map(existingRows.map((r) => [r.sku, r]));
  const existingBySlug = new Map(existingRows.map((r) => [r.slug, r]));
  const takenSlugs = new Set(existingRows.map((r) => r.slug));

  const toInsert: Array<typeof products.$inferInsert> = [];
  let updatedCount = 0;

  for (const group of STERILA_GROUPS) {
    for (const item of group.items) {
      const sku = item.skuOverride || `STR-${item.productNo.toUpperCase()}`;
      const slugBase = toSlug(`sterila-${group.keyPrefix}-${item.productNo}-${item.size}`);
      const name = `Sterila ${item.productNo} ${group.groupTitle} — ${item.size}`;
      const shortDescription = `${name}. Non-magnetic, corrosion-resistant SS304 & SS316 stainless steel hand tool for cleanrooms, pharma, food & critical environments.`;
      const description = [
        `${name} built for critical environments and non-magnetic applications.`,
        "",
        "Key Specifications:",
        "• Material Options: Stainless Steel SS304 & SS316 (Corrosion-Resistant & Autoclavable)",
        "• Magnetic Property: Non-Magnetic application suited for cleanrooms, MRI/electronic, pharmaceutical, food & chemical facilities",
        `• Catalog Model / Product No.: ${item.productNo}`,
        `• Size / Rating: ${item.size}`,
        "",
        "Before Ordering: Please confirm required stainless steel grade (SS304 or SS316), exact dimensions, and cleanroom/certification requirements before finalizing your order.",
      ].join("\n");

      const specificationsJson = JSON.stringify([
        { label: "Brand", value: "Sterila" },
        { label: "Product No.", value: item.productNo },
        { label: "Tool Type", value: group.groupTitle },
        { label: "Size / Capacity", value: item.size },
        { label: "Material", value: "Stainless Steel SS304 & SS316" },
        { label: "Application", value: "Critical Environments & Non-Magnetic Use" },
      ]);

      const match = existingBySku.get(sku) || existingBySlug.get(slugBase);
      if (match) {
        await db
          .update(products)
          .set({
            name,
            shortDescription,
            description,
            divisionId: industrialDiv.id,
            categoryId: toolsCat.id,
            brandId,
            pricingMode: "rfq_only",
            basePrice: null,
            priceUnit: "NOS",
            gstPercent: 18,
            moq: "1 NOS",
            leadTime: "Confirmed Upon Order",
            hsnCode: "",
            specificationsJson,
            inStockStatus: "Available to Order",
            isFeatured: false,
            isActive: true,
            seoTitle: `${name} (${sku}) | Radiant Industrial Co.`,
            seoDescription: shortDescription,
          })
          .where(eq(products.id, match.id));
        updatedCount++;
        continue;
      }

      let safeSlug = slugBase;
      if (takenSlugs.has(safeSlug)) {
        let suffix = 2;
        while (takenSlugs.has(`${slugBase}-${suffix}`)) suffix++;
        safeSlug = `${slugBase}-${suffix}`;
      }
      takenSlugs.add(safeSlug);

      toInsert.push({
        slug: safeSlug,
        sku,
        name,
        shortDescription,
        description,
        divisionId: industrialDiv.id,
        categoryId: toolsCat.id,
        brandId,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "",
        specificationsJson,
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} (${sku}) | Radiant Industrial Co.`,
        seoDescription: shortDescription,
      });
    }
  }

  const CHUNK_SIZE = 40;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(products).values(chunk);
    insertedCount += chunk.length;
  }

  const totalAfter = await db.select({ id: products.id }).from(products);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        brandId,
        existingProductsBefore: existingRows.length,
        insertedSterilaProducts: insertedCount,
        updatedSterilaProducts: updatedCount,
        totalProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Sterila Stainless Steel Tools:", err);
  process.exit(1);
});
