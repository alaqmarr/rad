import { eq, like, or } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";

const BASE_URL = "https://www.toolbuy.com";

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

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/Please Note\s+that Product may differ[\s\S]*?without notice\.?/gi, "")
    .replace(/\btool\s*buy\b/gi, "Radiant Industrial Co.")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function normAlphaNum(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  // Flight text chunks look like `<id>:T<hexLen>,<payload>` right before next `<hex>:...` or end
  const markerRe = new RegExp(`(?:^|\\n)${id}:T([0-9a-f]+),`, "i");
  const m = markerRe.exec(rsc);
  if (!m) return "";
  const byteLen = parseInt(m[1], 16);
  const start = m.index + m[0].length;
  // Take up to char slice slightly safely bounded by next chunk header or byteLen
  const candidate = rsc.slice(start, start + Math.max(byteLen, 64) + 500);
  const endMatch = candidate.match(/\n[0-9a-f]{1,4}:(?:\[|I\[|"|T[0-9a-f]+,)/);
  return endMatch ? candidate.slice(0, endMatch.index) : candidate.slice(0, byteLen);
}

async function fetchHtmlWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadiantCatalogSync/1.0)" },
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

function mapCategorySlug(breadcrumbs: string[], title: string): string {
  const hay = `${breadcrumbs.join(" ")} ${title}`.toLowerCase();
  if (
    hay.includes("abrasive") ||
    hay.includes("velcro") ||
    hay.includes("emery") ||
    hay.includes("cut off wheel") ||
    hay.includes("grinding") ||
    hay.includes("oil can") ||
    hay.includes("grease") ||
    hay.includes("adhesives") ||
    hay.includes("sealant") ||
    hay.includes("pvc tape") ||
    hay.includes("insulation tape")
  ) {
    return "lubricants-adhesives-abrasives";
  }
  if (
    hay.includes("torque") ||
    hay.includes("spirit level") ||
    hay.includes("caliper") ||
    hay.includes("measuring") ||
    hay.includes("tester")
  ) {
    return "precision-instruments";
  }
  if (
    hay.includes("tool bag") ||
    hay.includes("tool box") ||
    hay.includes("toolbox") ||
    hay.includes("trolley") ||
    hay.includes("jack")
  ) {
    return "storage-material-handling";
  }
  if (hay.includes("line tester") || hay.includes("vde") || hay.includes("insulated")) {
    return "electrical-pneumatic-mro";
  }
  if (hay.includes("non-sparking") || hay.includes("non sparking")) {
    return "hard-to-find-oem-spares";
  }
  return "tools-cutting-machining";
}

interface ScrapedTapariaItem {
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

function normalizeImageUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const trimmed = u.trim();
  if (!trimmed.startsWith("https://media.toolbuy.com/products/")) return null;
  return trimmed;
}

async function ensureTapariaBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "taparia"));
  if (existing) {
    if (!existing.isFeatured) {
      await db.update(brands).set({ isFeatured: true }).where(eq(brands.id, existing.id));
    }
    return existing.id;
  }

  await db
    .insert(brands)
    .values({
      slug: "taparia",
      name: "Taparia",
      countryOfOrigin: "India",
      sourcingType: "independent",
      sourcingNote:
        "We are not an official authorized dealer yet; we source genuine items directly against your order.",
      description:
        "Forged hand tools, spanners, torque wrenches, pliers, sockets, cutting tools, drills, files, and non-sparking safety tools.",
      isFeatured: true,
      sortOrder: 14,
      seoTitle: "Taparia Tools Wholesale Supply | Radiant Industrial Co.",
      seoDescription: "Source genuine Taparia hand tools in India through Radiant Industrial Co.",
      isActive: true,
    })
    .onConflictDoNothing({ target: brands.slug });

  const [created] = await db.select().from(brands).where(eq(brands.slug, "taparia"));
  if (!created) throw new Error("Failed to find or create 'taparia' brand.");
  return created.id;
}

async function main() {
  console.log("Fetching Taparia Tools catalog & images cleanly (non-destructive upsert)...");

  // 1. Collect all Taparia /tp/ & /s/ URLs across pages 1..23
  const entryMap = new Map<string, { kind: "product" | "series"; slug: string; fallbackImg: string | null }>();

  for (let pageNo = 1; pageNo <= 25; pageNo++) {
    const html = await fetchHtmlWithRetry(`${BASE_URL}/store/taparia/all?pageNo=${pageNo}`);
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
    // Fallback regex without image if any item had null image
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

  console.log(`Discovered ${entryMap.size} Taparia catalog/series pages. Extracting items & images...`);

  const scrapedItems: ScrapedTapariaItem[] = [];
  const entries = [...entryMap.entries()];
  const CONCURRENCY = 10;

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const chunk = entries.slice(i, i + CONCURRENCY);
    const pagesHtml = await Promise.all(
      chunk.map(async ([url, meta]) => ({
        url,
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
        const bcs = (p.breadcrumbs || []).map((b: any) => String(b?.name || "").trim()).filter(Boolean);
        const specs: Array<{ label: string; value: string }> = [];
        for (const s of p.specifications || []) {
          if (s?.name && s?.value) {
            specs.push({
              label: decodeEntities(String(s.name).trim()),
              value: decodeEntities(String(s.value).trim()),
            });
          }
        }
        if (p.weight && p.weightUnit) {
          specs.push({ label: "Weight", value: `${p.weight} ${p.weightUnit}` });
        }

        scrapedItems.push({
          title: decodeEntities(String(p.title).trim()),
          modelNo: decodeEntities(String(p.modelNo || "").trim()),
          sizeText: "",
          slug: String(p.slug || meta.slug),
          imageUrl: imgs[0] || null,
          gallery: imgs.slice(1),
          description: plainDesc,
          specs,
          breadcrumbs: bcs,
          hsnCode: String(p.hsnCode || "").trim(),
          listPriceInr:
            typeof p.price?.listAmount === "number" && p.price.listAmount > 0
              ? p.price.listAmount
              : null,
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

        const bcs = (s.breadcrumbs || []).map((b: any) => String(b?.name || "").trim()).filter(Boolean);
        const seriesDescHtml = extractRscHtmlChunk(rsc, s.descriptionHtml);
        const seriesDesc = htmlToPlainText(seriesDescHtml);
        const seriesSpecs = (s.specifications || [])
          .filter((sp: any) => (sp?.label || sp?.name) && sp?.value)
          .map((sp: any) => ({
            label: decodeEntities(String(sp.label || sp.name).trim()),
            value: decodeEntities(String(sp.value).trim()),
          }));

        for (const v of s.products || []) {
          if (!v?.title) continue;
          const vImg = normalizeImageUrl(v.image?.url) || meta.fallbackImg;
          const attrEntries = Object.entries(v.attributes || {});
          const sizeText = attrEntries.map(([, val]) => String(val)).join(" ");
          const vSpecs = [...seriesSpecs];
          for (const [ak, av] of attrEntries) {
            if (!vSpecs.some((x) => x.label.toLowerCase() === ak.toLowerCase())) {
              vSpecs.push({ label: decodeEntities(ak), value: decodeEntities(String(av)) });
            }
          }
          for (const vs of v.specifications || []) {
            const lbl = decodeEntities(String(vs?.label || vs?.name || "").trim());
            const val = decodeEntities(String(vs?.value || "").trim());
            if (lbl && val && !vSpecs.some((x) => x.label.toLowerCase() === lbl.toLowerCase())) {
              vSpecs.push({ label: lbl, value: val });
            }
          }
          if (v.weight && v.weightUnit) {
            vSpecs.push({ label: "Weight", value: `${v.weight} ${v.weightUnit}` });
          }

          scrapedItems.push({
            title: decodeEntities(String(v.title).trim()),
            modelNo: decodeEntities(String(v.modelNo || "").trim()),
            sizeText,
            slug: String(v.slug || meta.slug),
            imageUrl: vImg,
            gallery: [],
            description: seriesDesc,
            specs: vSpecs,
            breadcrumbs: bcs,
            hsnCode: String(s.hsnCode || v.hsnCode || "").trim(),
            listPriceInr:
              typeof v.price?.listAmount === "number" && v.price.listAmount > 0
                ? v.price.listAmount
                : null,
            minQty: Number(v.minOrderQuantity) > 0 ? Number(v.minOrderQuantity) : 1,
          });
        }
      }
    }
  }

  console.log(`Extracted ${scrapedItems.length} Taparia product variants/items with images & specs.`);

  const brandId = await ensureTapariaBrand();
  const allCategories = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCategories) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };
  const defaultCat = catBySlug["tools-cutting-machining"];
  if (!defaultCat) throw new Error("Missing 'tools-cutting-machining' category in DB.");

  // Load ALL existing Taparia rows + all slugs/skus cleanly
  const allDbProducts = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      basePrice: products.basePrice,
      hsnCode: products.hsnCode,
      moq: products.moq,
      specificationsJson: products.specificationsJson,
      primaryImageUrl: products.primaryImageUrl,
      brandId: products.brandId,
    })
    .from(products);

  const takenSlugs = new Set(allDbProducts.map((r) => r.slug));
  const takenSkus = new Set(allDbProducts.map((r) => r.sku));

  const tapariaRows = allDbProducts.filter(
    (r) => r.brandId === brandId || r.sku.startsWith("TAP-")
  );

  type DbTapRow = (typeof tapariaRows)[number];
  const byExactNormCode = new Map<string, DbTapRow[]>();
  const bySeriesPrefix = new Map<string, DbTapRow[]>();

  for (const row of tapariaRows) {
    const rawPart = row.sku.replace(/^TAP-/i, "");
    const normFull = normAlphaNum(rawPart);
    if (!byExactNormCode.has(normFull)) byExactNormCode.set(normFull, []);
    byExactNormCode.get(normFull)!.push(row);

    // Also index series prefix (e.g. TAP-DEP-6X7 -> DEP, TAP-1441-5S -> 1441)
    const firstSeg = normAlphaNum(rawPart.split("-")[0] || "");
    if (firstSeg.length >= 2) {
      if (!bySeriesPrefix.has(firstSeg)) bySeriesPrefix.set(firstSeg, []);
      bySeriesPrefix.get(firstSeg)!.push(row);
    }
  }

  function findMatchingDbRow(item: ScrapedTapariaItem): DbTapRow | null {
    if (!item.modelNo) return null;
    const normModel = normAlphaNum(item.modelNo);
    const exactMatches = byExactNormCode.get(normModel);
    if (exactMatches && exactMatches.length === 1) {
      return exactMatches[0];
    }

    // Check shared-modelNo series (like DEP + size "6 x 7 mm", or HSM + "16 mm")
    const sizeTokens = item.sizeText
      .toLowerCase()
      .match(/\d+(?:\.\d+)?/g);
    const candidates = bySeriesPrefix.get(normModel) || exactMatches || [];
    if (candidates.length > 0 && sizeTokens && sizeTokens.length > 0) {
      let bestRow: DbTapRow | null = null;
      let bestScore = 0;
      for (const cand of candidates) {
        const hay = `${cand.sku} ${cand.name}`.toLowerCase();
        let score = 0;
        for (const tok of sizeTokens) {
          if (hay.includes(tok)) score++;
        }
        if (score === sizeTokens.length && score > bestScore) {
          bestScore = score;
          bestRow = cand;
        }
      }
      if (bestRow) return bestRow;
    }

    // Try combined model + sizeTokens normalized code (e.g. "HSM" + "12" -> "HSM12")
    if (sizeTokens && sizeTokens.length > 0) {
      const combined = normAlphaNum(`${item.modelNo}${sizeTokens.join("")}`);
      const cMatch = byExactNormCode.get(combined);
      if (cMatch && cMatch.length > 0) return cMatch[0];
    }
    return null;
  }

  const seriesImageMap = new Map<string, string>();
  const matchedIds = new Set<number>();
  let updatedCount = 0;
  const toInsert: Array<typeof products.$inferInsert> = [];

  for (const item of scrapedItems) {
    if (!item.modelNo) continue;
    const normModel = normAlphaNum(item.modelNo);
    if (item.imageUrl && normModel && !seriesImageMap.has(normModel)) {
      seriesImageMap.set(normModel, item.imageUrl);
    }

    const existingRow = findMatchingDbRow(item);
    if (existingRow) {
      if (matchedIds.has(existingRow.id)) continue;
      matchedIds.add(existingRow.id);

      let existingSpecs: Array<{ label: string; value: string }> = [];
      try {
        existingSpecs = JSON.parse(existingRow.specificationsJson || "[]");
      } catch {
        existingSpecs = [];
      }

      const mergedSpecs = [...existingSpecs];
      for (const sp of item.specs) {
        if (!mergedSpecs.some((x) => x.label.toLowerCase() === sp.label.toLowerCase())) {
          mergedSpecs.push(sp);
        }
      }

      const newDescription = item.description
        ? [
            item.description,
            "",
            "Before Ordering: Please verify exact tool size, drive/tip dimension, capacity rating, and standard pack quantity with our team before confirming your order.",
          ].join("\n")
        : existingRow.description;

      await db
        .update(products)
        .set({
          primaryImageUrl: item.imageUrl || existingRow.primaryImageUrl,
          galleryJson: item.gallery.length > 0 ? JSON.stringify(item.gallery) : undefined,
          description: newDescription,
          specificationsJson: JSON.stringify(mergedSpecs.slice(0, 14)),
          hsnCode: existingRow.hsnCode || item.hsnCode,
          brandId,
        })
        .where(eq(products.id, existingRow.id));
      updatedCount++;
      continue;
    }

    // New Taparia SKU not already in our April 2026 PDF list
    const sizePart = item.sizeText ? `-${normSkuHyphen(item.sizeText)}` : "";
    let dbSku = `TAP-${normSkuHyphen(item.modelNo)}${
      bySeriesPrefix.has(normModel) ? sizePart : ""
    }`;
    if (takenSkus.has(dbSku)) {
      dbSku = `TAP-${normSkuHyphen(item.modelNo)}${sizePart}`;
      let sfx = 2;
      while (takenSkus.has(dbSku)) {
        dbSku = `TAP-${normSkuHyphen(item.modelNo)}-${sfx++}`;
      }
    }
    takenSkus.add(dbSku);

    const targetSlugCat = mapCategorySlug(item.breadcrumbs, item.title);
    const targetCat = catBySlug[targetSlugCat] || defaultCat;
    const cleanShort = `${item.title} (Model: ${item.modelNo}). Confirm exact tool specifications and pack quantity before ordering.`
      .replace(/\s+/g, " ")
      .slice(0, 220);

    const fullDesc = [
      item.description || `${item.title} — genuine Taparia industrial hand tool.`,
      "",
      "Before Ordering: Please verify exact tool size, drive/tip dimension, capacity rating, and standard pack quantity with our team before confirming your order.",
    ].join("\n");

    const specs = [
      { label: "Brand", value: "Taparia" },
      { label: "Model / Product No.", value: item.modelNo },
      ...item.specs,
    ];

    let safeSlug = toSlug(`taparia-${item.slug || dbSku}`);
    if (takenSlugs.has(safeSlug)) {
      let sfx = 2;
      while (takenSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
      safeSlug = `${safeSlug}-${sfx}`;
    }
    takenSlugs.add(safeSlug);

    toInsert.push({
      slug: safeSlug,
      sku: dbSku,
      name: item.title,
      shortDescription: cleanShort,
      description: fullDesc,
      divisionId: targetCat.divisionId,
      categoryId: targetCat.id,
      brandId,
      pricingMode: "rfq_only",
      basePrice: item.listPriceInr,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: `${item.minQty} NOS`,
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

  // Series image backfill for remaining existing Taparia SKUs sharing the same series prefix (e.g. DEP, DER, 18, CS, etc.)
  let seriesBackfilledCount = 0;
  for (const row of tapariaRows) {
    if (matchedIds.has(row.id) || row.primaryImageUrl) continue;
    const rawPart = row.sku.replace(/^TAP-/i, "");
    const firstSeg = normAlphaNum(rawPart.split("-")[0] || "");
    const imgFallback =
      seriesImageMap.get(firstSeg) ||
      seriesImageMap.get(normAlphaNum(rawPart));
    if (imgFallback) {
      await db
        .update(products)
        .set({ primaryImageUrl: imgFallback })
        .where(eq(products.id, row.id));
      seriesBackfilledCount++;
    }
  }

  const CHUNK = 50;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    await db.insert(products).values(chunk);
    insertedCount += chunk.length;
  }

  const tapWithImgs = await db
    .select({ id: products.id, primaryImageUrl: products.primaryImageUrl })
    .from(products)
    .where(or(eq(products.brandId, brandId), like(products.sku, "TAP-%")));

  const totalAfter = await db.select({ id: products.id }).from(products);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        brandId,
        scrapedItemsTotal: scrapedItems.length,
        matchedAndUpdatedExistingTaparia: updatedCount,
        seriesImageBackfilledTaparia: seriesBackfilledCount,
        insertedNewTapariaProducts: insertedCount,
        totalTapariaProductsNow: tapWithImgs.length,
        totalTapariaWithImagesNow: tapWithImgs.filter((r) => Boolean(r.primaryImageUrl)).length,
        totalCatalogProductsAfter: totalAfter.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to sync Taparia catalog:", err);
  process.exit(1);
});
