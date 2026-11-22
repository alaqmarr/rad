import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db, ensureDbReady, divisions, categories, brands, products } from "@/db";
import { getSiteSettings } from "@/lib/settings";
import { buildAbsoluteUrl, getDetectedSiteOrigin } from "@/lib/seo";
import { htmlToCleanText } from "@/lib/sanitize-text";
import {
  buildEnrichedSpecifications,
  extractKeySpecHighlights,
  extractManufacturerPartNumber,
  extractReferencedPartCodes,
  getOrderingGuidance,
  parseSpecsJson,
} from "@/lib/product-enrichment";
import { getCategoryProcurementGuide } from "@/lib/category-guides";

export type CatalogueScope = "master" | "category" | "brand" | "product";
export type CatalogueLayout = "cards" | "linesheet";

export interface CatalogueBuildParams {
  scope: CatalogueScope;
  slug?: string;
  layout?: CatalogueLayout;
  includeImages?: boolean;
  showPrices?: boolean;
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
  preparedFor?: string;
  originOverride?: string;
  autoPrint?: boolean;
}

const dataUriCache = new Map<string, string | null>();
const remoteImgCache = new Map<string, string | null>();

function assetToDataUri(publicRelPath: string | null | undefined): string | null {
  if (!publicRelPath) return null;
  const trimmed = publicRelPath.trim();
  if (!trimmed.startsWith("/")) return null;
  if (dataUriCache.has(trimmed)) return dataUriCache.get(trimmed) ?? null;

  try {
    const absPath = path.join(process.cwd(), "public", trimmed.replace(/^\/+/, ""));
    if (!fs.existsSync(absPath)) {
      dataUriCache.set(trimmed, null);
      return null;
    }
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(absPath).toLowerCase();
    const mime =
      ext === ".svg"
        ? "image/svg+xml"
        : ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
    const uri = `data:${mime};base64,${buf.toString("base64")}`;
    dataUriCache.set(trimmed, uri);
    return uri;
  } catch {
    dataUriCache.set(trimmed, null);
    return null;
  }
}

async function resolveImageForPrint(
  rawUrl: string | null | undefined,
  origin: string,
  inlineRemote: boolean
): Promise<string | null> {
  if (!rawUrl || !rawUrl.trim()) return null;
  const abs = buildAbsoluteUrl(origin, rawUrl);
  if (rawUrl.trim().startsWith("/")) {
    return assetToDataUri(rawUrl.trim()) || abs;
  }
  if (!inlineRemote || !/^https?:\/\//i.test(abs)) {
    return abs;
  }
  if (remoteImgCache.has(abs)) {
    return remoteImgCache.get(abs) || abs;
  }
  try {
    const res = await fetch(abs, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      remoteImgCache.set(abs, null);
      return abs;
    }
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!ct.startsWith("image/")) {
      remoteImgCache.set(abs, null);
      return abs;
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > 1_500_000) {
      remoteImgCache.set(abs, null);
      return abs;
    }
    const dataUri = `data:${ct};base64,${Buffer.from(ab).toString("base64")}`;
    remoteImgCache.set(abs, dataUri);
    return dataUri;
  } catch {
    remoteImgCache.set(abs, null);
    return abs;
  }
}

function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeId(prefix: string, raw: string): string {
  return `${prefix}-${raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;
}

function formatReadableDescription(raw: string, fallback: string, cleanName: string): string {
  let cleaned = htmlToCleanText(raw, false)
    .replace(/\r\n/g, "\n")
    // Remove conversational web-widget prompts & trailing FAQs from imported vendor pages
    .replace(/\n*Before Ordering:[\s\S]*$/i, "")
    .replace(/\n*Buy 3M[^\n]*\n[\s\S]*?(?=\n*Frequently asked questions|$)/gi, "\n")
    .replace(/\n*Tell us the model,[^\n]*Get a quote button[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/\n*Frequently asked questions[\s\S]*$/i, "")
    .replace(/\n*Is the price final\?[\s\S]*$/i, "")
    .replace(/\n*Need training for your team\?[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    cleaned = htmlToCleanText(fallback, false).trim();
  }
  if (!cleaned) return "";

  // Strip duplicate title echo if first line repeats cleanName
  const lines = cleaned.split("\n").map((l) => l.trimEnd());
  if (
    lines.length > 1 &&
    lines[0].trim().toLowerCase() === cleanName.trim().toLowerCase()
  ) {
    lines.shift();
  }
  return lines.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function getCatalogueScopeCount(params: {
  scope: CatalogueScope;
  slug?: string;
  featuredOnly?: boolean;
}): Promise<number> {
  await ensureDbReady();
  const conds = [eq(products.isActive, true)];
  if (params.featuredOnly) conds.push(eq(products.isFeatured, true));

  if (params.scope === "category" && params.slug) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, params.slug))
      .limit(1);
    if (!cat) return 0;
    conds.push(eq(products.categoryId, cat.id));
  } else if (params.scope === "brand" && params.slug) {
    const [br] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, params.slug))
      .limit(1);
    if (!br) return 0;
    conds.push(eq(products.brandId, br.id));
  } else if (params.scope === "product" && params.slug) {
    conds.push(eq(products.slug, params.slug));
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(...conds));
  return Number(row?.count || 0);
}

export async function buildBrandedCatalogueHtml(params: CatalogueBuildParams): Promise<{
  html: string;
  filename: string;
  totalMatching: number;
  renderedCount: number;
  title: string;
}> {
  await ensureDbReady();
  const settings = await getSiteSettings();
  const origin = params.originOverride || (await getDetectedSiteOrigin(settings));
  const companyName = settings["company_name"] || "Radiant Industrial Co.";
  const companyTagline =
    settings["company_tagline"] || "Powering Progress, from Field to Factory.";
  const companyPhone = settings["contact_phone"] || "+91 8522095253";
  const companyEmail = settings["contact_email"] || "info@radiantindustrial.in";
  const companyAddress =
    settings["contact_address"] ||
    "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India";
  const companyGstin = settings["gstin"] || "";
  const whatsappNumber = (settings["whatsapp_number"] || "918522095253").replace(/[^0-9]/g, "");

  const layout: CatalogueLayout = params.layout === "linesheet" ? "linesheet" : "cards";
  const includeImages = params.includeImages !== false;
  const showPrices = params.showPrices ?? settings["show_public_prices"] === "true";

  // True transparent PNG logos (no white opaque box background!)
  const transparentLongLogo =
    assetToDataUri("/logos/logo-long.png") ||
    assetToDataUri("/logos/logo-full.png") ||
    buildAbsoluteUrl(origin, "/logos/logo-long.png");
  const transparentShortLogo =
    assetToDataUri("/logos/logo-short.png") ||
    transparentLongLogo;

  const conds = [eq(products.isActive, true)];
  if (params.featuredOnly) conds.push(eq(products.isFeatured, true));

  let targetBrand: typeof brands.$inferSelect | null = null;
  let targetCategory: typeof categories.$inferSelect | null = null;
  let targetDivision: typeof divisions.$inferSelect | null = null;

  if (params.scope === "brand") {
    if (!params.slug) throw new Error("Brand slug is required for brand catalogue export.");
    const [b] = await db.select().from(brands).where(eq(brands.slug, params.slug)).limit(1);
    if (!b) throw new Error(`Brand not found: ${params.slug}`);
    targetBrand = b;
    conds.push(eq(products.brandId, b.id));
  } else if (params.scope === "category") {
    if (!params.slug) throw new Error("Category slug is required for category catalogue export.");
    const [c] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, params.slug))
      .limit(1);
    if (!c) throw new Error(`Category not found: ${params.slug}`);
    targetCategory = c;
    const [d] = await db
      .select()
      .from(divisions)
      .where(eq(divisions.id, c.divisionId))
      .limit(1);
    targetDivision = d || null;
    conds.push(eq(products.categoryId, c.id));
  } else if (params.scope === "product") {
    if (!params.slug) throw new Error("Product slug is required for individual product datasheet.");
    conds.push(or(eq(products.slug, params.slug), eq(products.sku, params.slug))!);
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(...conds));
  const totalMatching = Number(countRow?.count || 0);

  const safeLimit =
    params.limit && params.limit > 0
      ? Math.min(params.limit, 3000)
      : params.scope === "product"
      ? 1
      : params.scope === "master"
      ? 1200
      : 2000;
  const safeOffset = Math.max(0, params.offset || 0);

  const rows = await db
    .select({
      product: products,
      division: divisions,
      category: categories,
      brand: brands,
    })
    .from(products)
    .leftJoin(divisions, eq(products.divisionId, divisions.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(and(...conds))
    .orderBy(
      asc(divisions.sortOrder),
      asc(categories.sortOrder),
      asc(brands.name),
      desc(products.isFeatured),
      asc(products.name)
    )
    .limit(safeLimit)
    .offset(safeOffset);

  if (params.scope === "product" && rows.length === 0) {
    throw new Error(`Product not found: ${params.slug}`);
  }

  // Resolve and inline product images in parallel for catalogues <= 80 items (100% immune to Chrome lazy-print/CORS failures!)
  const resolvedProductImages = new Map<number, string | null>();
  if (includeImages && rows.length > 0) {
    const shouldInlineRemote = rows.length <= 80;
    const CONCURRENCY = 10;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (r) => {
          const uri = await resolveImageForPrint(
            r.product.primaryImageUrl,
            origin,
            shouldInlineRemote
          );
          resolvedProductImages.set(r.product.id, uri);
        })
      );
    }
  }

  // Compatible products lookup (for single datasheet and compact sets <= 60 SKUs)
  const compatMap = new Map<
    number,
    Array<{ product: typeof products.$inferSelect; brandName: string | null }>
  >();

  if (rows.length <= 60) {
    for (const r of rows) {
      const rawSpecs = parseSpecsJson(r.product.specificationsJson);
      const mpn = extractManufacturerPartNumber(r.product.sku, rawSpecs);
      const codes = extractReferencedPartCodes(r.product, mpn);
      if (codes.length === 0) continue;
      const codeConds = codes.slice(0, 6).map((c) => {
        const u = c.toUpperCase();
        return or(
          sql`upper(${products.sku}) = ${u}`,
          sql`upper(${products.sku}) LIKE ${`%-${u}`}`,
          sql`upper(${products.sku}) LIKE ${`%-${u}*`}`
        );
      });
      const matches = await db
        .select({ product: products, brandName: brands.name })
        .from(products)
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(
          and(
            eq(products.isActive, true),
            sql`${products.id} != ${r.product.id}`,
            ...(r.product.brandId ? [eq(products.brandId, r.product.brandId)] : []),
            or(...codeConds)
          )
        )
        .limit(6);
      if (matches.length > 0) {
        compatMap.set(r.product.id, matches);
      }
    }
  }

  const slugSetInCatalogue = new Set(rows.map((r) => r.product.slug));

  const partSuffix =
    totalMatching > safeLimit
      ? ` — Part ${Math.floor(safeOffset / safeLimit) + 1} (${safeOffset + 1}–${Math.min(
          safeOffset + rows.length,
          totalMatching
        )} of ${totalMatching.toLocaleString("en-IN")})`
      : "";

  const docTitle =
    params.scope === "brand" && targetBrand
      ? `${targetBrand.name} Product Catalogue`
      : params.scope === "category" && targetCategory
      ? `${targetCategory.name} Catalogue`
      : params.scope === "product" && rows[0]
      ? `${htmlToCleanText(rows[0].product.name, true) || rows[0].product.name} — Technical Datasheet`
      : `Master Industrial & Agricultural Supply Catalogue${params.featuredOnly ? " (Featured Edition)" : ""}`;

  const fullDocTitle = `${docTitle}${partSuffix}`;
  const editionYear = new Date().getFullYear();
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  interface SectionGroup {
    anchorId: string;
    title: string;
    subtitle: string;
    divisionName: string;
    brandLogoUri: string | null;
    brandOrigin?: string;
    sourcingNote?: string;
    items: typeof rows;
  }

  const sections: SectionGroup[] = [];
  if (params.scope === "brand" && targetBrand) {
    const byCat = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.category?.slug || "general";
      const arr = byCat.get(key) || [];
      arr.push(r);
      byCat.set(key, arr);
    }
    const brandLogoUri =
      assetToDataUri(targetBrand.logoUrl) ||
      (targetBrand.logoUrl ? buildAbsoluteUrl(origin, targetBrand.logoUrl) : null);
    for (const [catSlug, items] of byCat.entries()) {
      const cat = items[0].category;
      const div = items[0].division;
      sections.push({
        anchorId: safeId("cat", catSlug),
        title: cat?.name || "Product Portfolio",
        subtitle: cat?.description || `${targetBrand.name} industrial models`,
        divisionName: div?.name || "Industrial Supply",
        brandLogoUri,
        brandOrigin: targetBrand.countryOfOrigin,
        sourcingNote:
          targetBrand.sourcingType === "authorized"
            ? "Authorized Supply Partner"
            : `Independent B2B Wholesale Supply (${targetBrand.name})`,
        items,
      });
    }
  } else if (params.scope === "category" && targetCategory) {
    const byBrand = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.brand?.slug || "multi-brand";
      const arr = byBrand.get(key) || [];
      arr.push(r);
      byBrand.set(key, arr);
    }
    for (const [brSlug, items] of byBrand.entries()) {
      const br = items[0].brand;
      const brandLogoUri =
        (br?.logoUrl ? assetToDataUri(br.logoUrl) : null) ||
        (br?.logoUrl ? buildAbsoluteUrl(origin, br.logoUrl) : null);
      sections.push({
        anchorId: safeId("brand", brSlug),
        title: br?.name || "Multi-Brand Sourcing",
        subtitle: br?.description || `${targetCategory.name} models`,
        divisionName: targetDivision?.name || targetCategory.name,
        brandLogoUri,
        brandOrigin: br?.countryOfOrigin,
        items,
      });
    }
  } else if (params.scope === "master") {
    const byCat = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.category?.slug || "general";
      const arr = byCat.get(key) || [];
      arr.push(r);
      byCat.set(key, arr);
    }
    for (const [catSlug, items] of byCat.entries()) {
      const cat = items[0].category;
      const div = items[0].division;
      sections.push({
        anchorId: safeId("cat", catSlug),
        title: cat?.name || "Industrial Supply",
        subtitle: cat?.description || "",
        divisionName: div?.name || "Radiant Catalog",
        brandLogoUri: null,
        items,
      });
    }
  }

  const targetBrandLogoUri =
    targetBrand?.logoUrl
      ? assetToDataUri(targetBrand.logoUrl) || buildAbsoluteUrl(origin, targetBrand.logoUrl)
      : null;

  const categoryGuide =
    params.scope === "category" && targetCategory
      ? getCategoryProcurementGuide(targetCategory.slug)
      : null;

  const makeProductWebUrl = (slug: string) => buildAbsoluteUrl(origin, `/products/${slug}`);
  const makeWaQuoteUrl = (name: string, sku: string) =>
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      `Hello ${companyName}, please share B2B GST quotation & delivery schedule for ${name} (SKU: ${sku}).`
    )}`;
  const makeMailQuoteUrl = (name: string, sku: string) =>
    `mailto:${companyEmail}?subject=${encodeURIComponent(
      `RFQ Enquiry: ${name} (${sku})`
    )}&body=${encodeURIComponent(
      `Hello ${companyName} Team,\n\nPlease share GST quotation and dispatch schedule for:\nProduct: ${name}\nSKU: ${sku}\nQuantity: `
    )}`;

  let globalItemIdx = 0;

  const renderEditorialProductEntry = (r: (typeof rows)[number]) => {
    globalItemIdx += 1;
    const p = r.product;
    const rawSpecs = parseSpecsJson(p.specificationsJson);
    const cleanName = htmlToCleanText(p.name, true) || p.name;
    const cleanShort = htmlToCleanText(p.shortDescription, true);
    const mpn = extractManufacturerPartNumber(p.sku, rawSpecs);
    const fullDesc = formatReadableDescription(p.description, cleanShort, cleanName);
    const specs = buildEnrichedSpecifications(
      {
        name: cleanName,
        sku: p.sku,
        shortDescription: cleanShort,
        description: fullDesc,
        hsnCode: p.hsnCode,
      },
      rawSpecs,
      mpn
    );
    const guidance = getOrderingGuidance({
      categorySlug: r.category?.slug,
      brandSlug: r.brand?.slug,
      mpn,
    });
    const compatItems = compatMap.get(p.id) || [];
    const imgSrc = includeImages ? resolvedProductImages.get(p.id) || null : null;
    const priceText =
      showPrices && p.pricingMode === "priced" && p.basePrice != null
        ? `₹${Number(p.basePrice).toLocaleString("en-IN")} / ${p.priceUnit} (+${p.gstPercent}% GST)`
        : "Quote Confirmed Upon Enquiry";
    const prodAnchor = safeId("prod", p.slug);
    const webUrl = makeProductWebUrl(p.slug);

    return `
      <article id="${escHtml(prodAnchor)}" class="entry-card">
        <div class="entry-head">
          <div class="entry-head-left">
            <span class="entry-num">#${String(globalItemIdx).padStart(2, "0")}</span>
            <span class="entry-mpn">MPN: ${escHtml(mpn)}</span>
            <span class="entry-sku">SKU: ${escHtml(p.sku)}</span>
            ${p.hsnCode ? `<span class="entry-hsn">HSN: ${escHtml(p.hsnCode)}</span>` : ""}
          </div>
          <div class="entry-head-right">
            <span>${escHtml(r.brand?.name || companyName)}</span>
            ${r.brand?.countryOfOrigin ? `<span>• Origin: ${escHtml(r.brand.countryOfOrigin)}</span>` : ""}
            <a href="#index" class="quiet-jump">↑ Index</a>
          </div>
        </div>

        <div class="entry-body ${imgSrc ? "with-media" : "no-media"}">
          ${
            imgSrc
              ? `<div class="entry-media">
                  <div class="entry-img-frame">
                    <img src="${escHtml(imgSrc)}" alt="${escHtml(cleanName)}" loading="eager" decoding="sync" referrerpolicy="no-referrer" />
                  </div>
                  <div class="media-actions">
                    <a href="${escHtml(webUrl)}" target="_blank" rel="noopener">Product Page ↗</a>
                    <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener">WhatsApp RFQ ↗</a>
                    <a href="${escHtml(makeMailQuoteUrl(cleanName, p.sku))}">Email Enquiry ↗</a>
                  </div>
                </div>`
              : ""
          }

          <div class="entry-details">
            <h3 class="entry-title"><a href="${escHtml(webUrl)}" target="_blank" rel="noopener">${escHtml(cleanName)}</a></h3>
            <div class="entry-cat-line">${escHtml(r.division?.name || "")}${r.category ? ` › ${escHtml(r.category.name)}` : ""}</div>

            ${fullDesc ? `<div class="entry-desc">${escHtml(fullDesc)}</div>` : ""}

            ${
              specs.length > 0
                ? `<div class="entry-specs-wrap">
                    <div class="sub-label">Technical Specifications</div>
                    <table class="entry-specs">
                      <tbody>
                        ${specs
                          .map(
                            (s) =>
                              `<tr><th>${escHtml(s.label)}</th><td class="mono">${escHtml(s.value)}</td></tr>`
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>`
                : ""
            }

            ${
              compatItems.length > 0
                ? `<div class="entry-compat">
                    <span class="sub-label-inline">Compatible Accessories &amp; Companion Models:</span>
                    ${compatItems
                      .map((cp) => {
                        const cpMpn = extractManufacturerPartNumber(
                          cp.product.sku,
                          parseSpecsJson(cp.product.specificationsJson)
                        );
                        const href = slugSetInCatalogue.has(cp.product.slug)
                          ? `#${safeId("prod", cp.product.slug)}`
                          : makeProductWebUrl(cp.product.slug);
                        return `<a href="${escHtml(href)}" class="compat-chip">${escHtml(cpMpn)}</a>`;
                      })
                      .join(" ")}
                  </div>`
                : ""
            }

            <div class="entry-ordering">
              <strong>Procurement Verification:</strong> ${escHtml(guidance.checklist[0])}
            </div>
          </div>
        </div>

        <div class="entry-foot">
          <div><span>MOQ:</span> <strong>${escHtml(p.moq)}</strong></div>
          <div><span>Unit:</span> <strong>${escHtml(p.priceUnit)}</strong></div>
          <div><span>Lead Time:</span> <strong>${escHtml(p.leadTime)}</strong></div>
          <div><span>Pricing:</span> <strong>${escHtml(priceText)}</strong></div>
          ${
            !imgSrc
              ? `<div class="foot-links">
                  <a href="${escHtml(webUrl)}" target="_blank" rel="noopener">Page ↗</a> •
                  <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener">WhatsApp RFQ ↗</a>
                </div>`
              : ""
          }
        </div>
      </article>
    `;
  };

  const renderLineSheetTable = (items: typeof rows) => {
    const trHtml = items
      .map((r) => {
        globalItemIdx += 1;
        const p = r.product;
        const rawSpecs = parseSpecsJson(p.specificationsJson);
        const cleanName = htmlToCleanText(p.name, true) || p.name;
        const mpn = extractManufacturerPartNumber(p.sku, rawSpecs);
        const specs = buildEnrichedSpecifications(
          {
            name: cleanName,
            sku: p.sku,
            shortDescription: htmlToCleanText(p.shortDescription, true),
            description: htmlToCleanText(p.description, false),
            hsnCode: p.hsnCode,
          },
          rawSpecs,
          mpn
        );
        const keySpec = extractKeySpecHighlights(specs)
          .slice(0, 3)
          .map((s) => `${s.label}: ${s.value}`)
          .join(" • ");
        const priceText =
          showPrices && p.pricingMode === "priced" && p.basePrice != null
            ? `₹${Number(p.basePrice).toLocaleString("en-IN")} / ${p.priceUnit}`
            : "On Request";
        const prodAnchor = safeId("prod", p.slug);
        const webUrl = makeProductWebUrl(p.slug);
        return `
          <tr id="${escHtml(prodAnchor)}">
            <td class="mono muted">${String(globalItemIdx).padStart(2, "0")}</td>
            <td class="mono bold">${escHtml(mpn)}<div class="muted-small">${escHtml(p.sku)}</div></td>
            <td>
              <a href="${escHtml(webUrl)}" target="_blank" rel="noopener" class="row-link">${escHtml(cleanName)}</a>
              ${keySpec ? `<div class="muted-small">${escHtml(keySpec)}</div>` : ""}
            </td>
            <td>${escHtml(r.brand?.name || "—")}</td>
            <td class="mono">${escHtml(p.hsnCode || "—")}</td>
            <td class="mono">${escHtml(p.moq)}</td>
            <td class="mono bold">${escHtml(priceText)}</td>
            <td class="no-wrap">
              <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener" class="tbl-cta">Enquire ↗</a>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <table class="linesheet">
        <thead>
          <tr>
            <th style="width:32px;">#</th>
            <th style="width:125px;">MPN / SKU</th>
            <th>Model Description &amp; Verified Specifications</th>
            <th style="width:95px;">Brand</th>
            <th style="width:65px;">HSN</th>
            <th style="width:60px;">MOQ</th>
            <th style="width:85px;">Rate</th>
            <th style="width:60px;">RFQ</th>
          </tr>
        </thead>
        <tbody>${trHtml}</tbody>
      </table>
    `;
  };

  const renderSingleProductDatasheet = () => {
    const r = rows[0];
    const p = r.product;
    const rawSpecs = parseSpecsJson(p.specificationsJson);
    const cleanName = htmlToCleanText(p.name, true) || p.name;
    const cleanShort = htmlToCleanText(p.shortDescription, true);
    const fullDesc = formatReadableDescription(p.description, cleanShort, cleanName);
    const mpn = extractManufacturerPartNumber(p.sku, rawSpecs);
    const specs = buildEnrichedSpecifications(
      {
        name: cleanName,
        sku: p.sku,
        shortDescription: cleanShort,
        description: fullDesc,
        hsnCode: p.hsnCode,
      },
      rawSpecs,
      mpn
    );
    const highlights = extractKeySpecHighlights(specs);
    const guidance = getOrderingGuidance({
      categorySlug: r.category?.slug,
      brandSlug: r.brand?.slug,
      mpn,
    });
    const compatItems = compatMap.get(p.id) || [];
    const imgSrc = includeImages ? resolvedProductImages.get(p.id) || null : null;
    const brandLogoUri =
      r.brand?.logoUrl
        ? assetToDataUri(r.brand.logoUrl) || buildAbsoluteUrl(origin, r.brand.logoUrl)
        : null;
    const priceText =
      showPrices && p.pricingMode === "priced" && p.basePrice != null
        ? `₹${Number(p.basePrice).toLocaleString("en-IN")} / ${p.priceUnit} (+${p.gstPercent}% GST)`
        : "Formal GST Quotation Upon Enquiry";
    const webUrl = makeProductWebUrl(p.slug);

    return `
      <section id="${escHtml(safeId("prod", p.slug))}" class="datasheet-wrap">
        <div class="ds-top-strip">
          <div style="min-width:0;flex:1;">
            <div class="ds-eyebrow">TECHNICAL SPECIFICATION &amp; PROCUREMENT DATASHEET</div>
            <h2 class="ds-h2">${escHtml(cleanName)}</h2>
            <div class="ds-meta-line">
              <strong>MPN:</strong> <span class="mono">${escHtml(mpn)}</span> &nbsp;|&nbsp;
              <strong>SKU:</strong> <span class="mono">${escHtml(p.sku)}</span> &nbsp;|&nbsp;
              <strong>Brand:</strong> ${escHtml(r.brand?.name || companyName)}
              ${p.hsnCode ? ` &nbsp;|&nbsp; <strong>HSN:</strong> <span class="mono">${escHtml(p.hsnCode)}</span>` : ""}
            </div>
          </div>
          ${brandLogoUri ? `<img src="${escHtml(brandLogoUri)}" alt="${escHtml(r.brand?.name || "")}" class="ds-brand-logo" />` : ""}
        </div>

        <div class="ds-split">
          <div class="ds-left">
            ${cleanShort ? `<p class="ds-lead">${escHtml(cleanShort)}</p>` : ""}
            ${
              highlights.length > 0
                ? `<div class="ds-hl-grid">${highlights
                    .map(
                      (h) =>
                        `<div class="ds-hl-box"><span>${escHtml(h.label)}</span><strong>${escHtml(
                          h.value
                        )}</strong></div>`
                    )
                    .join("")}</div>`
                : ""
            }
            ${
              fullDesc
                ? `<div class="ds-section-block">
                    <h3>Engineering Overview &amp; Application</h3>
                    <div class="entry-desc">${escHtml(fullDesc)}</div>
                  </div>`
                : ""
            }
          </div>

          <div class="ds-right">
            ${
              imgSrc
                ? `<div class="ds-photo-box"><img src="${escHtml(imgSrc)}" alt="${escHtml(cleanName)}" loading="eager" decoding="sync" referrerpolicy="no-referrer" /></div>`
                : ""
            }
            <div class="ds-commercial-card">
              <div class="dcc-row"><span>Minimum Order Qty</span><strong>${escHtml(p.moq)}</strong></div>
              <div class="dcc-row"><span>Unit of Measure</span><strong>${escHtml(p.priceUnit)}</strong></div>
              <div class="dcc-row"><span>Lead Time</span><strong>${escHtml(p.leadTime)}</strong></div>
              <div class="dcc-row"><span>Commercial Rate</span><strong>${escHtml(priceText)}</strong></div>
              <div class="dcc-actions">
                <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener" class="btn-solid">WhatsApp Quote ↗</a>
                <a href="${escHtml(makeMailQuoteUrl(cleanName, p.sku))}" class="btn-outline">Email RFQ ↗</a>
                <a href="${escHtml(webUrl)}" target="_blank" rel="noopener" class="btn-outline">Online Listing ↗</a>
              </div>
            </div>
          </div>
        </div>

        <div class="ds-bottom-grid">
          <div class="ds-section-block">
            <h3>Verified Technical Specifications</h3>
            <table class="entry-specs">
              <tbody>
                ${specs
                  .map(
                    (s) => `<tr><th>${escHtml(s.label)}</th><td class="mono">${escHtml(s.value)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <div class="ds-section-block">
            <h3>${escHtml(guidance.title)}</h3>
            <ul class="guide-ul">${guidance.checklist.map((c) => `<li>${escHtml(c)}</li>`).join("")}</ul>
            ${
              compatItems.length > 0
                ? `<h3 style="margin-top:16px;">Compatible Accessories &amp; Companion Models</h3>
                   <div class="compat-stack">
                     ${compatItems
                       .map((cp) => {
                         const cpMpn = extractManufacturerPartNumber(
                           cp.product.sku,
                           parseSpecsJson(cp.product.specificationsJson)
                         );
                         return `<a href="${escHtml(
                           makeProductWebUrl(cp.product.slug)
                         )}" target="_blank" rel="noopener" class="compat-line">
                           <strong class="mono">${escHtml(cpMpn)}</strong>
                           <span>${escHtml(htmlToCleanText(cp.product.name, true) || cp.product.name)}</span>
                           <span>↗</span>
                         </a>`;
                       })
                       .join("")}
                   </div>`
                : ""
            }
          </div>
        </div>
      </section>
    `;
  };

  const sectionTocRows =
    params.scope === "product"
      ? `<li><a href="#${escHtml(safeId("prod", rows[0].product.slug))}"><span class="toc-left">01. Technical Specification &amp; Commercial Sheet — ${escHtml(
          rows[0].product.sku
        )}</span><span class="toc-dots"></span><span class="toc-go">Section 01 →</span></a></li>`
      : sections
          .map(
            (sec, idx) =>
              `<li><a href="#${escHtml(sec.anchorId)}"><span class="toc-left">${String(
                idx + 1
              ).padStart(2, "0")}. ${escHtml(sec.title)} <em class="toc-sub">(${escHtml(
                sec.divisionName
              )})</em></span><span class="toc-dots"></span><span class="toc-go">${sec.items.length} Models →</span></a></li>`
          )
          .join("");

  const partNumberIndexHtml =
    rows.length > 1 && rows.length <= 1500
      ? `<div class="part-index-wrap">
          <h3>Part Number &amp; Model Directory (Quick Jump Index)</h3>
          <p class="idx-note">Select any model or MPN below to jump directly to its detailed specification entry.</p>
          <div class="part-index-grid">
            ${rows
              .map((r) => {
                const specs = parseSpecsJson(r.product.specificationsJson);
                const mpn = extractManufacturerPartNumber(r.product.sku, specs);
                const cleanName = htmlToCleanText(r.product.name, true) || r.product.name;
                return `<a href="#${escHtml(safeId("prod", r.product.slug))}" class="pi-item">
                  <span class="pi-mpn mono">${escHtml(mpn)}</span>
                  <span class="pi-name">${escHtml(cleanName)}</span>
                </a>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

  const categoryGuideHtml =
    categoryGuide && params.scope === "category"
      ? `
        <section id="category-guide" class="guide-section">
          <div class="section-bar">
            <div>
              <div class="sb-kicker">${escHtml(categoryGuide.badgeLabel)}</div>
              <h2 class="sb-title">${escHtml(categoryGuide.introHeadline)}</h2>
            </div>
            <div class="sb-links"><a href="#preface">↑ Preface</a><a href="#index">↑ Index</a></div>
          </div>
          <p class="guide-intro">${escHtml(categoryGuide.introSummary)}</p>

          ${
            categoryGuide.types.length > 0
              ? `<div class="guide-types-grid">${categoryGuide.types
                  .map(
                    (t) => `<div class="gt-card">
                      <div class="gt-head"><strong>${escHtml(t.name)}</strong><span>${escHtml(
                        t.standard
                      )}</span></div>
                      <div class="gt-spec">${escHtml(t.specRange)}</div>
                      <p>${escHtml(t.summary)}</p>
                      ${
                        t.modelSlugs.length > 0
                          ? `<div class="gt-models">Models: ${t.modelSlugs
                              .map((ms) => {
                                const href = slugSetInCatalogue.has(ms)
                                  ? `#${safeId("prod", ms)}`
                                  : makeProductWebUrl(ms);
                                const lbl = ms.split("-").slice(-2).join("-").toUpperCase();
                                return `<a href="${escHtml(href)}">${escHtml(lbl)}</a>`;
                              })
                              .join(" ")}</div>`
                          : ""
                      }
                    </div>`
                  )
                  .join("")}</div>`
              : ""
          }

          ${
            categoryGuide.sizingRows.length > 0
              ? `<h3 class="sub-h3">${escHtml(categoryGuide.sizingTitle)}</h3>
                 <table class="linesheet">
                   <thead><tr>${categoryGuide.sizingColumns
                     .map((c) => `<th>${escHtml(c)}</th>`)
                     .join("")}</tr></thead>
                   <tbody>${categoryGuide.sizingRows
                     .map(
                       (sr) => `<tr>
                         <td class="mono bold">${escHtml(sr.series)}</td>
                         <td>${escHtml(sr.standard)}</td>
                         <td class="mono">${escHtml(sr.boresOrRange)}</td>
                         <td class="mono">${escHtml(sr.strokeOrVariant)}</td>
                         <td>${escHtml(sr.cushioningOrRating)}</td>
                         <td>${escHtml(sr.portsOrNotes)}</td>
                       </tr>`
                     )
                     .join("")}</tbody>
                 </table>`
              : ""
          }
        </section>
      `
      : "";

  const sectionsHtml =
    params.scope === "product"
      ? renderSingleProductDatasheet()
      : sections
          .map(
            (sec, idx) => `
          <section id="${escHtml(sec.anchorId)}" class="cat-section">
            <div class="section-bar">
              <div style="min-width:0;flex:1;">
                <div class="sb-kicker">SECTION ${String(idx + 1).padStart(2, "0")} • ${escHtml(
                  sec.divisionName
                )}</div>
                <h2 class="sb-title">${escHtml(sec.title)}</h2>
                ${sec.subtitle ? `<div class="sb-sub">${escHtml(sec.subtitle)}</div>` : ""}
                ${
                  sec.sourcingNote
                    ? `<div class="sb-note">${escHtml(sec.sourcingNote)}${
                        sec.brandOrigin ? ` • Origin: ${escHtml(sec.brandOrigin)}` : ""
                      }</div>`
                    : ""
                }
              </div>
              <div class="sb-right">
                ${
                  sec.brandLogoUri
                    ? `<div class="sb-logo"><img src="${escHtml(sec.brandLogoUri)}" alt="${escHtml(
                        sec.title
                      )}" loading="eager" decoding="sync" /></div>`
                    : ""
                }
                <div class="sb-links">
                  <a href="#preface">Preface</a>
                  <a href="#index">Index</a>
                  <a href="#terms">Terms</a>
                </div>
              </div>
            </div>

            ${
              layout === "linesheet"
                ? renderLineSheetTable(sec.items)
                : `<div class="entries-stack">${sec.items.map(renderEditorialProductEntry).join("")}</div>`
            }
          </section>
        `
          )
          .join("");

  const slugPart = params.slug ? `-${params.slug}` : "";
  const volPart =
    totalMatching > safeLimit ? `-part-${Math.floor(safeOffset / safeLimit) + 1}` : "";
  const filename = `radiant-${params.scope}-catalogue${slugPart}${volPart}.html`.replace(
    /[^a-z0-9._-]+/gi,
    "-"
  );

  const rawPdfBase =
    params.scope === "product" && rows[0]
      ? `Radiant - ${rows[0].product.sku.replace(/\*/g, "")} - ${(
          htmlToCleanText(rows[0].product.name, true) || rows[0].product.name
        )
          .replace(/\*/g, "")
          .slice(0, 65)} Datasheet`
      : `Radiant - ${docTitle}${
          totalMatching > safeLimit ? ` Part ${Math.floor(safeOffset / safeLimit) + 1}` : ""
        }`;
  const defaultPdfTitle = rawPdfBase
    .replace(/[*?"<>|]+/g, "")
    .replace(/[\/\\:]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(defaultPdfTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    @page :first {
      margin: 0;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html { scroll-behavior: smooth; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #141A21; background: #EAEAE4; }
    body { margin: 0; padding: 0; font-size: 11px; line-height: 1.48; }
    a { color: inherit; text-decoration: none; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .bold { font-weight: 700; }
    .muted { color: #78716C; }
    .muted-small { font-size: 9.5px; color: #57534E; margin-top: 2px; }
    .no-wrap { white-space: nowrap; }

    /* Non-printing Top Action Bar */
    .studio-bar { position: sticky; top: 0; z-index: 999; background: #141A21; color: #fff; padding: 10px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 2px solid #EA6A12; box-shadow: 0 4px 14px rgba(0,0,0,0.16); }
    .studio-bar-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 12px; }
    .studio-bar-nav a { color: #D6D3D1; font-weight: 600; }
    .studio-bar-nav a:hover { color: #FF9E5E; }
    .studio-bar-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .s-status { font-family: monospace; font-size: 11px; color: #FDBA74; }
    .s-btn { padding: 7px 14px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); color: #fff; }
    .s-btn-primary { background: #EA6A12; border-color: #EA6A12; }
    .s-btn-primary:hover { background: #C24D00; }

    /* Master Book Sheet */
    .book-sheet { width: 100%; max-width: 820px; margin: 22px auto; background: #fff; box-shadow: 0 12px 42px rgba(20,26,33,0.10); overflow-wrap: anywhere; }

    /* 1. SWISS EDITORIAL COVER PAGE (NO BG LOGO + CLEAN FULL-PAGE ARCHITECTURAL DESIGN) */
    .cover-page {
      position: relative;
      display: grid;
      grid-template-columns: 18px 1fr;
      min-height: 296mm;
      background: #FFFFFF;
      page-break-after: always;
      break-after: page;
    }
    .cover-spine {
      background: linear-gradient(180deg, #141A21 0%, #141A21 72%, #EA6A12 72%, #EA6A12 100%);
      width: 18px;
      height: 100%;
    }
    .cover-inner {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 46px 48px 36px;
      min-width: 0;
    }
    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      padding-bottom: 24px;
      border-bottom: 1.5px solid #E4E4E0;
    }
    .cover-logo-transparent {
      height: 54px;
      width: auto;
      object-fit: contain;
      display: block;
    }
    .cover-oem-wrap {
      text-align: right;
    }
    .cover-oem-logo {
      height: 44px;
      max-width: 150px;
      object-fit: contain;
      display: block;
      margin-left: auto;
    }
    .cover-oem-tag {
      font-family: monospace;
      font-size: 9px;
      color: #78716C;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .cover-mid {
      padding: 44px 0;
    }
    .cover-eyebrow {
      font-family: monospace;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #C24D00;
      margin-bottom: 14px;
    }
    .cover-h1 {
      font-size: 40px;
      line-height: 1.1;
      font-weight: 800;
      color: #141A21;
      letter-spacing: -0.025em;
      margin: 0 0 18px;
    }
    .cover-rule {
      width: 84px;
      height: 4px;
      background: #EA6A12;
      margin-bottom: 22px;
    }
    .cover-sub {
      font-size: 14.5px;
      line-height: 1.65;
      color: #44403C;
      max-width: 560px;
      margin: 0 0 28px;
    }
    .cover-prepared {
      border-left: 3px solid #141A21;
      background: #F8F8F6;
      padding: 11px 16px;
      max-width: 460px;
      font-size: 12px;
      color: #44403C;
      margin-bottom: 24px;
    }
    .cover-prepared strong { color: #141A21; }
    .cover-scope-notes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 30px;
      padding-top: 22px;
      border-top: 1px solid #E4E4E0;
    }
    .csn-item span {
      display: block;
      font-family: monospace;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #78716C;
      margin-bottom: 3px;
    }
    .csn-item strong {
      font-size: 11.5px;
      color: #141A21;
    }
    .cover-bottom {
      border-top: 2px solid #141A21;
      padding-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      font-size: 10.5px;
      color: #44403C;
    }
    .cover-bottom strong { color: #141A21; }

    /* RUNNING STANDARD PRINT HEADER & FOOTER SHELL */
    table.print-shell {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.print-shell > thead.print-header { display: table-header-group; }
    table.print-shell > tfoot.print-footer { display: table-footer-group; }
    .ph-cell {
      padding: 0 36px 8px;
      border-bottom: 1.5px solid #141A21;
      background: #fff;
    }
    .ph-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0 6px;
      font-size: 9.5px;
      color: #57534E;
    }
    .ph-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #141A21; letter-spacing: 0.04em; text-transform: uppercase; }
    .ph-brand img { height: 18px; width: auto; object-fit: contain; }
    .pf-cell {
      padding: 8px 36px 12px;
      border-top: 1px solid #D6D3D1;
      background: #fff;
    }
    .pf-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #57534E;
    }
    .pf-inner strong { color: #141A21; }
    .body-cell {
      padding: 18px 36px 24px;
      vertical-align: top;
    }

    /* EDITORIAL PREFACE & MASTER INDEX */
    .editorial-section {
      padding: 6px 0 10px;
      page-break-after: always;
      break-after: page;
    }
    .ed-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #141A21;
      padding-bottom: 8px;
      margin-bottom: 18px;
      gap: 12px;
    }
    .ed-kicker { font-family: monospace; font-size: 9.5px; font-weight: 700; color: #C24D00; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px; }
    .ed-header h2 { margin: 0; font-size: 20px; font-weight: 800; color: #141A21; }
    .ed-nav { font-family: monospace; font-size: 10px; color: #57534E; display: flex; gap: 10px; white-space: nowrap; }
    .ed-nav a:hover { color: #C24D00; text-decoration: underline; }

    .preface-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    .pref-block { margin-bottom: 16px; }
    .pref-block h3 { margin: 0 0 6px; font-size: 12.5px; font-weight: 800; color: #141A21; border-left: 3px solid #EA6A12; padding-left: 9px; }
    .pref-block p { margin: 0; font-size: 11px; color: #44403C; line-height: 1.58; }
    .pref-list { margin: 6px 0 0 16px; padding: 0; font-size: 11px; color: #44403C; }
    .pref-list li { margin-bottom: 5px; }
    .pref-desk { background: #F8F8F6; border: 1px solid #E4E4E0; border-radius: 4px; padding: 14px; font-size: 11px; }
    .pref-desk h4 { margin: 0 0 6px; font-size: 12px; color: #141A21; }

    .toc-ul { list-style: none; padding: 0; margin: 0 0 22px; }
    .toc-ul li a { display: flex; align-items: baseline; gap: 8px; padding: 6px 4px; border-bottom: 1px solid #F0F0EC; font-size: 11.5px; font-weight: 700; color: #141A21; }
    .toc-ul li a:hover { color: #C24D00; background: #FFF7ED; }
    .toc-left { min-width: 0; }
    .toc-sub { font-weight: 400; font-style: normal; color: #78716C; font-size: 10.5px; }
    .toc-dots { flex: 1; min-width: 24px; border-bottom: 1px dotted #D6D3D1; margin: 0 4px; }
    .toc-go { font-family: monospace; font-size: 10.5px; color: #C24D00; white-space: nowrap; }

    .part-index-wrap { border-top: 1.5px solid #141A21; padding-top: 14px; }
    .part-index-wrap h3 { margin: 0 0 3px; font-size: 13px; font-weight: 800; }
    .idx-note { margin: 0 0 10px; font-size: 10.5px; color: #57534E; }
    .part-index-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; }
    .pi-item { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 10px; padding: 4px 0; border-bottom: 1px dashed #E7E5E4; overflow: hidden; }
    .pi-item:hover .pi-name { color: #C24D00; text-decoration: underline; }
    .pi-mpn { font-weight: 700; color: #C24D00; flex-shrink: 0; max-width: 44%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pi-name { color: #141A21; min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* SECTION BANNERS & PRODUCT CARDS */
    .cat-section, .guide-section { padding: 8px 0 18px; }
    .section-bar { display: flex; justify-content: space-between; align-items: center; gap: 14px; background: #141A21; color: #fff; padding: 12px 16px; border-left: 5px solid #EA6A12; margin-bottom: 14px; break-inside: avoid; break-after: avoid; }
    .sb-kicker { font-family: monospace; font-size: 9px; color: #FF9E5E; letter-spacing: 0.1em; font-weight: 700; }
    .sb-title { margin: 2px 0; font-size: 16.5px; font-weight: 800; }
    .sb-sub { font-size: 10.5px; color: #D6D3D1; }
    .sb-note { font-family: monospace; font-size: 9.5px; color: #FED7AA; margin-top: 3px; }
    .sb-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
    .sb-logo { background: #fff; border-radius: 3px; padding: 4px 8px; }
    .sb-logo img { height: 20px; max-width: 96px; object-fit: contain; display: block; }
    .sb-links { display: flex; gap: 6px; font-family: monospace; font-size: 9.5px; }
    .sb-links a { color: #D6D3D1; border: 1px solid rgba(255,255,255,0.22); padding: 1.5px 6px; border-radius: 2px; }

    .entries-stack { display: flex; flex-direction: column; gap: 16px; }
    .entry-card { border: 1px solid #D6D3D1; border-radius: 4px; background: #fff; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
    .entry-head { background: #F8F8F6; border-bottom: 1px solid #E4E4E0; padding: 6px 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; font-family: monospace; font-size: 9.5px; }
    .entry-head-left { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
    .entry-num { background: #141A21; color: #fff; font-weight: 700; padding: 1px 6px; border-radius: 2px; }
    .entry-mpn { color: #C24D00; font-weight: 800; word-break: break-all; }
    .entry-sku, .entry-hsn { color: #57534E; word-break: break-all; }
    .entry-head-right { display: flex; align-items: center; gap: 6px; color: #57534E; font-family: inherit; font-size: 10px; font-weight: 600; flex-shrink: 0; }
    .quiet-jump { font-family: monospace; font-size: 9.5px; color: #C24D00; margin-left: 4px; }

    .entry-body { padding: 14px; display: grid; gap: 16px; align-items: start; }
    .entry-body.with-media { grid-template-columns: 140px minmax(0, 1fr); }
    .entry-body.no-media { grid-template-columns: minmax(0, 1fr); }
    .entry-media { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
    .entry-img-frame { width: 140px; height: 132px; border: 1px solid #E4E4E0; background: #fff; border-radius: 4px; padding: 8px; display: flex; align-items: center; justify-content: center; }
    .entry-img-frame img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .media-actions { display: flex; flex-direction: column; gap: 4px; font-size: 9.5px; }
    .media-actions a { display: block; text-align: center; border: 1px solid #E4E4E0; background: #FBFBFA; padding: 4px 6px; border-radius: 3px; font-weight: 600; color: #141A21; }
    .media-actions a:hover { border-color: #C24D00; color: #C24D00; }

    .entry-details { min-width: 0; }
    .entry-title { margin: 0 0 2px; font-size: 14px; font-weight: 800; color: #141A21; line-height: 1.25; }
    .entry-cat-line { font-size: 9.5px; color: #78716C; margin-bottom: 8px; }
    .entry-desc { font-size: 10.5px; color: #44403C; line-height: 1.52; white-space: pre-line; margin-bottom: 10px; }

    .entry-specs-wrap { margin-bottom: 9px; }
    .sub-label { font-family: monospace; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #57534E; margin-bottom: 4px; }
    table.entry-specs { width: 100%; border-collapse: collapse; border: 1px solid #E4E4E0; font-size: 10px; table-layout: fixed; }
    table.entry-specs th, table.entry-specs td { padding: 4px 8px; border-bottom: 1px solid #E7E5E4; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    table.entry-specs th { width: 34%; background: #FBFBFA; color: #57534E; font-weight: 600; }
    table.entry-specs tr:last-child th, table.entry-specs tr:last-child td { border-bottom: none; }

    .entry-compat { margin-bottom: 8px; font-size: 10px; }
    .sub-label-inline { font-weight: 700; color: #141A21; margin-right: 6px; }
    .compat-chip { display: inline-block; font-family: monospace; font-size: 9.5px; font-weight: 700; border: 1px solid #D6D3D1; background: #FBFBFA; padding: 1px 6px; border-radius: 3px; color: #C24D00; margin: 2px 2px 0 0; }
    .entry-ordering { font-size: 10px; background: #FFFBEB; border-left: 3px solid #F59E0B; padding: 6px 9px; color: #44403C; }

    .entry-foot { background: #FBFBFA; border-top: 1px solid #E4E4E0; padding: 6px 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; font-size: 10px; color: #57534E; }
    .entry-foot strong { color: #141A21; }
    .foot-links a { color: #C24D00; font-weight: 700; }

    /* Category Guide */
    .guide-intro { font-size: 11px; color: #44403C; margin: 0 0 12px; }
    .guide-types-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .gt-card { border: 1px solid #D6D3D1; border-radius: 4px; padding: 10px; background: #FBFBFA; break-inside: avoid; }
    .gt-head { display: flex; justify-content: space-between; gap: 6px; font-size: 11.5px; }
    .gt-head span { font-family: monospace; font-size: 9px; background: #141A21; color: #fff; padding: 1px 5px; border-radius: 2px; white-space: nowrap; }
    .gt-spec { font-family: monospace; font-size: 10px; color: #C24D00; font-weight: 700; margin: 4px 0; }
    .gt-card p { margin: 0 0 6px; font-size: 10px; color: #57534E; }
    .gt-models { font-size: 9.5px; color: #57534E; }
    .gt-models a { font-family: monospace; font-weight: 700; color: #141A21; border: 1px solid #D6D3D1; background: #fff; padding: 1px 5px; border-radius: 2px; margin-left: 3px; }
    .sub-h3 { margin: 10px 0 6px; font-size: 12.5px; font-weight: 800; }

    /* Line-Sheet Table */
    table.linesheet { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #D6D3D1; table-layout: fixed; }
    table.linesheet thead { display: table-header-group; }
    table.linesheet th { background: #141A21; color: #fff; text-align: left; padding: 6px 7px; font-family: monospace; font-size: 9px; text-transform: uppercase; }
    table.linesheet td { border-bottom: 1px solid #E4E4E0; padding: 6px 7px; vertical-align: top; overflow-wrap: anywhere; }
    table.linesheet tr { break-inside: avoid; }
    table.linesheet tr:nth-child(even) td { background: #FBFBFA; }
    .row-link { font-weight: 700; color: #141A21; }
    .tbl-cta { font-weight: 700; color: #C24D00; }

    /* Single Product Full Datasheet */
    .datasheet-wrap { padding: 8px 0 18px; }
    .ds-top-strip { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; border-bottom: 2.5px solid #141A21; padding-bottom: 10px; margin-bottom: 16px; }
    .ds-eyebrow { font-family: monospace; font-size: 9.5px; font-weight: 700; color: #C24D00; letter-spacing: 0.1em; }
    .ds-h2 { margin: 4px 0 5px; font-size: 20px; font-weight: 800; color: #141A21; }
    .ds-meta-line { font-size: 10.5px; color: #57534E; }
    .ds-brand-logo { height: 32px; max-width: 130px; object-fit: contain; flex-shrink: 0; }
    .ds-split { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 18px; margin-bottom: 18px; }
    .ds-lead { font-size: 12px; color: #44403C; margin: 0 0 10px; }
    .ds-hl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-bottom: 12px; }
    .ds-hl-box { border: 1px solid #E4E4E0; background: #FBFBFA; padding: 6px 9px; border-radius: 3px; }
    .ds-hl-box span { display: block; font-size: 9px; color: #78716C; }
    .ds-hl-box strong { font-size: 10.5px; font-family: monospace; color: #141A21; }
    .ds-photo-box { border: 1px solid #D6D3D1; border-radius: 4px; padding: 10px; background: #fff; height: 200px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .ds-photo-box img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .ds-commercial-card { border: 1px solid #D6D3D1; background: #FBFBFA; border-radius: 4px; padding: 10px; }
    .dcc-row { display: flex; justify-content: space-between; font-size: 10.5px; padding: 4.5px 0; border-bottom: 1px solid #E7E5E4; }
    .dcc-row:last-of-type { border-bottom: none; }
    .dcc-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .btn-solid { background: #141A21; color: #fff; padding: 5px 10px; border-radius: 3px; font-size: 10px; font-weight: 700; }
    .btn-outline { border: 1px solid #141A21; color: #141A21; background: #fff; padding: 4px 9px; border-radius: 3px; font-size: 10px; font-weight: 700; }
    .ds-bottom-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .ds-section-block h3 { margin: 0 0 7px; font-size: 12.5px; font-weight: 800; border-bottom: 1px solid #E4E4E0; padding-bottom: 4px; }
    .guide-ul { margin: 6px 0 0 16px; padding: 0; font-size: 10.5px; color: #44403C; }
    .guide-ul li { margin-bottom: 5px; }
    .compat-stack { display: flex; flex-direction: column; gap: 5px; }
    .compat-line { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; border: 1px solid #E4E4E0; padding: 5px 8px; border-radius: 3px; background: #FBFBFA; }

    /* Commercial Terms Section */
    .terms-wrap { margin-top: 24px; background: #141A21; color: #fff; padding: 22px 26px; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
    .terms-cols { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 22px; margin-top: 12px; font-size: 10.5px; color: #D6D3D1; }
    .terms-cols h3 { margin: 0 0 6px; font-size: 12px; color: #FF9E5E; }
    .terms-cols ul { margin: 0 0 0 16px; padding: 0; }
    .terms-cols li { margin-bottom: 4px; }
    .terms-foot { margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.16); display: flex; justify-content: space-between; font-size: 10px; color: #A8A29E; }
    .terms-foot a { color: #FF9E5E; font-weight: 700; }

    @media print {
      html, body { background: #fff; width: 100%; }
      .studio-bar { display: none !important; }
      .book-sheet { margin: 0; max-width: 100%; width: 100%; box-shadow: none; }
      .cover-page { min-height: 296mm; }
      .ph-cell { padding: 0 0 6px; }
      .pf-cell { padding: 6px 0 0; }
      .body-cell { padding: 10px 0 14px; }
      .media-actions { display: none; }
    }
    @media (max-width: 760px) {
      .cover-page { grid-template-columns: 10px 1fr; }
      .cover-inner { padding: 28px 22px; }
      .cover-scope-notes, .preface-cols, .part-index-grid, .entry-body.with-media, .guide-types-grid, .ds-split, .ds-bottom-grid, .terms-cols { grid-template-columns: 1fr; }
      .ph-cell, .pf-cell, .body-cell { padding-left: 16px; padding-right: 16px; }
    }
  </style>
</head>
<body>
  <div class="studio-bar">
    <div class="studio-bar-nav">
      <strong>${escHtml(companyName)}</strong>
      <a href="#cover">Cover</a>
      <a href="#preface">Preface</a>
      <a href="#index">Master Index</a>
      <a href="#terms">Commercial Terms</a>
    </div>
    <div class="studio-bar-actions">
      <span id="imgStatus" class="s-status">Preparing high-res assets...</span>
      <button type="button" onclick="window.__printCatalogue && window.__printCatalogue()" class="s-btn s-btn-primary">Print / Save as PDF</button>
      <a href="${escHtml(
        `/api/admin/catalogue?scope=${encodeURIComponent(params.scope)}${
          params.slug ? `&slug=${encodeURIComponent(params.slug)}` : ""
        }&layout=${layout}&images=${includeImages ? "1" : "0"}&prices=${
          showPrices ? "1" : "0"
        }&limit=${safeLimit}&offset=${safeOffset}${
          params.preparedFor ? `&preparedFor=${encodeURIComponent(params.preparedFor)}` : ""
        }&download=1`
      )}" class="s-btn">Download Offline HTML</a>
    </div>
  </div>

  <main class="book-sheet">
    <!-- ARCHITECTURAL PRINT COVER PAGE (NO BACKGROUND LOGO ON WHITE PAGE) -->
    <header id="cover" class="cover-page">
      <div class="cover-spine"></div>
      <div class="cover-inner">
        <div class="cover-top">
          <img src="${escHtml(transparentLongLogo)}" alt="${escHtml(companyName)}" class="cover-logo-transparent" loading="eager" decoding="sync" />
          ${
            targetBrandLogoUri
              ? `<div class="cover-oem-wrap">
                  <img src="${escHtml(targetBrandLogoUri)}" alt="${escHtml(targetBrand?.name || "")}" class="cover-oem-logo" loading="eager" decoding="sync" />
                  <div class="cover-oem-tag">${escHtml(targetBrand?.countryOfOrigin || "OEM Supply")} Series</div>
                </div>`
              : `<div class="cover-oem-wrap"><div class="cover-oem-tag">Pan-India B2B Procurement Edition</div></div>`
          }
        </div>

        <div class="cover-mid">
          <div class="cover-eyebrow">OFFICIAL TECHNICAL &amp; PROCUREMENT CATALOGUE • ${editionYear} EDITION</div>
          <h1 class="cover-h1">${escHtml(fullDocTitle)}</h1>
          <div class="cover-rule"></div>
          <p class="cover-sub">${escHtml(
            targetBrand?.description || targetCategory?.description || companyTagline
          )}</p>
          ${
            params.preparedFor
              ? `<div class="cover-prepared">Prepared For: <strong>${escHtml(params.preparedFor)}</strong></div>`
              : ""
          }

          <div class="cover-scope-notes">
            <div class="csn-item">
              <span>Supply Coverage</span>
              <strong>Pan-India B2B GST Dispatch</strong>
            </div>
            <div class="csn-item">
              <span>Lead Time Policy</span>
              <strong>Confirmed Upon Order</strong>
            </div>
            <div class="csn-item">
              <span>Issued Date</span>
              <strong>${escHtml(generatedDate)}</strong>
            </div>
          </div>
        </div>

        <div class="cover-bottom">
          <div>
            <strong>${escHtml(companyName)}</strong><br/>
            ${escHtml(companyAddress)}
          </div>
          <div style="text-align:right;">
            <strong>Direct Desk:</strong> ${escHtml(companyPhone)}<br/>
            <strong>Email:</strong> ${escHtml(companyEmail)} &nbsp;•&nbsp; ${escHtml(origin)}
          </div>
        </div>
      </div>
    </header>

    <!-- INTERIOR PAGES WRAPPED IN NATIVE REPEATING PRINT HEADER / FOOTER TABLE -->
    <table class="print-shell">
      <thead class="print-header">
        <tr>
          <td class="ph-cell">
            <div class="ph-inner">
              <div class="ph-brand">
                <img src="${escHtml(transparentShortLogo)}" alt="${escHtml(companyName)}" loading="eager" decoding="sync" />
                <span>${escHtml(companyName)}</span>
              </div>
              <div class="mono">${escHtml(docTitle)}</div>
            </div>
          </td>
        </tr>
      </thead>

      <tfoot class="print-footer">
        <tr>
          <td class="pf-cell">
            <div class="pf-inner">
              <div><strong>${escHtml(companyName)}</strong> • ${escHtml(companyAddress)}</div>
              <div class="mono">${escHtml(companyPhone)} • ${escHtml(companyEmail)}</div>
            </div>
          </td>
        </tr>
      </tfoot>

      <tbody>
        <tr>
          <td class="body-cell">
            <!-- PREFACE -->
            <section id="preface" class="editorial-section">
              <div class="ed-header">
                <div>
                  <div class="ed-kicker">FOREWORD &amp; SOURCING OVERVIEW</div>
                  <h2>Corporate Preface</h2>
                </div>
                <div class="ed-nav">
                  <a href="#cover">↑ Cover</a>
                  <a href="#index">Master Index →</a>
                </div>
              </div>

              <div class="preface-cols">
                <div>
                  <div class="pref-block">
                    <h3>1. About ${escHtml(companyName)}</h3>
                    <p>${escHtml(
                      companyName
                    )} is a multi-brand industrial Maintenance, Repair &amp; Operations (MRO), agricultural engineering, and technical specialty supplier headquartered in Ranigunj, Secunderabad, Telangana. We serve manufacturing plants, aerospace/defence workshops, OEM assemblies, utilities, and contractors across India with consolidated GST tax invoicing.</p>
                  </div>

                  <div class="pref-block">
                    <h3>2. OEM Authenticity &amp; Sourcing Standards</h3>
                    <p>${
                      targetBrand
                        ? targetBrand.sourcingType === "authorized"
                          ? `Products featured in this edition are supplied as ${targetBrand.name} genuine equipment with manufacturer batch traceability.`
                          : `All ${targetBrand.name} items in this catalogue are genuine OEM products procured through ${companyName}'s verified B2B wholesale network (${targetBrand.sourcingNote || "independent B2B supply partner"}).`
                        : `Every brand in this catalogue is sourced through verified B2B industrial distribution channels with manufacturer part traceability, HSN tax classification, and optional calibration documentation.`
                    }</p>
                  </div>
                </div>

                <div>
                  <div class="pref-block">
                    <h3>3. How to Read This Catalogue</h3>
                    <ul class="pref-list">
                      <li><strong>MPN (Manufacturer Part No.):</strong> Original factory code used for technical verification and connector/system fitment.</li>
                      <li><strong>Seller SKU &amp; HSN:</strong> Internal procurement reference and GST tariff code for compliant Purchase Order generation.</li>
                      <li><strong>Lead Time:</strong> Confirmed upon order based on live warehouse allocation and OEM scheduling.</li>
                      <li><strong>Inter-Page Navigation:</strong> Click any entry in the Master Index to jump straight to that model, or use live links for WhatsApp / Email RFQ submission.</li>
                    </ul>
                  </div>

                  <div class="pref-desk">
                    <h4>Direct Procurement &amp; Quotation Desk</h4>
                    <p style="margin:0 0 6px;">Share your Bill of Materials (BOM) or MPN list for consolidated B2B GST pricing and dispatch scheduling.</p>
                    <div><strong>WhatsApp / Phone:</strong> ${escHtml(companyPhone)}</div>
                    <div><strong>RFQ Inbox:</strong> ${escHtml(companyEmail)}</div>
                    ${companyGstin ? `<div><strong>GSTIN:</strong> ${escHtml(companyGstin)}</div>` : ""}
                  </div>
                </div>
              </div>
            </section>

            <!-- MASTER INDEX -->
            <section id="index" class="editorial-section">
              <div class="ed-header">
                <div>
                  <div class="ed-kicker">NAVIGABLE DOCUMENT DIRECTORY</div>
                  <h2>Master Index</h2>
                </div>
                <div class="ed-nav">
                  <a href="#preface">← Preface</a>
                  <a href="#terms">Commercial Terms →</a>
                </div>
              </div>

              <ul class="toc-ul">
                <li><a href="#preface"><span class="toc-left">00. Corporate Preface &amp; Procurement Guidelines</span><span class="toc-dots"></span><span class="toc-go">Preface →</span></a></li>
                ${
                  params.scope === "category" && categoryGuide
                    ? `<li><a href="#category-guide"><span class="toc-left">Technical Sizing &amp; Type Selection Guide</span><span class="toc-dots"></span><span class="toc-go">Guide →</span></a></li>`
                    : ""
                }
                ${sectionTocRows}
                <li><a href="#terms"><span class="toc-left">Commercial Terms, GST Billing &amp; Contact Desk</span><span class="toc-dots"></span><span class="toc-go">Terms →</span></a></li>
              </ul>

              ${partNumberIndexHtml}
            </section>

            ${categoryGuideHtml}

            <!-- CATALOGUE SECTIONS & FULL PRODUCT DETAILS -->
            ${sectionsHtml}

            <!-- COMMERCIAL TERMS BACK SECTION -->
            <footer id="terms" class="terms-wrap">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
                <div>
                  <div style="font-family:monospace;font-size:9.5px;color:#FF9E5E;letter-spacing:0.1em;font-weight:700;">ORDERING &amp; DISPATCH TERMS</div>
                  <h2 style="margin:3px 0 0;font-size:17px;color:#fff;">Commercial Terms &amp; Direct RFQ Desk</h2>
                </div>
              </div>

              <div class="terms-cols">
                <div>
                  <h3>Standard Terms of Supply</h3>
                  <ul>
                    <li>Formal quotations remain valid for <strong>7 calendar days</strong> unless agreed otherwise in writing.</li>
                    <li><strong>Delivery Lead Time:</strong> Confirmed upon order confirmation based on warehouse allocation or OEM schedule.</li>
                    <li>Applicable GST is billed separately with full B2B tax invoice credit across India.</li>
                    <li>Confirm accessories, calibration certificates, mounting brackets, or voltage ratings prior to Purchase Order issuance.</li>
                  </ul>
                </div>
                <div>
                  <h3>Ordering &amp; Contact Details</h3>
                  <p style="margin:0 0 6px;"><strong>${escHtml(companyName)}</strong><br/>${escHtml(companyAddress)}</p>
                  <p style="margin:0;">Phone / WhatsApp: <strong>${escHtml(companyPhone)}</strong><br/>Email: <strong>${escHtml(
                    companyEmail
                  )}</strong><br/>Website: <a href="${escHtml(origin)}" target="_blank" style="color:#FF9E5E;text-decoration:underline;">${escHtml(
                    origin
                  )}</a></p>
                </div>
              </div>

              <div class="terms-foot">
                <span>Edition ${editionYear} • Issued ${escHtml(generatedDate)} • ${escHtml(companyName)}</span>
                <span><a href="#cover">↑ Cover</a> &nbsp;|&nbsp; <a href="#preface">↑ Preface</a> &nbsp;|&nbsp; <a href="#index">↑ Master Index</a></span>
              </div>
            </footer>
          </td>
        </tr>
      </tbody>
    </table>
  </main>

  <script>
    (function () {
      var pdfTitle = ${JSON.stringify(defaultPdfTitle)};
      document.title = pdfTitle;
      window.__printCatalogue = function () {
        document.title = pdfTitle;
        window.print();
      };
      window.addEventListener("beforeprint", function () {
        document.title = pdfTitle;
      });
      var imgs = Array.prototype.slice.call(document.images || []);
      var statusEl = document.getElementById("imgStatus");
      function waitImg(img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          var t = setTimeout(resolve, 4500);
          img.addEventListener("load", function () { clearTimeout(t); resolve(); }, { once: true });
          img.addEventListener("error", function () { clearTimeout(t); resolve(); }, { once: true });
        });
      }
      Promise.all(imgs.map(waitImg)).then(function () {
        if (statusEl) statusEl.textContent = "Ready (" + imgs.length + " assets loaded)";
        ${
          params.autoPrint
            ? 'setTimeout(function () { window.__printCatalogue(); }, 250);'
            : ""
        }
      });
    })();
  </script>
</body>
</html>`;

  return {
    html,
    filename,
    totalMatching,
    renderedCount: rows.length,
    title: defaultPdfTitle,
  };
}
