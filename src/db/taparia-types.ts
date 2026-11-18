import type { SpecRow } from "./schema";

export interface TapariaItemInput {
  /** Exact Taparia Product No. from the catalog */
  code: string;
  /** Unique SKU override if same Product No. has multiple size rows (e.g. DEP, DER, 18) */
  skuSuffix?: string;
  /** Human-readable variant summary appended to product title */
  variant?: string;
  /** Base price in INR (used internally for Admin; public storefront hides prices unless enabled) */
  price: number;
  /** Unit label: NOS, SET, KIT, PAIR */
  unit?: string;
  /** Std. Pkg. quantity or description */
  stdPkg?: string;
  /** Structured technical specs for this row */
  specs?: SpecRow[];
  /** Optional featured flag */
  featured?: boolean;
}

export interface TapariaSectionDef {
  sectionTitle: string;
  categorySlug: string;
  divisionSlug?: "industrial" | "special-items" | "agricultural" | "general";
  hsnCode: string;
  standardNote?: string;
  designNo?: string;
  summaryTemplate?: string;
  items: TapariaItemInput[];
}

export interface BuiltProductRecord {
  slug: string;
  sku: string;
  name: string;
  shortDescription: string;
  description: string;
  divisionId: number;
  categoryId: number;
  brandId: number | null;
  pricingMode: "priced" | "rfq_only";
  basePrice: number | null;
  priceUnit: string;
  gstPercent: number;
  moq: string;
  leadTime: string;
  hsnCode: string;
  specificationsJson: string;
  inStockStatus: string;
  isFeatured: boolean;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
}

function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSkuCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\//g, "-")
    .replace(/[^A-Z0-9.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildTapariaProducts(
  sections: TapariaSectionDef[],
  lookups: {
    divisionBySlug: Record<string, number>;
    categoryBySlug: Record<string, { id: number; divisionId: number }>;
    tapariaBrandId: number | null;
  }
): BuiltProductRecord[] {
  const seenSkus = new Set<string>();
  const seenSlugs = new Set<string>();
  const out: BuiltProductRecord[] = [];

  for (const sec of sections) {
    const cat = lookups.categoryBySlug[sec.categorySlug] || lookups.categoryBySlug["tools-cutting-machining"];
    const divId =
      (sec.divisionSlug ? lookups.divisionBySlug[sec.divisionSlug] : undefined) ||
      cat?.divisionId ||
      1;
    const catId = cat?.id || 1;

    for (const item of sec.items) {
      const baseSku = `TAP-${toSkuCode(item.code)}${item.skuSuffix ? `-${toSkuCode(item.skuSuffix)}` : ""}`;
      let sku = baseSku;
      let counter = 2;
      while (seenSkus.has(sku)) {
        sku = `${baseSku}-${counter++}`;
      }
      seenSkus.add(sku);

      const titleSuffix = item.variant ? ` (${item.variant})` : "";
      const fullName = `Taparia ${item.code} ${sec.sectionTitle}${titleSuffix}`.replace(/\s+/g, " ").trim();

      const baseSlug = toSlug(fullName);
      let slug = baseSlug;
      let slugCounter = 2;
      while (seenSlugs.has(slug)) {
        slug = `${baseSlug}-${slugCounter++}`;
      }
      seenSlugs.add(slug);

      const unit = item.unit || "NOS";
      const stdPkg = item.stdPkg || "1";
      const moq = /^\d+$/.test(stdPkg) ? `${stdPkg} ${unit}` : stdPkg;

      const specs: SpecRow[] = [
        { label: "Brand / Make", value: "Taparia Tools Ltd." },
        { label: "Product No.", value: item.code },
        ...(sec.standardNote ? [{ label: "Standard", value: sec.standardNote }] : []),
        ...(sec.designNo ? [{ label: "Design No.", value: sec.designNo }] : []),
        { label: "Std. Pkg.", value: stdPkg },
        { label: "HSN Code", value: sec.hsnCode },
        ...(item.specs || []),
      ];

      const specHighlight = (item.specs || [])
        .slice(0, 3)
        .map((s) => `${s.label}: ${s.value}`)
        .join(", ");

      const shortDescription = [
        `Genuine Taparia ${item.code} ${sec.sectionTitle}`,
        item.variant ? `— ${item.variant}` : "",
        specHighlight ? `(${specHighlight})` : "",
        `HSN ${sec.hsnCode}.`,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const description = [
        `${fullName} for industrial maintenance, workshop, construction, and field applications.`,
        sec.summaryTemplate || "",
        sec.standardNote ? `Standard compliance: ${sec.standardNote}.` : "",
        specHighlight ? `Key specs: ${specHighlight}.` : "",
        `Standard packing: ${stdPkg}. Please confirm exact model, size, and technical specifications with our team before placing your order.`,
      ]
        .filter(Boolean)
        .join(" ");

      out.push({
        slug,
        sku,
        name: fullName,
        shortDescription,
        description,
        divisionId: divId,
        categoryId: catId,
        brandId: lookups.tapariaBrandId,
        pricingMode: "priced",
        basePrice: item.price,
        priceUnit: unit,
        gstPercent: 18,
        moq,
        leadTime: "3–7 Working Days",
        hsnCode: sec.hsnCode,
        specificationsJson: JSON.stringify(specs),
        inStockStatus: "Available to Order",
        isFeatured: Boolean(item.featured),
        isActive: true,
        seoTitle: `${fullName} | Taparia Wholesale Supplier India`,
        seoDescription: shortDescription,
      });
    }
  }

  return out;
}
