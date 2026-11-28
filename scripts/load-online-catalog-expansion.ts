import { eq } from "drizzle-orm";
import { brands, categories, db } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";
import {
  isUsableImageUrl,
  normalizeSku,
  toSlug,
  upsertBrandProducts,
  type UpsertProductCandidate,
} from "./lib/product-upsert";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MOGLIX_CDN = "https://cdn.moglix.com/";

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xml,application/json,*/*;q=0.8" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      if (attempt === 2) return null;
      await new Promise((res) => setTimeout(res, 250));
    }
  }
  return null;
}

async function fetchJson<T = any>(url: string, timeoutMs = 12000): Promise<T | null> {
  const txt = await fetchText(url, timeoutMs);
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

interface MoglixItem {
  moglixPartNumber?: string;
  itemCode?: string;
  productName?: string;
  variantName?: string;
  brandName?: string;
  shortDesc?: string;
  keyFeatures?: string[];
  mainImageLink?: string;
  mainImagePath?: string;
  taxonomy?: string;
  moq?: number;
  quantityUom?: string;
  itemInPack?: string;
  attributeValuesForPart?: Record<string, string[] | string>;
}

async function fetchMoglixSearch(
  query: string,
  maxItems: number,
  brandMatcher: (item: MoglixItem) => boolean
): Promise<MoglixItem[]> {
  const out: MoglixItem[] = [];
  const pageSize = 40;
  const maxPages = Math.ceil(maxItems / pageSize) + 2;

  for (let page = 0; page < maxPages && out.length < maxItems; page++) {
    const url = `https://api.moglix.com/search?str=${encodeURIComponent(query)}&pageIndex=${page}&pageSize=${pageSize}`;
    const data = await fetchJson<{ productSearchResult?: { products?: MoglixItem[] } }>(url);
    const list = data?.productSearchResult?.products || [];
    if (list.length === 0) break;

    for (const item of list) {
      if (!item.productName) continue;
      if (!brandMatcher(item)) continue;
      out.push(item);
      if (out.length >= maxItems) break;
    }
    if (list.length < pageSize) break;
  }
  return out;
}

function moglixImageUrl(item: MoglixItem): string | null {
  const raw = item.mainImageLink || item.mainImagePath || "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${MOGLIX_CDN}${raw.replace(/^\/+/, "")}`;
}

function moglixToCandidate(
  item: MoglixItem,
  opts: {
    brandId: number;
    brandDisplay: string;
    skuPrefix: string;
    divisionId: number;
    categoryId: number;
    hsnCode: string;
    defaultMoq?: string;
  }
): UpsertProductCandidate {
  const name = htmlToCleanText(item.productName || item.variantName || "", true);
  const code = item.itemCode || item.moglixPartNumber || toSlug(name);
  const sku = normalizeSku(opts.skuPrefix, code);
  const slug = toSlug(`${opts.skuPrefix.toLowerCase()}-${name}-${code.slice(-6)}`);

  const specs: Array<{ label: string; value: string }> = [
    { label: "Brand", value: opts.brandDisplay },
    ...(item.itemCode ? [{ label: "Model / Item Code", value: String(item.itemCode) }] : []),
    ...(item.itemInPack ? [{ label: "Pack Size", value: String(item.itemInPack) }] : []),
    ...(item.taxonomy
      ? [{ label: "Product Line", value: String(item.taxonomy).split("/").pop() || item.taxonomy }]
      : []),
  ];

  if (item.attributeValuesForPart && typeof item.attributeValuesForPart === "object") {
    for (const [k, v] of Object.entries(item.attributeValuesForPart)) {
      const val = Array.isArray(v) ? v.join(", ") : String(v ?? "");
      const cleanVal = htmlToCleanText(val, true);
      if (cleanVal && cleanVal.length <= 120 && specs.length < 14) {
        specs.push({ label: htmlToCleanText(k, true), value: cleanVal });
      }
    }
  }

  const features = (item.keyFeatures || [])
    .map((f) => htmlToCleanText(f, true))
    .filter((f) => f.length > 3);

  const shortDesc = `${name} — genuine ${opts.brandDisplay} industrial supply available for B2B GST invoicing via Radiant Industrial Co.`.slice(
    0,
    220
  );

  const descParts = [
    htmlToCleanText(item.shortDesc || "", false) || `${name} by ${opts.brandDisplay}.`,
    features.length > 0 ? `\nKey Features:\n${features.map((f) => `• ${f}`).join("\n")}` : "",
    "\nBefore Ordering: Confirm pack size, grade/variant, and required quantity for consolidated B2B GST quotation.",
  ].filter(Boolean);

  return {
    sku,
    slug,
    name,
    shortDescription: shortDesc,
    description: descParts.join("\n"),
    divisionId: opts.divisionId,
    categoryId: opts.categoryId,
    brandId: opts.brandId,
    hsnCode: opts.hsnCode,
    moq: item.moq && item.moq > 1 ? `${item.moq} ${item.quantityUom || "NOS"}` : opts.defaultMoq || "1 NOS",
    priceUnit: item.quantityUom || "NOS",
    specifications: specs,
    primaryImageUrl: moglixImageUrl(item),
  };
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  body_html?: string;
  images?: Array<{ src: string }>;
  variants?: Array<{ sku?: string; title?: string }>;
}

const shopifyStoreCache = new Map<string, ShopifyProduct[]>();

async function fetchShopifyStore(domain: string, maxPages = 8): Promise<ShopifyProduct[]> {
  if (shopifyStoreCache.has(domain)) return shopifyStoreCache.get(domain)!;
  const all: ShopifyProduct[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const data = await fetchJson<{ products?: ShopifyProduct[] }>(
      `https://${domain}/products.json?limit=250&page=${p}`
    );
    if (!data?.products?.length) break;
    all.push(...data.products);
    if (data.products.length < 250) break;
  }
  shopifyStoreCache.set(domain, all);
  return all;
}

function shopifyToCandidate(
  item: ShopifyProduct,
  opts: {
    brandId: number;
    brandDisplay: string;
    skuPrefix: string;
    divisionId: number;
    categoryId: number;
    hsnCode: string;
  }
): UpsertProductCandidate {
  const name = htmlToCleanText(item.title, true);
  const rawCode = String(item.variants?.[0]?.sku || item.handle || item.id);
  const sku = normalizeSku(opts.skuPrefix, rawCode);
  const slug = toSlug(`${opts.skuPrefix.toLowerCase()}-${item.handle || name}`);
  const desc = htmlToCleanText(item.body_html || "", false);
  const shortDesc = `${name} — genuine ${opts.brandDisplay} industrial product supplied by Radiant Industrial Co.`.slice(
    0,
    220
  );
  const imgs = (item.images || []).map((i) => i.src).filter(isUsableImageUrl);

  const specs: Array<{ label: string; value: string }> = [
    { label: "Brand", value: opts.brandDisplay },
    ...(rawCode ? [{ label: "Model / Code", value: rawCode }] : []),
    ...(item.product_type ? [{ label: "Product Type", value: htmlToCleanText(item.product_type, true) }] : []),
  ];

  const variantTitles = (item.variants || [])
    .map((v) => v.title)
    .filter((t): t is string => Boolean(t && t !== "Default Title"));
  if (variantTitles.length > 0) {
    specs.push({ label: "Available Variants / Packs", value: variantTitles.slice(0, 8).join(", ") });
  }

  return {
    sku,
    slug,
    name,
    shortDescription: shortDesc,
    description: desc || `${name} — genuine ${opts.brandDisplay} industrial supply.`,
    divisionId: opts.divisionId,
    categoryId: opts.categoryId,
    brandId: opts.brandId,
    hsnCode: opts.hsnCode,
    specifications: specs,
    primaryImageUrl: imgs[0] || null,
    gallery: imgs.slice(1, 5),
  };
}

async function fetchOfficialFevisealPages(
  brandId: number,
  cat: { id: number; divisionId: number }
): Promise<{ feviseal: UpsertProductCandidate[]; fevicol: UpsertProductCandidate[] }> {
  const feviseal: UpsertProductCandidate[] = [];
  const fevicol: UpsertProductCandidate[] = [];
  const homeHtml = await fetchText("https://sealants.pidilite.com/");
  if (!homeHtml) return { feviseal, fevicol };

  const links = [
    ...new Set(
      [...homeHtml.matchAll(/href=["'](https?:\/\/sealants\.pidilite\.com\/(?:feviseal|fevicol)-[^"']+)["']/gi)].map(
        (m) => m[1]
      )
    ),
  ];

  await Promise.all(
    links.map(async (url) => {
      const html = await fetchText(url);
      if (!html) return;
      const rawTitle = htmlToCleanText(html.match(/<title>([^<]+)<\/title>/i)?.[1] || "", true);
      if (!rawTitle) return;

      const leaf = url.split("/").filter(Boolean).pop() || toSlug(rawTitle);
      const isFevicol = leaf.startsWith("fevicol-");
      const rawImgs = [...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi)]
        .map((m) => {
          try {
            return new URL(m[1], url).toString();
          } catch {
            return "";
          }
        })
        .filter((u) => u && !/logo|imgur|icon/i.test(u));

      const paras = [...html.matchAll(/<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)]
        .map((m) => htmlToCleanText(m[1], true))
        .filter((t) => t.length > 22 && !/copyright|privacy|cookie|related products/i.test(t));

      const uniqueParas = [...new Set(paras)].slice(0, 8);
      const colour = leaf.split("-").pop() || "";
      const specs = [
        { label: "Brand", value: isFevicol ? "Fevicol (Pidilite)" : "Feviseal (Pidilite)" },
        { label: "Product Code", value: leaf.toUpperCase() },
        ...(colour && /^(clear|white|black|grey|brown)$/i.test(colour)
          ? [{ label: "Colour / Shade", value: colour[0].toUpperCase() + colour.slice(1) }]
          : []),
        { label: "Source", value: "Official Pidilite Sealants Range" },
      ];

      const shortDesc = `${rawTitle} — genuine Pidilite ${
        isFevicol ? "structural adhesive" : "silicone sealant"
      } for industrial, glazing & weatherproofing applications.`.slice(0, 220);

      const candidate: UpsertProductCandidate = {
        sku: normalizeSku(isFevicol ? "FVC" : "FVS", leaf),
        slug: toSlug(leaf),
        name: rawTitle,
        shortDescription: shortDesc,
        description:
          uniqueParas.join("\n") ||
          `${rawTitle} — official Pidilite industrial sealant & bonding solution.`,
        divisionId: cat.divisionId,
        categoryId: cat.id,
        brandId,
        hsnCode: "3214",
        specifications: specs,
        primaryImageUrl: rawImgs[0] || null,
        gallery: rawImgs.slice(1, 4),
      };

      if (isFevicol) fevicol.push(candidate);
      else feviseal.push(candidate);
    })
  );

  return { feviseal, fevicol };
}

async function fetchOfficialDowsilProducts(
  brandId: number,
  cat: { id: number; divisionId: number }
): Promise<UpsertProductCandidate[]> {
  const candidates: UpsertProductCandidate[] = [];

  // Ellsworth authorized DOWSIL distributor pages (scan all DOWSIL entries with verified real product photos)
  const ellXml = await fetchText("https://www.ellsworth.com/sitemap.xml", 18000);
  if (ellXml) {
    const ellUrls = [
      ...new Set(
        [...ellXml.matchAll(/<loc>(https:\/\/www\.ellsworth\.com\/products\/[^<]*dowsil[^<]*)<\/loc>/gi)].map(
          (m) => m[1].trim()
        )
      ),
    ];

    const CONCURRENCY = 8;
    for (let i = 0; i < ellUrls.length; i += CONCURRENCY) {
      const batch = ellUrls.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (url) => {
          const html = await fetchText(url, 10000);
          if (!html) return;
          const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "", true);
          if (!h1 || !/dowsil/i.test(h1)) return;
          const ogImg =
            html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;
          if (!isUsableImageUrl(ogImg)) return;
          const metaDesc = htmlToCleanText(
            html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || "",
            false
          );
          const leaf = url.split("/").filter(Boolean).pop() || toSlug(h1);
          const sku = normalizeSku("DWS", leaf.slice(0, 46));
          const shortDesc = `${h1} — genuine DOWSIL industrial silicone adhesive/sealant supplied via Radiant Industrial Co.`.slice(
            0,
            220
          );

          candidates.push({
            sku,
            slug: toSlug(leaf),
            name: h1,
            shortDescription: shortDesc,
            description: metaDesc || shortDesc,
            divisionId: cat.divisionId,
            categoryId: cat.id,
            brandId,
            hsnCode: "3214",
            specifications: [
              { label: "Brand", value: "DOWSIL (Dow Silicones)" },
              { label: "SKU Reference", value: leaf.toUpperCase() },
            ],
            primaryImageUrl: ogImg,
          });
        })
      );
    }
  }

  return candidates;
}

async function main() {
  const brandFilterArg = process.argv.find((a) => a.startsWith("--brands="));
  const allowedBrands = brandFilterArg
    ? new Set(
        brandFilterArg
          .slice("--brands=".length)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      )
    : null;

  const shouldRun = (slug: string) => !allowedBrands || allowedBrands.has(slug);

  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) {
    catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };
  }
  const fallbackCat = Object.values(catBySlug)[0];
  const adhesiveCat = catBySlug["lubricants-adhesives-abrasives"] || fallbackCat;
  const safetyCat = catBySlug["safety-ppe"] || fallbackCat;
  const fastenerCat = catBySlug["fasteners-bolts-anchors"] || fallbackCat;
  const bearingCat = catBySlug["bearings-transmission"] || fallbackCat;

  const allBrands = await db.select().from(brands);
  const brandBySlug = new Map(allBrands.map((b) => [b.slug, b]));

  // Pre-load verified Indian B2B hardware Shopify catalogs once in parallel
  const shopifyStores = [
    "www.badarihardwares.com",
    "tvashta.co.in",
    "materialrunner.in",
    "onlyscrews.in",
    "hardwaredepot.in",
  ];
  const storeResults = await Promise.all(shopifyStores.map((d) => fetchShopifyStore(d, 8)));
  const allShopify = storeResults.flat();

  const report: Record<string, unknown> = {};

  // 1. FEVISEAL + FEVICOL official Pidilite sealants
  const fevisealBrand = brandBySlug.get("feviseal");
  const fevicolBrand = brandBySlug.get("fevicol");
  const officialPidilite =
    shouldRun("feviseal") || shouldRun("fevicol")
      ? await fetchOfficialFevisealPages(fevisealBrand?.id || 0, adhesiveCat)
      : { feviseal: [], fevicol: [] };

  // --- FEVICOL ---
  if (shouldRun("fevicol") && fevicolBrand) {
    const cands: UpsertProductCandidate[] = [];
    for (const c of officialPidilite.fevicol) {
      cands.push({ ...c, brandId: fevicolBrand.id });
    }
    const moglixFevicol = await fetchMoglixSearch(
      "fevicol",
      120,
      (item) => /^fevicol$/i.test(String(item.brandName || "").trim())
    );
    for (const item of moglixFevicol) {
      cands.push(
        moglixToCandidate(item, {
          brandId: fevicolBrand.id,
          brandDisplay: "Fevicol (Pidilite)",
          skuPrefix: "FVC",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3506",
        })
      );
    }
    for (const sp of allShopify) {
      const hay = `${sp.vendor || ""} ${sp.title || ""}`.toLowerCase();
      if (!/\bfevicol\b/.test(hay)) continue;
      cands.push(
        shopifyToCandidate(sp, {
          brandId: fevicolBrand.id,
          brandDisplay: "Fevicol (Pidilite)",
          skuPrefix: "FVC",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3506",
        })
      );
    }
    report["fevicol"] = await upsertBrandProducts(fevicolBrand.id, cands);
  }

  // --- FEVISEAL ---
  if (shouldRun("feviseal") && fevisealBrand) {
    const cands: UpsertProductCandidate[] = [...officialPidilite.feviseal];
    const moglixFeviseal = await fetchMoglixSearch("feviseal", 40, (item) =>
      /feviseal/i.test(`${item.brandName || ""} ${item.productName || ""}`)
    );
    for (const item of moglixFeviseal) {
      cands.push(
        moglixToCandidate(item, {
          brandId: fevisealBrand.id,
          brandDisplay: "Feviseal (Pidilite)",
          skuPrefix: "FVS",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3214",
        })
      );
    }
    for (const sp of allShopify) {
      const hay = `${sp.vendor || ""} ${sp.title || ""}`.toLowerCase();
      if (!/\bfeviseal\b/.test(hay)) continue;
      cands.push(
        shopifyToCandidate(sp, {
          brandId: fevisealBrand.id,
          brandDisplay: "Feviseal (Pidilite)",
          skuPrefix: "FVS",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3214",
        })
      );
    }
    report["feviseal"] = await upsertBrandProducts(fevisealBrand.id, cands);
  }

  // --- FEVIBOND ---
  const fevibondBrand = brandBySlug.get("fevibond");
  if (shouldRun("fevibond") && fevibondBrand) {
    const cands: UpsertProductCandidate[] = [];
    const [m1, m2] = await Promise.all([
      fetchMoglixSearch("fevibond", 40, (item) =>
        /fevibond/i.test(`${item.brandName || ""} ${item.productName || ""}`)
      ),
      fetchMoglixSearch("pidilite fevibond", 40, (item) =>
        /fevibond/i.test(`${item.brandName || ""} ${item.productName || ""}`)
      ),
    ]);
    for (const item of [...m1, ...m2]) {
      cands.push(
        moglixToCandidate(item, {
          brandId: fevibondBrand.id,
          brandDisplay: "Fevibond (Pidilite)",
          skuPrefix: "FVB",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3506",
        })
      );
    }
    for (const sp of allShopify) {
      const hay = `${sp.vendor || ""} ${sp.title || ""}`.toLowerCase();
      if (!/\bfevibond\b/.test(hay)) continue;
      cands.push(
        shopifyToCandidate(sp, {
          brandId: fevibondBrand.id,
          brandDisplay: "Fevibond (Pidilite)",
          skuPrefix: "FVB",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3506",
        })
      );
    }
    report["fevibond"] = await upsertBrandProducts(fevibondBrand.id, cands);
  }

  // --- DOWSIL ---
  const dowsilBrand = brandBySlug.get("dowsil");
  if (shouldRun("dowsil") && dowsilBrand) {
    const cands: UpsertProductCandidate[] = [];
    const officialDowsil = await fetchOfficialDowsilProducts(dowsilBrand.id, adhesiveCat);
    cands.push(...officialDowsil);

    const moglixDow = await fetchMoglixSearch("dow corning", 30, (item) =>
      /dow\s*corning|dowsil/i.test(`${item.brandName || ""} ${item.productName || ""}`)
    );
    for (const item of moglixDow) {
      cands.push(
        moglixToCandidate(item, {
          brandId: dowsilBrand.id,
          brandDisplay: "DOWSIL (Dow Silicones)",
          skuPrefix: "DWS",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3214",
        })
      );
    }
    for (const sp of allShopify) {
      const hay = `${sp.vendor || ""} ${sp.title || ""}`.toLowerCase();
      if (!/\b(?:dowsil|dow\s*corning)\b/.test(hay)) continue;
      cands.push(
        shopifyToCandidate(sp, {
          brandId: dowsilBrand.id,
          brandDisplay: "DOWSIL (Dow Silicones)",
          skuPrefix: "DWS",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3214",
        })
      );
    }
    report["dowsil"] = await upsertBrandProducts(dowsilBrand.id, cands);
  }

  // --- FEVI KWIK ---
  const fevikwikBrand = brandBySlug.get("fevi-quick");
  if (shouldRun("fevi-quick") && fevikwikBrand) {
    const cands: UpsertProductCandidate[] = [];
    const moglixFk = await fetchMoglixSearch("fevikwik", 40, (item) =>
      /fevi\s*kwik/i.test(`${item.brandName || ""} ${item.productName || ""}`)
    );
    for (const item of moglixFk) {
      cands.push(
        moglixToCandidate(item, {
          brandId: fevikwikBrand.id,
          brandDisplay: "Fevi Kwik (Pidilite)",
          skuPrefix: "FVK",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3506",
        })
      );
    }
    for (const sp of allShopify) {
      const hay = `${sp.vendor || ""} ${sp.title || ""}`.toLowerCase();
      if (!/\bfevi\s*kwik\b/.test(hay)) continue;
      cands.push(
        shopifyToCandidate(sp, {
          brandId: fevikwikBrand.id,
          brandDisplay: "Fevi Kwik (Pidilite)",
          skuPrefix: "FVK",
          divisionId: adhesiveCat.divisionId,
          categoryId: adhesiveCat.id,
          hsnCode: "3506",
        })
      );
    }
    report["fevi-quick"] = await upsertBrandProducts(fevikwikBrand.id, cands);
  }

  // --- 3M INDUSTRIAL ---
  const brand3m = brandBySlug.get("3m-industrial");
  if (shouldRun("3m-industrial") && brand3m) {
    const cands: UpsertProductCandidate[] = [];
    const moglix3m = await fetchMoglixSearch(
      "3m",
      160,
      (item) => /^3m$/i.test(String(item.brandName || "").trim())
    );
    for (const item of moglix3m) {
      const name = String(item.productName || "");
      const cat = /tape|adhesive|abrasive|disc|sand|glue|sealant|scotch/i.test(name)
        ? adhesiveCat
        : safetyCat;
      cands.push(
        moglixToCandidate(item, {
          brandId: brand3m.id,
          brandDisplay: "3M Industrial",
          skuPrefix: "3M",
          divisionId: cat.divisionId,
          categoryId: cat.id,
          hsnCode: /tape|abrasive|disc/i.test(name) ? "6805" : "9004",
        })
      );
    }
    for (const sp of allShopify) {
      const hay = `${sp.vendor || ""} ${sp.title || ""}`;
      if (!/(?:^|\b)3m\b/i.test(hay)) continue;
      const cat = /tape|adhesive|abrasive|disc|sand|glue|sealant|scotch/i.test(hay)
        ? adhesiveCat
        : safetyCat;
      cands.push(
        shopifyToCandidate(sp, {
          brandId: brand3m.id,
          brandDisplay: "3M Industrial",
          skuPrefix: "3M",
          divisionId: cat.divisionId,
          categoryId: cat.id,
          hsnCode: /tape|abrasive|disc/i.test(hay) ? "6805" : "9004",
        })
      );
    }
    report["3m-industrial"] = await upsertBrandProducts(brand3m.id, cands);
  }

  // --- UNBRAKO ---
  const unbrakoBrand = brandBySlug.get("unbrako");
  if (shouldRun("unbrako") && unbrakoBrand) {
    const cands: UpsertProductCandidate[] = [];
    const moglixUnb = await fetchMoglixSearch(
      "unbrako",
      120,
      (item) => /^unbrako$/i.test(String(item.brandName || "").trim())
    );
    for (const item of moglixUnb) {
      cands.push(
        moglixToCandidate(item, {
          brandId: unbrakoBrand.id,
          brandDisplay: "Unbrako",
          skuPrefix: "UNB",
          divisionId: fastenerCat.divisionId,
          categoryId: fastenerCat.id,
          hsnCode: "7318",
          defaultMoq: "100 NOS",
        })
      );
    }
    report["unbrako"] = await upsertBrandProducts(unbrakoBrand.id, cands);
  }

  // --- DOWTY ---
  const dowtyBrand = brandBySlug.get("dowty");
  if (shouldRun("dowty") && dowtyBrand) {
    const cands: UpsertProductCandidate[] = [];
    const moglixDowty = await fetchMoglixSearch("dowty", 30, (item) =>
      /\bdowty\b/i.test(`${item.brandName || ""} ${item.productName || ""}`)
    );
    for (const item of moglixDowty) {
      cands.push(
        moglixToCandidate(item, {
          brandId: dowtyBrand.id,
          brandDisplay: "Dowty",
          skuPrefix: "DWT",
          divisionId: bearingCat.divisionId,
          categoryId: bearingCat.id,
          hsnCode: "4016",
          defaultMoq: "25 NOS",
        })
      );
    }
    report["dowty"] = await upsertBrandProducts(dowtyBrand.id, cands);
  }

  console.log("\n=== ONLINE CATALOG EXPANSION REPORT ===");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-online-catalog-expansion] Error:", err);
    process.exit(1);
  });
