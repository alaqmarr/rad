import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const BASE_URL = "https://www.toolbuy.com";

interface BrandConfig {
  dbSlug: string;
  brandName: string;
  tbStoreSlug: string;
  skuPrefix: string;
  defaultCategorySlug: string;
  defaultUnit?: string;
  logoUrl?: string;
  websiteUrl?: string;
  countryOfOrigin?: string;
  isFeatured?: boolean;
  sortOrder?: number;
  description?: string;
}

const BRAND_CONFIGS: BrandConfig[] = [
  {
    dbSlug: "fluke",
    brandName: "Fluke",
    tbStoreSlug: "fluke",
    skuPrefix: "FLK",
    defaultCategorySlug: "precision-instruments",
  },
  {
    dbSlug: "norton-abrasives",
    brandName: "Norton Abrasives",
    tbStoreSlug: "norton",
    skuPrefix: "NRT",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
  },
  {
    dbSlug: "fenner-india",
    brandName: "Fenner India",
    tbStoreSlug: "fenner",
    skuPrefix: "FEN",
    defaultCategorySlug: "bearings-transmission",
  },
  {
    dbSlug: "skf",
    brandName: "SKF",
    tbStoreSlug: "skf",
    skuPrefix: "SKF",
    defaultCategorySlug: "bearings-transmission",
  },
  {
    dbSlug: "esab",
    brandName: "ESAB",
    tbStoreSlug: "esab",
    skuPrefix: "ESAB",
    defaultCategorySlug: "welding-fabrication",
  },
  {
    dbSlug: "3m-industrial",
    brandName: "3M Industrial",
    tbStoreSlug: "3m",
    skuPrefix: "3M",
    defaultCategorySlug: "safety-ppe",
  },
  {
    dbSlug: "bosch-professional",
    brandName: "Bosch Professional",
    tbStoreSlug: "bosch",
    skuPrefix: "BSH",
    defaultCategorySlug: "tools-cutting-machining",
  },
  {
    dbSlug: "makita",
    brandName: "Makita",
    tbStoreSlug: "makita",
    skuPrefix: "MKT",
    defaultCategorySlug: "tools-cutting-machining",
  },
  {
    dbSlug: "mitutoyo",
    brandName: "Mitutoyo",
    tbStoreSlug: "mitutoyo",
    skuPrefix: "MIT",
    defaultCategorySlug: "precision-instruments",
  },
  {
    dbSlug: "black-decker",
    brandName: "Black & Decker",
    tbStoreSlug: "black-decker",
    skuPrefix: "BKD",
    defaultCategorySlug: "tools-cutting-machining",
    logoUrl: "/logos/brands/black-decker.svg",
    websiteUrl: "https://www.blackanddecker.in",
    countryOfOrigin: "USA",
    sortOrder: 35,
    description: "Compact power drills, sanders, jigsaws, heat guns, and maintenance workshop tools.",
  },
  {
    dbSlug: "dewalt",
    brandName: "DEWALT",
    tbStoreSlug: "dewalt",
    skuPrefix: "DWLT",
    defaultCategorySlug: "tools-cutting-machining",
    logoUrl: "/logos/brands/dewalt.svg",
    websiteUrl: "https://in.dewalt.global",
    countryOfOrigin: "USA",
    isFeatured: true,
    sortOrder: 36,
    description: "Heavy-duty XR brushless power tools, rotary hammers, angle grinders, saws, and accessories.",
  },
  {
    dbSlug: "hikoki",
    brandName: "HiKOKI",
    tbStoreSlug: "hikoki",
    skuPrefix: "HKK",
    defaultCategorySlug: "tools-cutting-machining",
    logoUrl: "/logos/brands/hikoki.svg",
    websiteUrl: "https://www.hikoki-powertools.in",
    countryOfOrigin: "Japan",
    isFeatured: true,
    sortOrder: 37,
    description: "Industrial power tools, MultiVolt cordless systems, demolition hammers, and cut-off machines.",
  },
  {
    dbSlug: "addison",
    brandName: "Addison",
    tbStoreSlug: "addison",
    skuPrefix: "ADD",
    defaultCategorySlug: "tools-cutting-machining",
    logoUrl: "/logos/brands/addison.svg",
    websiteUrl: "https://addison.co.in",
    countryOfOrigin: "India",
    isFeatured: true,
    sortOrder: 38,
    description: "Precision HSS & carbide twist drills, end mills, reamers, taps, and milling cutters.",
  },
  {
    dbSlug: "freemans",
    brandName: "Freemans",
    tbStoreSlug: "freemans",
    skuPrefix: "FRM",
    defaultCategorySlug: "precision-instruments",
    logoUrl: "/logos/brands/freemans.svg",
    websiteUrl: "https://www.freemansgroup.com",
    countryOfOrigin: "India",
    sortOrder: 39,
    description: "Precision measuring tapes, spirit levels, laser distance meters, and hand measuring tools.",
  },
  {
    dbSlug: "alko-plus",
    brandName: "Alko Plus",
    tbStoreSlug: "alko-plus",
    skuPrefix: "ALKO",
    defaultCategorySlug: "safety-ppe",
    logoUrl: "/logos/brands/alko-plus.svg",
    websiteUrl: "https://alkoplus.com",
    countryOfOrigin: "India",
    sortOrder: 40,
    description: "Industrial safety helmets, full-body harnesses, lanyards, safety shoes, and fall protection PPE.",
  },
  {
    dbSlug: "tooltech",
    brandName: "Tooltech",
    tbStoreSlug: "tooltech",
    skuPrefix: "TTCH",
    defaultCategorySlug: "tools-cutting-machining",
    logoUrl: "/logos/brands/tooltech.svg",
    countryOfOrigin: "India",
    sortOrder: 41,
    description: "Industrial cutting, hand tools, precision MRO consumables, and workshop hardware.",
  },
  {
    dbSlug: "ecodrive",
    brandName: "Ecodrive",
    tbStoreSlug: "ecodrive",
    skuPrefix: "ECOD",
    defaultCategorySlug: "bearings-transmission",
    logoUrl: "/logos/brands/ecodrive.svg",
    countryOfOrigin: "India",
    sortOrder: 42,
    description: "Industrial power transmission belts, V-belts, pulleys, and mechanical drive components.",
  },
  {
    dbSlug: "poly-f-plus",
    brandName: "Poly F Plus",
    tbStoreSlug: "poly-f-plus",
    skuPrefix: "PFP",
    defaultCategorySlug: "bearings-transmission",
    logoUrl: "/logos/brands/poly-f-plus.svg",
    websiteUrl: "https://www.jkfenner.com",
    countryOfOrigin: "India",
    sortOrder: 43,
    description: "Anti-static, oil- and heat-resistant industrial wrapped V-belts and wedge belts.",
  },
  {
    dbSlug: "dowsil",
    brandName: "DOWSIL",
    tbStoreSlug: "dowsil",
    skuPrefix: "DWS",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
    logoUrl: "/logos/brands/dowsil.svg",
    websiteUrl: "https://www.dow.com",
    countryOfOrigin: "USA / Global",
    sortOrder: 44,
    description: "High-performance silicone sealants, structural glazing adhesives, and industrial thermal compounds.",
  },
  {
    dbSlug: "fevicol",
    brandName: "Fevicol",
    tbStoreSlug: "fevicol",
    skuPrefix: "FVC",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
    logoUrl: "/logos/brands/fevicol.svg",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    isFeatured: true,
    sortOrder: 45,
    description: "Industrial woodworking, laminate, assembly, and multi-substrate synthetic resin adhesives.",
  },
  {
    dbSlug: "feviseal",
    brandName: "Feviseal",
    tbStoreSlug: "feviseal",
    skuPrefix: "FVS",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    sortOrder: 46,
    description: "Neutral-cure and acetoxy silicone sealants for industrial weatherproofing, HVAC, and glazing.",
  },
  {
    dbSlug: "fevi-quick",
    brandName: "Fevi Kwik",
    tbStoreSlug: "fevikwik",
    skuPrefix: "FVK",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
    logoUrl: "/logos/brands/fevi-quick.svg",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    sortOrder: 47,
    description: "Instant cyanoacrylate industrial adhesives for rapid metal, plastic, rubber, and elastomer bonding.",
  },
  {
    dbSlug: "mseal",
    brandName: "M-Seal",
    tbStoreSlug: "m-seal",
    skuPrefix: "MSL",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
    logoUrl: "/logos/brands/mseal.svg",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    sortOrder: 48,
    description: "Two-part epoxy compounds for leak sealing, pipe joining, electrical insulation, and metallic repair.",
  },
  {
    dbSlug: "fevibond",
    brandName: "Fevibond",
    tbStoreSlug: "fevibond",
    skuPrefix: "FVB",
    defaultCategorySlug: "lubricants-adhesives-abrasives",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    sortOrder: 49,
    description: "Synthetic rubber contact adhesives for leather, rubber, foam, canvas, and metal bonding.",
  },
];

function decodeEntities(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&deg;/gi, "°")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#x26;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function sanitizeText(str: string): string {
  return decodeEntities(str)
    .replace(/Please Note\s+that Product may differ[\s\S]*?without notice\.?/gi, "")
    .replace(/\btool\s*buy(\.com)?\b/gi, "Radiant Industrial Co.")
    .replace(/https?:\/\/(?:www\.)?toolbuy\.com[^\s)"]*/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  return sanitizeText(stripped);
}

function normSkuHyphen(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"*®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractBalancedJson(str: string, startBraceIdx: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startBraceIdx; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return str.slice(startBraceIdx, i + 1);
    }
  }
  return null;
}

function parseRscText(html: string): string {
  const chunks: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`));
    } catch {
      chunks.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"));
    }
  }
  return chunks.join("");
}

function extractRscHtmlChunk(rsc: string, refId: string | null | undefined): string {
  if (!refId || !refId.startsWith("$")) return "";
  const id = refId.slice(1);
  const markerRe = new RegExp(`(?:^|\\n)${id}:T([0-9a-f]+),`, "i");
  const m = markerRe.exec(rsc);
  if (!m) return "";
  const byteLen = parseInt(m[1], 16);
  const start = m.index + m[0].length;
  const candidate = rsc.slice(start, start + Math.max(byteLen, 64) + 500);
  const endMatch = candidate.match(/\n[0-9a-f]{1,4}:(?:\[|I\[|"|T[0-9a-f]+,)/);
  return endMatch ? candidate.slice(0, endMatch.index) : candidate.slice(0, byteLen);
}

async function fetchHtmlWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }
  return null;
}

function normalizeImageUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const trimmed = u.trim();
  if (!trimmed.startsWith("https://media.toolbuy.com/products/")) return null;
  return trimmed;
}

function mapCategorySlug(breadcrumbs: string[], title: string, fallbackSlug: string): string {
  const hay = `${breadcrumbs.join(" ")} ${title}`.toLowerCase();
  if (
    hay.includes("bearing") ||
    hay.includes("v-belt") ||
    hay.includes("v belt") ||
    hay.includes("timing belt") ||
    hay.includes("pulley") ||
    hay.includes("coupling") ||
    hay.includes("pillow block") ||
    hay.includes("oil seal")
  ) {
    return "bearings-transmission";
  }
  if (
    hay.includes("weld") ||
    hay.includes("electrode") ||
    hay.includes("mig") ||
    hay.includes("tig") ||
    hay.includes("plasma cutter") ||
    hay.includes("flux")
  ) {
    return "welding-fabrication";
  }
  if (
    hay.includes("helmet") ||
    hay.includes("respirator") ||
    hay.includes("mask") ||
    hay.includes("goggle") ||
    hay.includes("eyewear") ||
    hay.includes("earplug") ||
    hay.includes("earmuff") ||
    hay.includes("harness") ||
    hay.includes("safety shoe") ||
    hay.includes("glove") ||
    hay.includes("safety")
  ) {
    return "safety-ppe";
  }
  if (
    hay.includes("abrasive") ||
    hay.includes("grinding wheel") ||
    hay.includes("cut off wheel") ||
    hay.includes("cutting wheel") ||
    hay.includes("flap disc") ||
    hay.includes("sanding") ||
    hay.includes("sandpaper") ||
    hay.includes("emery") ||
    hay.includes("adhesive") ||
    hay.includes("sealant") ||
    hay.includes("vhb") ||
    hay.includes("tape") ||
    hay.includes("grease") ||
    hay.includes("lubricant") ||
    hay.includes("threadlocker")
  ) {
    return "lubricants-adhesives-abrasives";
  }
  if (
    hay.includes("multimeter") ||
    hay.includes("clamp meter") ||
    hay.includes("thermal") ||
    hay.includes("caliper") ||
    hay.includes("micrometer") ||
    hay.includes("dial gauge") ||
    hay.includes("bore gauge") ||
    hay.includes("height gauge") ||
    hay.includes("laser measure") ||
    hay.includes("oscilloscope") ||
    hay.includes("megger") ||
    hay.includes("insulation tester") ||
    hay.includes("tachometer") ||
    hay.includes("thermometer") ||
    hay.includes("spirit level") ||
    hay.includes("measuring")
  ) {
    return "precision-instruments";
  }
  if (
    hay.includes("switch") ||
    hay.includes("contactor") ||
    hay.includes("mcb") ||
    hay.includes("mccb") ||
    hay.includes("pneumatic") ||
    hay.includes("solenoid")
  ) {
    return "electrical-pneumatic-mro";
  }
  if (
    hay.includes("tool bag") ||
    hay.includes("toolbox") ||
    hay.includes("tool box") ||
    hay.includes("trolley") ||
    hay.includes("crate")
  ) {
    return "storage-material-handling";
  }
  if (
    hay.includes("drill") ||
    hay.includes("grinder") ||
    hay.includes("hammer") ||
    hay.includes("saw") ||
    hay.includes("wrench") ||
    hay.includes("cutter") ||
    hay.includes("router") ||
    hay.includes("blower") ||
    hay.includes("screwdriver") ||
    hay.includes("spanner") ||
    hay.includes("bit") ||
    hay.includes("blade")
  ) {
    return "tools-cutting-machining";
  }
  return fallbackSlug;
}

interface ScrapedItem {
  title: string;
  modelNo: string;
  sizeText: string;
  slug: string;
  imageUrl: string | null;
  gallery: string[];
  description: string;
  specs: Array<{ label: string; value: string }>;
  breadcrumbs: string[];
  hsnCode: string;
  listPriceInr: number | null;
  minQty: number;
}

async function syncOneBrand(
  cfg: BrandConfig,
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  let [brandRow] = await db.select().from(brands).where(eq(brands.slug, cfg.dbSlug));
  if (!brandRow) {
    await db
      .insert(brands)
      .values({
        slug: cfg.dbSlug,
        name: cfg.brandName,
        logoUrl: cfg.logoUrl || null,
        websiteUrl: cfg.websiteUrl || null,
        countryOfOrigin: cfg.countryOfOrigin || "India",
        isFeatured: cfg.isFeatured ?? false,
        sortOrder: cfg.sortOrder ?? 99,
        sourcingType: "independent",
        sourcingNote:
          "We are not an official authorized dealer yet; we source genuine items directly against your order.",
        description: cfg.description || `Genuine ${cfg.brandName} industrial products.`,
        seoTitle: `${cfg.brandName} Wholesale Supply | Radiant Industrial Co.`,
        seoDescription: `Source genuine ${cfg.brandName} products in India through Radiant Industrial Co.`,
        isActive: true,
      })
      .onConflictDoNothing({ target: brands.slug });
    [brandRow] = await db.select().from(brands).where(eq(brands.slug, cfg.dbSlug));
  }
  if (!brandRow) {
    console.warn(`[load-tb-brands] Brand slug not found in DB: ${cfg.dbSlug}`);
    return null;
  }

  const defaultCat = catBySlug[cfg.defaultCategorySlug] || Object.values(catBySlug)[0];
  console.log(`\n=== [${cfg.brandName}] Discovering store/${cfg.tbStoreSlug}/all ===`);

  const entryMap = new Map<string, { kind: "product" | "series"; slug: string; fallbackImg: string | null }>();
  for (let pageNo = 1; pageNo <= 120; pageNo++) {
    const html = await fetchHtmlWithRetry(`${BASE_URL}/store/${cfg.tbStoreSlug}/all?pageNo=${pageNo}`);
    if (!html) break;
    const rsc = parseRscText(html);
    let pageCount = 0;

    for (const m of rsc.matchAll(
      /"kind":"(product|series)","id":"[^"]+","sku":"[^"]*","slug":"([^"]+)"[\s\S]{0,400}?"image":\{"url":"([^"]+)"/g
    )) {
      const kind = m[1] as "product" | "series";
      const slug = m[2];
      const url = `${BASE_URL}/${kind === "series" ? "s" : "tp"}/${slug}`;
      if (!entryMap.has(url)) {
        entryMap.set(url, { kind, slug, fallbackImg: normalizeImageUrl(m[3]) });
      }
      pageCount++;
    }

    if (pageCount === 0) {
      for (const m of rsc.matchAll(/"kind":"(product|series)","id":"[^"]+","sku":"[^"]*","slug":"([^"]+)"/g)) {
        const kind = m[1] as "product" | "series";
        const slug = m[2];
        const url = `${BASE_URL}/${kind === "series" ? "s" : "tp"}/${slug}`;
        if (!entryMap.has(url)) entryMap.set(url, { kind, slug, fallbackImg: null });
        pageCount++;
      }
    }

    const totalPagesMatch = html.match(/Page\s+\d+\s+of\s+(\d+)/i);
    if (totalPagesMatch && pageNo >= Number(totalPagesMatch[1])) break;
    if (pageCount === 0) break;
  }

  console.log(`[${cfg.brandName}] Discovered ${entryMap.size} catalog/series pages. Fetching details...`);

  const scrapedItems: ScrapedItem[] = [];
  const entries = [...entryMap.entries()];
  const CONCURRENCY = 16;

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const chunk = entries.slice(i, i + CONCURRENCY);
    const pagesHtml = await Promise.all(
      chunk.map(async ([url, meta]) => ({
        meta,
        html: await fetchHtmlWithRetry(url),
      }))
    );

    for (const { meta, html } of pagesHtml) {
      if (!html) continue;
      const rsc = parseRscText(html);

      if (meta.kind === "product") {
        const marker = rsc.indexOf('{"product":{');
        if (marker === -1) continue;
        const jsonRaw = extractBalancedJson(rsc, marker);
        if (!jsonRaw) continue;
        let p: any = null;
        try {
          p = JSON.parse(jsonRaw).product;
        } catch {
          continue;
        }
        if (!p?.title) continue;

        const imgs = (p.images || [])
          .map((im: any) => normalizeImageUrl(im?.url))
          .filter(Boolean) as string[];
        if (imgs.length === 0 && meta.fallbackImg) imgs.push(meta.fallbackImg);

        const descHtml = extractRscHtmlChunk(rsc, p.descriptionHtml);
        const plainDesc = htmlToPlainText(descHtml);
        const bcs = (p.breadcrumbs || []).map((b: any) => sanitizeText(String(b?.name || ""))).filter(Boolean);
        const specs: Array<{ label: string; value: string }> = [];
        for (const s of p.specifications || []) {
          if (s?.name && s?.value) {
            specs.push({
              label: sanitizeText(String(s.name)),
              value: sanitizeText(String(s.value)),
            });
          }
        }
        if (p.weight && p.weightUnit) {
          specs.push({ label: "Weight", value: `${p.weight} ${p.weightUnit}` });
        }

        scrapedItems.push({
          title: sanitizeText(String(p.title)),
          modelNo: sanitizeText(String(p.modelNo || p.sku || meta.slug)),
          sizeText: "",
          slug: String(p.slug || meta.slug),
          imageUrl: imgs[0] || null,
          gallery: imgs.slice(1),
          description: plainDesc,
          specs,
          breadcrumbs: bcs,
          hsnCode: String(p.hsnCode || "").trim(),
          listPriceInr:
            typeof p.price?.listAmount === "number" && p.price.listAmount > 0 ? p.price.listAmount : null,
          minQty: Number(p.minOrderQuantity) > 0 ? Number(p.minOrderQuantity) : 1,
        });
      } else {
        const marker = rsc.indexOf('{"series":{');
        if (marker === -1) continue;
        const jsonRaw = extractBalancedJson(rsc, marker);
        if (!jsonRaw) continue;
        let s: any = null;
        try {
          s = JSON.parse(jsonRaw).series;
        } catch {
          continue;
        }
        if (!s) continue;

        const bcs = (s.breadcrumbs || []).map((b: any) => sanitizeText(String(b?.name || ""))).filter(Boolean);
        const seriesDescHtml = extractRscHtmlChunk(rsc, s.descriptionHtml);
        const seriesDesc = htmlToPlainText(seriesDescHtml);
        const seriesSpecs = (s.specifications || [])
          .filter((sp: any) => (sp?.label || sp?.name) && sp?.value)
          .map((sp: any) => ({
            label: sanitizeText(String(sp.label || sp.name)),
            value: sanitizeText(String(sp.value)),
          }));

        for (const v of s.products || []) {
          if (!v?.title) continue;
          const vImg = normalizeImageUrl(v.image?.url) || meta.fallbackImg;
          const attrEntries = Object.entries(v.attributes || {});
          const sizeText = attrEntries.map(([, val]) => String(val)).join(" ");
          const vSpecs = [...seriesSpecs];
          for (const [ak, av] of attrEntries) {
            if (!vSpecs.some((x) => x.label.toLowerCase() === ak.toLowerCase())) {
              vSpecs.push({ label: sanitizeText(ak), value: sanitizeText(String(av)) });
            }
          }
          for (const vs of v.specifications || []) {
            const lbl = sanitizeText(String(vs?.label || vs?.name || ""));
            const val = sanitizeText(String(vs?.value || ""));
            if (lbl && val && !vSpecs.some((x) => x.label.toLowerCase() === lbl.toLowerCase())) {
              vSpecs.push({ label: lbl, value: val });
            }
          }
          if (v.weight && v.weightUnit) {
            vSpecs.push({ label: "Weight", value: `${v.weight} ${v.weightUnit}` });
          }

          scrapedItems.push({
            title: sanitizeText(String(v.title)),
            modelNo: sanitizeText(String(v.modelNo || v.sku || v.slug || meta.slug)),
            sizeText,
            slug: String(v.slug || meta.slug),
            imageUrl: vImg,
            gallery: [],
            description: seriesDesc,
            specs: vSpecs,
            breadcrumbs: bcs,
            hsnCode: String(s.hsnCode || v.hsnCode || "").trim(),
            listPriceInr:
              typeof v.price?.listAmount === "number" && v.price.listAmount > 0 ? v.price.listAmount : null,
            minQty: Number(v.minOrderQuantity) > 0 ? Number(v.minOrderQuantity) : 1,
          });
        }
      }
    }

    if ((i / CONCURRENCY) % 20 === 0 && entries.length > CONCURRENCY * 5) {
      console.log(`[${cfg.brandName}] Progress: ${Math.min(i + CONCURRENCY, entries.length)}/${entries.length} pages -> ${scrapedItems.length} items`);
    }
  }

  // Deduplicate by SKU and prepare non-destructive inserts
  const toInsert: Array<typeof products.$inferInsert> = [];
  let skippedExisting = 0;

  for (const item of scrapedItems) {
    const modelPart = normSkuHyphen(item.modelNo || item.slug);
    const sizePart = item.sizeText ? `-${normSkuHyphen(item.sizeText)}` : "";
    let dbSku = `${cfg.skuPrefix}-${modelPart || toSlug(item.title).toUpperCase().slice(0, 24)}`;
    if (existingSkus.has(dbSku) && sizePart) {
      dbSku = `${cfg.skuPrefix}-${modelPart}${sizePart}`;
    }
    if (existingSkus.has(dbSku)) {
      skippedExisting++;
      continue;
    }
    existingSkus.add(dbSku);

    const catSlug = mapCategorySlug(item.breadcrumbs, item.title, cfg.defaultCategorySlug);
    const cat = catBySlug[catSlug] || defaultCat;
    const cleanShort = sanitizeText(
      `${item.title} (${cfg.brandName} ${item.modelNo}). Confirm exact technical specs and pack quantity before ordering.`
    ).slice(0, 220);

    const fullDesc = [
      item.description || `${item.title} — genuine ${cfg.brandName} industrial product.`,
      "",
      "Before Ordering: Please verify exact model number, technical specifications, capacity rating, and standard pack quantity with our team before confirming your order.",
    ].join("\n");

    const specs = [
      { label: "Brand", value: cfg.brandName },
      { label: "Model / Part No.", value: item.modelNo },
      ...item.specs.filter((s) => s.label.toLowerCase() !== "brand" && s.label.toLowerCase() !== "model no."),
    ];

    let safeSlug = toSlug(`${cfg.dbSlug}-${item.slug || dbSku}`);
    if (!safeSlug) safeSlug = toSlug(`${cfg.dbSlug}-${dbSku}`);
    if (existingSlugs.has(safeSlug)) {
      let sfx = 2;
      while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
      safeSlug = `${safeSlug}-${sfx}`;
    }
    existingSlugs.add(safeSlug);

    toInsert.push({
      slug: safeSlug,
      sku: dbSku,
      name: item.title,
      shortDescription: cleanShort,
      description: fullDesc,
      divisionId: cat.divisionId,
      categoryId: cat.id,
      brandId: brandRow.id,
      pricingMode: "rfq_only",
      basePrice: item.listPriceInr,
      priceUnit: cfg.defaultUnit || "NOS",
      gstPercent: 18,
      moq: `${item.minQty} ${cfg.defaultUnit || "NOS"}`,
      leadTime: "3–7 Working Days",
      hsnCode: item.hsnCode,
      specificationsJson: JSON.stringify(specs.slice(0, 14)),
      primaryImageUrl: item.imageUrl,
      galleryJson: JSON.stringify(item.gallery),
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${item.title} (${item.modelNo}) | Radiant Industrial Co.`,
      seoDescription: cleanShort,
    });
  }

  // Insert in chunks of 100
  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(products).values(toInsert.slice(i, i + 100)).onConflictDoNothing({ target: products.sku });
  }

  return {
    brand: cfg.dbSlug,
    catalogPages: entryMap.size,
    extractedVariants: scrapedItems.length,
    inserted: toInsert.length,
    skippedExisting,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function main() {
  const cliArgs = process.argv
    .slice(2)
    .flatMap((a) => a.replace(/^--brands=/, "").split(","))
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("-"));
  const envBrands = (process.env.BRANDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedSlugs =
    cliArgs.length > 0 ? new Set(cliArgs) : envBrands.length > 0 ? new Set(envBrands) : null;

  const targets = selectedSlugs
    ? BRAND_CONFIGS.filter((b) => selectedSlugs.has(b.dbSlug))
    : BRAND_CONFIGS;

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const results = [];
  for (const cfg of targets) {
    const res = await syncOneBrand(cfg, catBySlug, existingSkus, existingSlugs);
    if (res) results.push(res);
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-tb-brands] Error:", err);
    process.exit(1);
  });
