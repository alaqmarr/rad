import { buildAbsoluteUrl } from "@/lib/seo";
import { toCsv } from "@/lib/csv";
import { htmlToCleanText } from "@/lib/sanitize-text";
import { parseSpecsJson } from "@/lib/product-enrichment";

export const JUSTDIAL_HEADERS: string[] = [
  "JDSN",
  "Product Name*",
  "Product Category",
  "Price",
  "Min Order Quantity",
  "Seller SKU ID",
  "Barcode / EAN",
  "Product Description",
  "Units (e.g. Kg, Litres, Pieces)",
  "Country of Origin",
  "Importer's Name",
  "Importer's Address / Contact Details",
  "Manufacturer's Name",
  "Manufacturer's Address / Contact Details",
  "Primary Image Link",
  "Additional Image Link",
];

export interface JustdialExportOptions {
  origin: string;
  companyName: string;
  companyContact: string;
  categoryOverride?: string;
  defaultPrice?: string;
  importerNameOverride?: string;
  importerContactOverride?: string;
  manufacturerContactOverride?: string;
  forceImporterForAll?: boolean;
}

const UNIT_MAP: Record<string, string> = {
  NOS: "Pieces",
  NO: "Pieces",
  PCS: "Pieces",
  PC: "Pieces",
  PIECE: "Pieces",
  PIECES: "Pieces",
  UNIT: "Pieces",
  UNITS: "Pieces",
  EA: "Pieces",
  EACH: "Pieces",
  KG: "Kg",
  KGS: "Kg",
  G: "Grams",
  GM: "Grams",
  L: "Litres",
  LTR: "Litres",
  LTRS: "Litres",
  LITRE: "Litres",
  LITRES: "Litres",
  ML: "ml",
  M: "Metres",
  MTR: "Metres",
  MTRS: "Metres",
  METER: "Metres",
  METERS: "Metres",
  SET: "Sets",
  SETS: "Sets",
  BOX: "Box",
  BOXES: "Box",
  PAIR: "Pair",
  PAIRS: "Pair",
  PACK: "Packs",
  PKT: "Packs",
  ROLL: "Rolls",
  ROLLS: "Rolls",
  TIN: "Tins",
  DRUM: "Drums",
};

const HOUSE_BRAND_SLUGS = new Set(["radiant", "siddhi", "sterila"]);

export function mapJustdialUnit(rawUnit: string | null | undefined): string {
  const key = (rawUnit || "").trim().toUpperCase();
  if (!key) return "Pieces";
  return UNIT_MAP[key] || rawUnit!.trim();
}

export function parseJustdialMoq(moq: string | null | undefined): string {
  const m = (moq || "").match(/\d+/);
  return m ? m[0] : "1";
}

export function cleanCountryOfOrigin(rawCountry: string | null | undefined): string {
  const cleaned = (rawCountry || "India")
    .split("/")[0]
    .replace(/\([^)]*\)/g, "")
    .trim();
  return cleaned || "India";
}

function cleanSingleLine(val: string | null | undefined): string {
  return (val || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function safeParseGallery(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function buildJustdialRow(
  row: {
    product: {
      sku: string;
      name: string;
      shortDescription: string;
      description: string;
      pricingMode: string;
      basePrice: number | null;
      priceUnit: string;
      moq: string;
      hsnCode: string;
      specificationsJson: string;
      primaryImageUrl: string | null;
      galleryJson: string;
    };
    categoryName: string | null;
    brand: {
      slug: string;
      name: string;
      countryOfOrigin: string;
      websiteUrl: string | null;
    } | null;
  },
  opts: JustdialExportOptions
): string[] {
  const { product, categoryName, brand } = row;
  const cleanName = cleanSingleLine(htmlToCleanText(product.name, true) || product.name);
  const catLabel = cleanSingleLine(opts.categoryOverride || categoryName || "Industrial Supplies");

  const resolvedPrice =
    product.pricingMode === "priced" && product.basePrice != null && Number(product.basePrice) > 0
      ? String(product.basePrice)
      : (opts.defaultPrice || "").trim();

  const specs = parseSpecsJson(product.specificationsJson);
  const barcode =
    specs.find((s) => /^(barcode|ean|upc|gtin)$/i.test(s.label.trim()))?.value.trim() || "";

  const cleanShort = cleanSingleLine(htmlToCleanText(product.shortDescription, true));
  const cleanFull = cleanSingleLine(htmlToCleanText(product.description, true));
  const baseDesc = cleanFull || cleanShort || cleanName;
  const specSummary = specs
    .slice(0, 4)
    .map((s) => `${s.label}: ${s.value}`)
    .join(" | ");
  const hsnNote = product.hsnCode ? `HSN: ${product.hsnCode}` : "";
  const description = [baseDesc, specSummary, hsnNote]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 1500);

  const country = cleanCountryOfOrigin(brand?.countryOfOrigin);
  const isImported = country.toLowerCase() !== "india";

  const importerName =
    isImported || opts.forceImporterForAll
      ? cleanSingleLine(opts.importerNameOverride || opts.companyName)
      : "";
  const importerContact =
    isImported || opts.forceImporterForAll
      ? cleanSingleLine(opts.importerContactOverride || opts.companyContact)
      : "";

  const manufacturerName = cleanSingleLine(brand?.name || opts.companyName);
  const isHouseBrand = brand ? HOUSE_BRAND_SLUGS.has(brand.slug) : true;
  const manufacturerContact = cleanSingleLine(
    opts.manufacturerContactOverride ||
      (isHouseBrand
        ? opts.companyContact
        : [brand?.name, country, brand?.websiteUrl].filter(Boolean).join(", "))
  );

  const primaryImg = product.primaryImageUrl
    ? buildAbsoluteUrl(opts.origin, product.primaryImageUrl)
    : "";
  const gallery = safeParseGallery(product.galleryJson);
  const additionalImg = gallery[0] ? buildAbsoluteUrl(opts.origin, gallery[0]) : "";

  return [
    "",
    cleanName,
    catLabel,
    resolvedPrice,
    parseJustdialMoq(product.moq),
    product.sku,
    barcode,
    description,
    mapJustdialUnit(product.priceUnit),
    country,
    importerName,
    importerContact,
    manufacturerName,
    manufacturerContact,
    primaryImg,
    additionalImg,
  ];
}

export function serializeJustdialCsv(rows: string[][]): string {
  return toCsv(JUSTDIAL_HEADERS, rows, { bom: false });
}

export function buildJustdialSampleCsv(opts: JustdialExportOptions): string {
  return serializeJustdialCsv([
    [
      "",
      "DMC Tools AF8 Adjustable 8-Indent Crimp Tool",
      "Hand, Power & Cutting Tools",
      "",
      "1",
      "DMC-AF8*",
      "",
      "MIL-DTL-22520/1* & AS22520/1* heavy-duty 8-indent crimp tool frame (12-26 AWG).",
      "Pieces",
      "USA",
      cleanSingleLine(opts.companyName),
      cleanSingleLine(opts.companyContact),
      "DMC Tools",
      "DMC Tools, USA, https://dmctools.com",
      buildAbsoluteUrl(opts.origin, "/images/hero-industrial.jpg"),
      "",
    ],
  ]);
}
