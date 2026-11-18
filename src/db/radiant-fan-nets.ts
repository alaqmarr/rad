import { eq } from "drizzle-orm";
import { brands, categories, db, divisions, products } from "./index";

export interface FanNetVariantSpec {
  sku: string;
  slug: string;
  sizeLabel: string;
  inchLabel: string;
  mmLabel: string;
  moq: string;
  isFeatured: boolean;
  isCustom?: boolean;
}

const FAN_NET_VARIANTS: FanNetVariantSpec[] = [
  {
    sku: "RAD-FSN-400",
    slug: "radiant-industrial-fan-safety-net-cover-400mm-16in",
    sizeLabel: "400 mm (16 inch)",
    inchLabel: "16 inch",
    mmLabel: "400 mm",
    moq: "5 NOS",
    isFeatured: true,
  },
  {
    sku: "RAD-FSN-450",
    slug: "radiant-industrial-fan-safety-net-cover-450mm-18in",
    sizeLabel: "450 mm (18 inch)",
    inchLabel: "18 inch",
    mmLabel: "450 mm",
    moq: "5 NOS",
    isFeatured: true,
  },
  {
    sku: "RAD-FSN-600",
    slug: "radiant-industrial-fan-safety-net-cover-600mm-24in",
    sizeLabel: "600 mm (24 inch)",
    inchLabel: "24 inch",
    mmLabel: "600 mm",
    moq: "5 NOS",
    isFeatured: true,
  },
  {
    sku: "RAD-FSN-750",
    slug: "radiant-industrial-fan-safety-net-cover-750mm-30in",
    sizeLabel: "750 mm (30 inch)",
    inchLabel: "30 inch",
    mmLabel: "750 mm",
    moq: "5 NOS",
    isFeatured: true,
  },
  {
    sku: "RAD-FSN-900",
    slug: "radiant-industrial-fan-safety-net-cover-900mm-36in",
    sizeLabel: "900 mm (36 inch)",
    inchLabel: "36 inch",
    mmLabel: "900 mm",
    moq: "5 NOS",
    isFeatured: true,
  },
  {
    sku: "RAD-FSN-CUSTOM",
    slug: "radiant-industrial-fan-safety-net-cover-custom-size",
    sizeLabel: "Custom Size & Special Area Guard",
    inchLabel: "Custom",
    mmLabel: "Custom",
    moq: "As Per Requirement",
    isFeatured: false,
    isCustom: true,
  },
];

async function ensureRadiantBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "radiant"));
  const brandData = {
    slug: "radiant",
    name: "Radiant",
    countryOfOrigin: "India",
    sourcingType: "in_house",
    sourcingNote:
      "Radiant house-brand industrial safety and MRO product line supplied directly by Radiant Industrial Co.",
    description:
      "Radiant Industrial Co. house-brand industrial workplace safety covers, custom netting guards, and MRO safety solutions.",
    isFeatured: true,
    sortOrder: 0,
    seoTitle: "Radiant Industrial Products | Radiant Industrial Co.",
    seoDescription:
      "Shop Radiant house-brand industrial workplace safety gear, UV-stabilized flame-retardant HDPE fan safety net covers, and plant MRO supplies.",
    isActive: true,
  };

  if (existing) {
    await db.update(brands).set(brandData).where(eq(brands.id, existing.id));
    return existing.id;
  }

  await db.insert(brands).values(brandData).onConflictDoNothing({ target: brands.slug });
  const [created] = await db.select().from(brands).where(eq(brands.slug, "radiant"));
  if (!created) {
    throw new Error("Failed to create or retrieve 'radiant' brand.");
  }
  return created.id;
}

export async function loadRadiantFanNetProducts(): Promise<{
  brandId: number;
  insertedCount: number;
  updatedCount: number;
  totalProductsAfter: number;
}> {
  const brandId = await ensureRadiantBrand();

  const [industrialDiv] = await db
    .select()
    .from(divisions)
    .where(eq(divisions.slug, "industrial"));
  const [safetyCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "safety-ppe"));

  if (!industrialDiv || !safetyCat) {
    throw new Error(
      "Missing 'industrial' division or 'safety-ppe' category in database. Run seed or check categories."
    );
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of FAN_NET_VARIANTS) {
    const title = item.isCustom
      ? "Radiant Custom Industrial Fan Safety Net Cover (Made-to-Spec)"
      : `Radiant Industrial Fan Safety Net Cover — ${item.sizeLabel}`;

    const shortDescription = item.isCustom
      ? "Custom-tailored UV-stabilized & flame-retardant 12 mm hexagonal Virgin HDPE safety mesh cover (1.50 mm thick, Velcro base) for industrial fans and special plant areas."
      : `100% finger-cut protection for ${item.sizeLabel} industrial fans. 12 mm hexagonal Virgin HDPE mesh, 1.50 mm thick, UV-stabilized & flame-retardant with Velcro closure (Natural White / Green / Black).`;

    const description = [
      `${title} provides full 360-degree finger-cut protection around running industrial, pedestal, wall-mounted, and workplace air circulator fans while maintaining free air circulation.`,
      "",
      "Key Features & Construction:",
      "• Material: High Quality Virgin Grade HDPE — UV Stabilized & Flame Retardant",
      "• Mesh Size & Structure: 12 mm Hexagonal aperture prevents finger entry from all sides",
      "• Thickness: 1.50 mm durable, flexible, non-corrosive polymer mesh (no painting required)",
      "• Border & Closure: Strong PVC border with double stitching, tailored cut-match at fan arm position, and easy-to-install/remove Velcro base",
      "• Colors Available: Natural White, Green, and Black",
      "• Service Life & Care: 5-year shelf life, lightweight, easy to clean and wash, zero maintenance",
      item.isCustom
        ? "• Custom Sizing: Manufactured to drawing/nameplate measurements for specialized fan cages and hazardous workplace areas"
        : `• Target Fan Size: ${item.mmLabel} (${item.inchLabel}) industrial air circulators and heavy-duty pedestal/wall fans`,
      "",
      "Important: Before ordering, please verify the exact fan blade/guard diameter from your fan nameplate, arm mounting configuration, and preferred net color (Natural White, Green, or Black) with our team.",
    ].join("\n");

    const specificationsJson = JSON.stringify([
      { label: "Brand", value: "Radiant" },
      { label: "Fan Cover Size", value: item.sizeLabel },
      { label: "Material", value: "High Quality Virgin Grade HDPE" },
      { label: "Safety Rating / Feature", value: "UV Stabilized + Flame Retardant" },
      { label: "Mesh Size / Structure", value: "12 mm Hexagonal" },
      { label: "Mesh Thickness", value: "1.50 mm" },
      { label: "Closure & Border", value: "Velcro Base with Double-Stitched PVC Border" },
      { label: "Color Options", value: "Natural White / Green / Black" },
      { label: "Shelf / Service Life", value: "5 Years" },
      { label: "Protection", value: "100% Finger-Cut Protection, Free Air Flow, Washable" },
      { label: "Origin", value: "Made in India" },
    ]);

    const record = {
      slug: item.slug,
      sku: item.sku,
      name: title,
      shortDescription,
      description,
      divisionId: industrialDiv.id,
      categoryId: safetyCat.id,
      brandId,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: item.moq,
      leadTime: item.isCustom ? "5–10 Working Days" : "3–5 Working Days",
      hsnCode: "",
      specificationsJson,
      inStockStatus: item.isCustom ? "Made to Order" : "Available to Order",
      isFeatured: item.isFeatured,
      isActive: true,
      seoTitle: `${title} (${item.sku}) | Radiant Industrial Co.`,
      seoDescription: shortDescription,
    };

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, item.sku));

    if (existing) {
      await db.update(products).set(record).where(eq(products.id, existing.id));
      updatedCount++;
    } else {
      await db.insert(products).values(record);
      insertedCount++;
    }
  }

  const totalRows = await db.select({ id: products.id }).from(products);

  return {
    brandId,
    insertedCount,
    updatedCount,
    totalProductsAfter: totalRows.length,
  };
}
