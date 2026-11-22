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
    // Skip very large raster/vector assets (> 250 KB) inside massive exports only?
    // Wait: brand logos are small except 1 or 2 (~400 KB), base64 is still totally fine once per cover/header!
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
  const showPrices =
    params.showPrices ?? settings["show_public_prices"] === "true";

  const mainLogoData =
    assetToDataUri("/logos/logo-long-white.png") ||
    assetToDataUri("/logos/logo-full-white.png") ||
    buildAbsoluteUrl(origin, "/logos/logo-long-white.png");
  const darkLogoData =
    assetToDataUri("/logos/logo-long.png") ||
    assetToDataUri("/logos/logo-full.png") ||
    buildAbsoluteUrl(origin, "/logos/logo-long.png");

  // Resolve target entities
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
    conds.push(
      or(eq(products.slug, params.slug), eq(products.sku, params.slug))!
    );
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

  // Resolve compatible products for individual product datasheet (or small batches <= 80 items)
  const slugSetInCatalogue = new Set(rows.map((r) => r.product.slug));
  const singleProductCompat =
    params.scope === "product" && rows[0]
      ? await (async () => {
          const r0 = rows[0];
          const rawSpecs = parseSpecsJson(r0.product.specificationsJson);
          const mpn = extractManufacturerPartNumber(r0.product.sku, rawSpecs);
          const codes = extractReferencedPartCodes(r0.product, mpn);
          if (codes.length === 0) return [];
          const codeConds = codes.slice(0, 8).map((c) => {
            const u = c.toUpperCase();
            return or(
              sql`upper(${products.sku}) = ${u}`,
              sql`upper(${products.sku}) LIKE ${`%-${u}`}`,
              sql`upper(${products.sku}) LIKE ${`%-${u}*`}`
            );
          });
          return db
            .select({ product: products, brand: brands })
            .from(products)
            .leftJoin(brands, eq(products.brandId, brands.id))
            .where(and(eq(products.isActive, true), or(...codeConds)))
            .limit(8);
        })()
      : [];

  // Title & scope labels
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
      : `Master Industrial & Agricultural Supply Catalogue${params.featuredOnly ? " (Featured Index)" : ""}`;

  const fullDocTitle = `${docTitle}${partSuffix}`;
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Group rows cleanly for TOC & sectioned pages
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
    // Group a Brand catalogue by Category
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
        title: cat?.name || "Catalog Products",
        subtitle: cat?.description || `${targetBrand.name} models supplied across India`,
        divisionName: div?.name || "Industrial Supply",
        brandLogoUri,
        brandOrigin: targetBrand.countryOfOrigin,
        sourcingNote:
          targetBrand.sourcingType === "authorized"
            ? "Authorized Supply Partner"
            : `Independent B2B Sourcing Partner (${targetBrand.name})`,
        items,
      });
    }
  } else if (params.scope === "category" && targetCategory) {
    // Group a Category catalogue by Brand
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
        subtitle: br?.description || `${targetCategory.name} SKUs`,
        divisionName: targetDivision?.name || targetCategory.name,
        brandLogoUri,
        brandOrigin: br?.countryOfOrigin,
        items,
      });
    }
  } else if (params.scope === "master") {
    // Group Master catalogue cleanly by Category (showing Brand counts + items)
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

  // Build unique brand index summary in current export
  const brandStatsMap = new Map<string, { slug: string; name: string; count: number; logoUri: string | null; anchorId: string }>();
  for (const r of rows) {
    if (!r.brand) continue;
    const cur = brandStatsMap.get(r.brand.slug);
    if (cur) cur.count += 1;
    else {
      brandStatsMap.set(r.brand.slug, {
        slug: r.brand.slug,
        name: r.brand.name,
        count: 1,
        logoUri: assetToDataUri(r.brand.logoUrl) || (r.brand.logoUrl ? buildAbsoluteUrl(origin, r.brand.logoUrl) : null),
        anchorId: params.scope === "category" ? safeId("brand", r.brand.slug) : safeId("cat", r.category?.slug || "general"),
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

  // Helpers to render WhatsApp / Web links on any item
  const makeProductWebUrl = (slug: string) => buildAbsoluteUrl(origin, `/products/${slug}`);
  const makeWaQuoteUrl = (name: string, sku: string) =>
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      `Hello ${companyName}, please share B2B GST quote & lead time for ${name} (SKU: ${sku}).`
    )}`;
  const makeMailQuoteUrl = (name: string, sku: string) =>
    `mailto:${companyEmail}?subject=${encodeURIComponent(
      `RFQ Enquiry: ${name} (${sku})`
    )}&body=${encodeURIComponent(
      `Hello ${companyName} Team,\n\nPlease send quotation, availability & GST details for:\nProduct: ${name}\nSKU: ${sku}\nQuantity Required: `
    )}`;

  const renderProductCard = (r: (typeof rows)[number]) => {
    const p = r.product;
    const rawSpecs = parseSpecsJson(p.specificationsJson);
    const cleanName = htmlToCleanText(p.name, true) || p.name;
    const cleanShort = htmlToCleanText(p.shortDescription, true);
    const mpn = extractManufacturerPartNumber(p.sku, rawSpecs);
    const specs = buildEnrichedSpecifications(
      {
        name: cleanName,
        sku: p.sku,
        shortDescription: cleanShort,
        description: htmlToCleanText(p.description, false),
        hsnCode: p.hsnCode,
      },
      rawSpecs,
      mpn
    );
    const highlights = extractKeySpecHighlights(specs).slice(0, 4);
    const imgUrl = includeImages && p.primaryImageUrl ? buildAbsoluteUrl(origin, p.primaryImageUrl) : null;
    const priceText =
      showPrices && p.pricingMode === "priced" && p.basePrice != null
        ? `₹${Number(p.basePrice).toLocaleString("en-IN")} / ${p.priceUnit}`
        : "Ask for Price";
    const prodAnchor = safeId("prod", p.slug);
    const webUrl = makeProductWebUrl(p.slug);

    return `
      <article id="${escHtml(prodAnchor)}" class="prod-card">
        <div class="prod-top">
          ${
            imgUrl
              ? `<div class="prod-thumb"><img src="${escHtml(imgUrl)}" alt="${escHtml(cleanName)}" loading="lazy" /></div>`
              : ""
          }
          <div class="prod-head">
            <div class="prod-meta-row">
              <span class="badge-mpn">MPN: ${escHtml(mpn)}</span>
              <span class="sku-label">SKU: ${escHtml(p.sku)}</span>
            </div>
            <h4 class="prod-title"><a href="${escHtml(webUrl)}" target="_blank" rel="noopener">${escHtml(cleanName)}</a></h4>
            <div class="prod-sub">${escHtml(r.brand?.name || companyName)} • ${escHtml(r.category?.name || "")}</div>
          </div>
        </div>
        ${cleanShort ? `<p class="prod-desc">${escHtml(cleanShort.slice(0, 170))}</p>` : ""}
        ${
          highlights.length > 0
            ? `<div class="spec-pills">${highlights
                .map(
                  (h) =>
                    `<div class="spec-pill"><span>${escHtml(h.label)}:</span> <strong>${escHtml(h.value)}</strong></div>`
                )
                .join("")}</div>`
            : ""
        }
        <div class="prod-foot">
          <div class="prod-comm">
            <span class="price-tag">${escHtml(priceText)}</span>
            <span class="comm-sep">• MOQ: ${escHtml(p.moq)}</span>
            ${p.hsnCode ? `<span class="comm-sep">• HSN: ${escHtml(p.hsnCode)}</span>` : ""}
            <span class="comm-sep">• ${escHtml(p.leadTime)}</span>
          </div>
          <div class="prod-links">
            <a href="${escHtml(webUrl)}" target="_blank" rel="noopener" class="lnk-view">Specs ↗</a>
            <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener" class="lnk-wa">WhatsApp Quote</a>
          </div>
        </div>
      </article>
    `;
  };

  const renderLineSheetTable = (items: typeof rows) => {
    const trHtml = items
      .map((r) => {
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
          .slice(0, 2)
          .map((s) => `${s.label}: ${s.value}`)
          .join(" | ");
        const priceText =
          showPrices && p.pricingMode === "priced" && p.basePrice != null
            ? `₹${Number(p.basePrice).toLocaleString("en-IN")} / ${p.priceUnit}`
            : "Ask for Price";
        const prodAnchor = safeId("prod", p.slug);
        const webUrl = makeProductWebUrl(p.slug);
        return `
          <tr id="${escHtml(prodAnchor)}">
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
              <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener" class="tbl-cta">Quote ↗</a>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <table class="linesheet">
        <thead>
          <tr>
            <th>MPN / SKU</th>
            <th>Product Description &amp; Key Spec</th>
            <th>Brand</th>
            <th>HSN</th>
            <th>MOQ</th>
            <th>Price / Unit</th>
            <th>RFQ</th>
          </tr>
        </thead>
        <tbody>${trHtml}</tbody>
      </table>
    `;
  };

  // Single Product Executive Datasheet Section
  const renderSingleProductSheet = () => {
    const r = rows[0];
    const p = r.product;
    const rawSpecs = parseSpecsJson(p.specificationsJson);
    const cleanName = htmlToCleanText(p.name, true) || p.name;
    const cleanShort = htmlToCleanText(p.shortDescription, true);
    const cleanDesc = htmlToCleanText(p.description, false);
    const mpn = extractManufacturerPartNumber(p.sku, rawSpecs);
    const specs = buildEnrichedSpecifications(
      {
        name: cleanName,
        sku: p.sku,
        shortDescription: cleanShort,
        description: cleanDesc,
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
    const imgUrl = includeImages && p.primaryImageUrl ? buildAbsoluteUrl(origin, p.primaryImageUrl) : null;
    const brandLogoUri =
      r.brand?.logoUrl
        ? assetToDataUri(r.brand.logoUrl) || buildAbsoluteUrl(origin, r.brand.logoUrl)
        : null;
    const priceText =
      showPrices && p.pricingMode === "priced" && p.basePrice != null
        ? `₹${Number(p.basePrice).toLocaleString("en-IN")} / ${p.priceUnit} (+${p.gstPercent}% GST)`
        : "Ask for Price (Formal GST Quote via WhatsApp / Email)";
    const webUrl = makeProductWebUrl(p.slug);

    return `
      <section id="${escHtml(safeId("prod", p.slug))}" class="datasheet-wrap">
        <div class="datasheet-header">
          <div class="dh-left">
            <img src="${escHtml(darkLogoData)}" alt="${escHtml(companyName)}" class="dh-logo" />
            <div class="dh-sub">${escHtml(companyName)} • Technical Product Catalogue Sheet</div>
          </div>
          <div class="dh-right">
            ${brandLogoUri ? `<img src="${escHtml(brandLogoUri)}" alt="${escHtml(r.brand?.name || "")}" class="dh-brand-logo" />` : ""}
            <div class="dh-ref">MPN: <strong>${escHtml(mpn)}</strong> | SKU: ${escHtml(p.sku)}</div>
          </div>
        </div>

        <div class="ds-hero">
          <div class="ds-main">
            <div class="ds-crumbs">
              <a href="#toc">Index</a> › ${escHtml(r.division?.name || "Catalog")} › ${escHtml(r.category?.name || "")}
            </div>
            <h1 class="ds-title">${escHtml(cleanName)}</h1>
            ${cleanShort ? `<p class="ds-short">${escHtml(cleanShort)}</p>` : ""}

            <div class="ds-comm-grid">
              <div><span>Manufacturer / Brand</span><strong>${escHtml(r.brand?.name || companyName)}</strong></div>
              <div><span>Part No. / MPN</span><strong class="mono">${escHtml(mpn)}</strong></div>
              <div><span>HSN Code</span><strong class="mono">${escHtml(p.hsnCode || "As Applicable")}</strong></div>
              <div><span>MOQ &amp; Lead Time</span><strong>${escHtml(p.moq)} • ${escHtml(p.leadTime)}</strong></div>
            </div>

            <div class="ds-price-box">
              <div>
                <div class="ds-price-lbl">Commercial Pricing</div>
                <div class="ds-price-val">${escHtml(priceText)}</div>
              </div>
              <div class="ds-cta-group">
                <a href="${escHtml(makeWaQuoteUrl(cleanName, p.sku))}" target="_blank" rel="noopener" class="btn-wa">WhatsApp Quote ↗</a>
                <a href="${escHtml(makeMailQuoteUrl(cleanName, p.sku))}" class="btn-mail">Email RFQ ↗</a>
                <a href="${escHtml(webUrl)}" target="_blank" rel="noopener" class="btn-web">Live Product Page ↗</a>
              </div>
            </div>
          </div>
          ${
            imgUrl
              ? `<div class="ds-img-box"><img src="${escHtml(imgUrl)}" alt="${escHtml(cleanName)}" /></div>`
              : ""
          }
        </div>

        ${
          highlights.length > 0
            ? `<div class="ds-highlights">${highlights
                .map(
                  (h) =>
                    `<div class="ds-hl-item"><span>${escHtml(h.label)}</span><strong>${escHtml(h.value)}</strong></div>`
                )
                .join("")}</div>`
            : ""
        }

        <div class="ds-cols">
          <div class="ds-col-left">
            ${
              cleanDesc
                ? `<div class="ds-block"><h3>Overview &amp; Industrial Application</h3><p class="ds-para">${escHtml(
                    cleanDesc
                  )}</p></div>`
                : ""
            }
            <div class="ds-block ordering-box">
              <h3>${escHtml(guidance.title)}</h3>
              <ul>${guidance.checklist.map((c) => `<li>${escHtml(c)}</li>`).join("")}</ul>
            </div>
          </div>

          <div class="ds-col-right">
            <div class="ds-block">
              <h3>Verified Technical Specifications</h3>
              <table class="spec-table">
                <tbody>
                  ${specs
                    .map(
                      (s) =>
                        `<tr><th>${escHtml(s.label)}</th><td class="mono">${escHtml(s.value)}</td></tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>

            ${
              singleProductCompat.length > 0
                ? `<div class="ds-block">
                    <h3>Compatible Accessories &amp; Companion Models</h3>
                    <div class="compat-list">
                      ${singleProductCompat
                        .map((cp) => {
                          const cpMpn = extractManufacturerPartNumber(
                            cp.product.sku,
                            parseSpecsJson(cp.product.specificationsJson)
                          );
                          return `<a href="${escHtml(
                            makeProductWebUrl(cp.product.slug)
                          )}" target="_blank" rel="noopener" class="compat-row">
                            <span class="mono bold">${escHtml(cpMpn)}</span>
                            <span>${escHtml(htmlToCleanText(cp.product.name, true) || cp.product.name)}</span>
                            <span class="arrow">↗</span>
                          </a>`;
                        })
                        .join("")}
                    </div>
                  </div>`
                : ""
            }
          </div>
        </div>
      </section>
    `;
  };

  // Assemble Cover, TOC, Sections, Terms
  const tocLinksHtml =
    params.scope === "product"
      ? `<li><a href="#${escHtml(safeId("prod", rows[0].product.slug))}"><span>01. Product Technical Datasheet — ${escHtml(rows[0].product.sku)}</span><span class="toc-count">Jump →</span></a></li>`
      : sections
          .map(
            (sec, idx) =>
              `<li><a href="#${escHtml(sec.anchorId)}"><span>${String(idx + 1).padStart(
                2,
                "0"
              )}. ${escHtml(sec.title)} <em class="toc-div">(${escHtml(
                sec.divisionName
              )})</em></span><span class="toc-count">${sec.items.length} SKUs →</span></a></li>`
          )
          .join("");

  const categoryGuideHtml =
    categoryGuide && params.scope === "category"
      ? `
        <section id="category-guide" class="guide-box">
          <div class="guide-badge">${escHtml(categoryGuide.badgeLabel)}</div>
          <h2>${escHtml(categoryGuide.introHeadline)}</h2>
          <p class="guide-lead">${escHtml(categoryGuide.introSummary)}</p>

          ${
            categoryGuide.types.length > 0
              ? `<div class="guide-types">${categoryGuide.types
                  .map(
                    (t) => `
                  <div class="guide-type-card">
                    <div class="gtc-top"><strong>${escHtml(t.name)}</strong><span>${escHtml(t.standard)}</span></div>
                    <div class="gtc-spec">${escHtml(t.specRange)}</div>
                    <p>${escHtml(t.summary)}</p>
                    ${
                      t.modelSlugs.length > 0
                        ? `<div class="gtc-links">${t.modelSlugs
                            .map((ms) => {
                              const href = slugSetInCatalogue.has(ms)
                                ? `#${safeId("prod", ms)}`
                                : makeProductWebUrl(ms);
                              const label = ms.split("-").slice(-2).join("-").toUpperCase();
                              return `<a href="${escHtml(href)}">${escHtml(label)}</a>`;
                            })
                            .join("")}</div>`
                        : ""
                    }
                  </div>`
                  )
                  .join("")}</div>`
              : ""
          }

          ${
            categoryGuide.sizingRows.length > 0
              ? `<div class="sizing-wrap">
                  <h3>${escHtml(categoryGuide.sizingTitle)}</h3>
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
                  </table>
                </div>`
              : ""
          }
        </section>
      `
      : "";

  const sectionsHtml =
    params.scope === "product"
      ? renderSingleProductSheet()
      : sections
          .map(
            (sec, idx) => `
          <section id="${escHtml(sec.anchorId)}" class="cat-section">
            <div class="sec-banner">
              <div class="sec-left">
                <div class="sec-kicker">SECTION ${String(idx + 1).padStart(2, "0")} • ${escHtml(
                  sec.divisionName
                )}</div>
                <h2 class="sec-title">${escHtml(sec.title)}</h2>
                ${sec.subtitle ? `<p class="sec-sub">${escHtml(sec.subtitle)}</p>` : ""}
                ${
                  sec.sourcingNote
                    ? `<div class="sec-note">${escHtml(sec.sourcingNote)}${
                        sec.brandOrigin ? ` • Origin: ${escHtml(sec.brandOrigin)}` : ""
                      }</div>`
                    : ""
                }
              </div>
              <div class="sec-right">
                ${
                  sec.brandLogoUri
                    ? `<div class="sec-logo-pill"><img src="${escHtml(sec.brandLogoUri)}" alt="${escHtml(
                        sec.title
                      )}" /></div>`
                    : ""
                }
                <div class="sec-nav-pills">
                  <span class="sec-count">${sec.items.length} Models</span>
                  <a href="#toc" class="back-toc">↑ Contents</a>
                  <a href="#terms" class="back-toc">Quote Terms</a>
                </div>
              </div>
            </div>

            ${
              layout === "linesheet"
                ? renderLineSheetTable(sec.items)
                : `<div class="prod-grid">${sec.items.map(renderProductCard).join("")}</div>`
            }
          </section>
        `
          )
          .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(fullDocTitle)} | ${escHtml(companyName)}</title>
  <style>
    @page { size: A4; margin: 12mm 11mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html { scroll-behavior: smooth; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #141A21; background: #F4F4F0; }
    body { margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
    a { color: inherit; text-decoration: none; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .bold { font-weight: 700; }
    .muted-small { font-size: 10px; color: #57534E; margin-top: 2px; }
    .no-wrap { white-space: nowrap; }

    /* Non-printing Top Studio Toolbar */
    .toolbar { position: sticky; top: 0; z-index: 999; background: #0E1319; color: #fff; padding: 10px 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 2px solid #EA6A12; }
    .toolbar-left { display: flex; align-items: center; gap: 12px; font-size: 12px; }
    .toolbar-badge { background: rgba(234,106,18,0.2); border: 1px solid #EA6A12; color: #FF9E5E; padding: 2px 8px; border-radius: 99px; font-family: monospace; font-weight: 700; font-size: 11px; }
    .toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .tb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; }
    .tb-btn:hover { background: rgba(255,255,255,0.16); }
    .tb-primary { background: #EA6A12; border-color: #EA6A12; color: #fff; }
    .tb-primary:hover { background: #C95609; }

    .container { max-width: 1120px; margin: 18px auto; background: #fff; box-shadow: 0 12px 35px rgba(20,26,33,0.08); border-radius: 6px; overflow: hidden; }

    /* Cover Page */
    .cover { background: linear-gradient(145deg, #0D1218 0%, #141A21 55%, #1E2733 100%); color: #fff; padding: 48px 44px; min-height: 258mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; break-after: page; position: relative; }
    .cover-accent { height: 6px; width: 96px; background: #EA6A12; border-radius: 3px; margin-bottom: 18px; }
    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 24px; }
    .cover-logo { height: 54px; width: auto; object-fit: contain; }
    .cover-brand-box { background: #fff; border-radius: 8px; padding: 12px 18px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
    .cover-brand-logo { height: 48px; max-width: 180px; object-fit: contain; }
    .cover-mid { margin: 42px 0; }
    .cover-kicker { font-family: monospace; text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #FF9E5E; font-weight: 700; margin-bottom: 10px; }
    .cover-h1 { font-size: 36px; line-height: 1.12; font-weight: 800; margin: 0 0 14px; letter-spacing: -0.02em; }
    .cover-tagline { font-size: 15px; color: #D6D3D1; max-width: 680px; margin: 0 0 22px; }
    .prepared-pill { display: inline-block; background: rgba(234,106,18,0.16); border: 1px solid rgba(234,106,18,0.5); border-radius: 6px; padding: 8px 14px; font-size: 12px; color: #FED7AA; margin-bottom: 18px; }
    .cover-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
    .cover-stat { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 14px; }
    .cover-stat span { display: block; font-size: 10px; font-family: monospace; color: #A8A29E; text-transform: uppercase; }
    .cover-stat strong { display: block; font-size: 18px; margin-top: 4px; color: #fff; }
    .cover-jump { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
    .cover-jump a { background: #EA6A12; color: #fff; font-weight: 700; font-size: 12px; padding: 9px 16px; border-radius: 5px; }
    .cover-jump a.sec { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.22); }
    .cover-bottom { border-top: 1px solid rgba(255,255,255,0.14); padding-top: 18px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; font-size: 11px; color: #D6D3D1; }

    /* Table of Contents & Company Overview */
    .toc-page { padding: 34px 36px; page-break-after: always; break-after: page; }
    .page-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #141A21; padding-bottom: 12px; margin-bottom: 22px; }
    .page-head img { height: 30px; width: auto; }
    .page-head-meta { text-align: right; font-size: 10px; font-family: monospace; color: #57534E; }
    .toc-grid { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 24px; }
    .toc-list { list-style: none; padding: 0; margin: 12px 0 0; border: 1px solid #E4E4E0; border-radius: 6px; overflow: hidden; }
    .toc-list li { border-bottom: 1px solid #E4E4E0; }
    .toc-list li:last-child { border-bottom: none; }
    .toc-list a { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 13px; font-size: 12px; font-weight: 600; color: #141A21; }
    .toc-list a:hover { background: #FFF7ED; color: #C24D00; }
    .toc-div { font-style: normal; font-weight: 400; color: #78716C; font-size: 11px; }
    .toc-count { font-family: monospace; font-size: 11px; color: #C24D00; white-space: nowrap; }
    .company-card { border: 1px solid #E4E4E0; background: #FBFBFA; border-radius: 6px; padding: 18px; space-y: 10px; }
    .company-card h3 { margin: 0 0 8px; font-size: 14px; color: #141A21; }
    .company-card p { margin: 0 0 10px; font-size: 11.5px; color: #44403C; }
    .brand-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .brand-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #E4E4E0; background: #fff; border-radius: 99px; padding: 4px 10px; font-size: 11px; font-weight: 600; }
    .brand-chip img { height: 14px; max-width: 44px; object-fit: contain; }
    .brand-chip span.cnt { font-family: monospace; font-size: 10px; color: #78716C; }

    /* Category Guide */
    .guide-box { margin: 22px 32px 0; border: 1px solid #E4E4E0; border-radius: 6px; padding: 20px; background: #FBFBFA; break-inside: avoid; }
    .guide-badge { font-family: monospace; font-size: 10px; font-weight: 700; color: #C24D00; text-transform: uppercase; letter-spacing: 0.08em; }
    .guide-box h2 { margin: 4px 0 6px; font-size: 18px; }
    .guide-lead { margin: 0 0 14px; color: #44403C; font-size: 12px; }
    .guide-types { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .guide-type-card { background: #fff; border: 1px solid #E4E4E0; border-radius: 5px; padding: 12px; }
    .gtc-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px; }
    .gtc-top span { background: #141A21; color: #fff; font-family: monospace; font-size: 9.5px; padding: 2px 6px; border-radius: 3px; }
    .gtc-spec { font-family: monospace; font-size: 11px; color: #C24D00; font-weight: 700; margin: 5px 0; }
    .guide-type-card p { margin: 0 0 8px; font-size: 11px; color: #57534E; }
    .gtc-links { display: flex; flex-wrap: wrap; gap: 5px; }
    .gtc-links a { font-family: monospace; font-size: 10px; border: 1px solid #D6D3D1; background: #fff; padding: 2px 7px; border-radius: 3px; font-weight: 700; }
    .gtc-links a:hover { border-color: #C24D00; color: #C24D00; }
    .sizing-wrap h3 { margin: 8px 0 8px; font-size: 13px; }

    /* Catalogue Sections & Cards */
    .cat-section { padding: 24px 32px 10px; }
    .sec-banner { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #141A21; color: #fff; padding: 14px 18px; border-radius: 6px; margin-bottom: 14px; break-inside: avoid; }
    .sec-kicker { font-family: monospace; font-size: 10px; color: #FF9E5E; font-weight: 700; letter-spacing: 0.08em; }
    .sec-title { margin: 2px 0; font-size: 18px; font-weight: 800; }
    .sec-sub { margin: 0; font-size: 11px; color: #D6D3D1; }
    .sec-note { margin-top: 4px; font-size: 10px; font-family: monospace; color: #FDBA74; }
    .sec-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; shrink: 0; }
    .sec-logo-pill { background: #fff; border-radius: 4px; padding: 5px 10px; }
    .sec-logo-pill img { height: 24px; max-width: 110px; object-fit: contain; display: block; }
    .sec-nav-pills { display: flex; align-items: center; gap: 6px; font-size: 10px; font-family: monospace; }
    .sec-count { background: rgba(255,255,255,0.14); padding: 2px 8px; border-radius: 3px; }
    .back-toc { background: rgba(234,106,18,0.22); border: 1px solid rgba(234,106,18,0.5); color: #FFEDD5; padding: 2px 7px; border-radius: 3px; }

    .prod-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .prod-card { border: 1px solid #E4E4E0; border-radius: 6px; padding: 12px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; break-inside: avoid; page-break-inside: avoid; }
    .prod-top { display: flex; gap: 11px; align-items: flex-start; }
    .prod-thumb { width: 72px; height: 72px; flex-shrink: 0; border: 1px solid #E4E4E0; border-radius: 4px; background: #FBFBFA; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 3px; }
    .prod-thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .prod-head { min-width: 0; flex: 1; }
    .prod-meta-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px; margin-bottom: 3px; font-family: monospace; font-size: 10px; }
    .badge-mpn { background: #FFF7ED; color: #C24D00; border: 1px solid #FDBA74; padding: 1px 6px; border-radius: 3px; font-weight: 700; }
    .sku-label { color: #78716C; }
    .prod-title { margin: 0 0 3px; font-size: 12.5px; font-weight: 700; color: #141A21; line-height: 1.3; }
    .prod-title a:hover { color: #C24D00; text-decoration: underline; }
    .prod-sub { font-size: 10.5px; color: #57534E; }
    .prod-desc { margin: 0; font-size: 11px; color: #44403C; line-height: 1.4; }
    .spec-pills { display: flex; flex-wrap: wrap; gap: 4px; }
    .spec-pill { font-size: 10px; background: #F5F5F4; border: 1px solid #E7E5E4; border-radius: 3px; padding: 2px 6px; color: #44403C; }
    .spec-pill strong { color: #141A21; font-family: monospace; }
    .prod-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; padding-top: 7px; border-top: 1px solid #F0F0EC; font-size: 10.5px; }
    .price-tag { font-weight: 800; color: #141A21; }
    .comm-sep { color: #57534E; font-family: monospace; font-size: 10px; }
    .prod-links { display: flex; gap: 6px; }
    .lnk-view { color: #141A21; border: 1px solid #D6D3D1; padding: 2px 7px; border-radius: 3px; font-weight: 600; font-size: 10px; }
    .lnk-wa { background: #16A34A; color: #fff; padding: 2px 8px; border-radius: 3px; font-weight: 700; font-size: 10px; }

    /* LineSheet Table */
    table.linesheet { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
    table.linesheet th { background: #141A21; color: #fff; text-align: left; padding: 7px 9px; font-family: monospace; font-size: 10px; text-transform: uppercase; }
    table.linesheet td { border-bottom: 1px solid #E4E4E0; padding: 7px 9px; vertical-align: top; }
    table.linesheet tr { break-inside: avoid; }
    table.linesheet tr:nth-child(even) td { background: #FBFBFA; }
    .row-link { font-weight: 700; color: #141A21; }
    .row-link:hover { color: #C24D00; text-decoration: underline; }
    .tbl-cta { display: inline-block; background: #C24D00; color: #fff; padding: 2px 8px; border-radius: 3px; font-weight: 700; font-size: 10px; }

    /* Individual Product Datasheet */
    .datasheet-wrap { padding: 26px 34px; }
    .datasheet-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #141A21; padding-bottom: 12px; margin-bottom: 20px; }
    .dh-logo { height: 34px; }
    .dh-sub { font-size: 10px; font-family: monospace; color: #57534E; margin-top: 3px; }
    .dh-right { text-align: right; }
    .dh-brand-logo { height: 28px; max-width: 130px; object-fit: contain; display: block; margin-left: auto; margin-bottom: 4px; }
    .dh-ref { font-size: 11px; font-family: monospace; color: #141A21; }
    .ds-hero { display: grid; grid-template-columns: 1fr 220px; gap: 20px; margin-bottom: 18px; align-items: start; }
    .ds-crumbs { font-size: 10.5px; color: #57534E; margin-bottom: 6px; }
    .ds-crumbs a { color: #C24D00; font-weight: 600; }
    .ds-title { margin: 0 0 8px; font-size: 22px; line-height: 1.2; font-weight: 800; }
    .ds-short { margin: 0 0 12px; font-size: 12.5px; color: #44403C; }
    .ds-comm-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; background: #FBFBFA; border: 1px solid #E4E4E0; border-radius: 5px; padding: 10px; margin-bottom: 12px; }
    .ds-comm-grid span { display: block; font-size: 9.5px; color: #78716C; text-transform: uppercase; }
    .ds-comm-grid strong { font-size: 11.5px; color: #141A21; }
    .ds-price-box { border: 1px solid #FDBA74; background: #FFF7ED; border-radius: 5px; padding: 11px 14px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
    .ds-price-lbl { font-size: 10px; font-family: monospace; text-transform: uppercase; color: #C24D00; font-weight: 700; }
    .ds-price-val { font-size: 14px; font-weight: 800; color: #141A21; }
    .ds-cta-group { display: flex; flex-wrap: wrap; gap: 6px; }
    .btn-wa, .btn-mail, .btn-web { padding: 6px 11px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .btn-wa { background: #16A34A; color: #fff; }
    .btn-mail { background: #141A21; color: #fff; }
    .btn-web { border: 1px solid #141A21; background: #fff; color: #141A21; }
    .ds-img-box { border: 1px solid #E4E4E0; border-radius: 6px; padding: 10px; background: #fff; display: flex; align-items: center; justify-content: center; height: 210px; }
    .ds-img-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .ds-highlights { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }
    .ds-hl-item { border: 1px solid #E4E4E0; border-radius: 4px; padding: 8px; background: #FBFBFA; }
    .ds-hl-item span { display: block; font-size: 9.5px; color: #78716C; }
    .ds-hl-item strong { font-size: 11px; font-family: monospace; color: #141A21; }
    .ds-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .ds-block { margin-bottom: 14px; }
    .ds-block h3 { margin: 0 0 8px; font-size: 13px; font-weight: 800; border-bottom: 1px solid #E4E4E0; padding-bottom: 4px; }
    .ds-para { margin: 0; font-size: 11px; color: #44403C; white-space: pre-line; }
    .ordering-box { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 5px; padding: 12px; }
    .ordering-box ul { margin: 6px 0 0 16px; padding: 0; font-size: 11px; color: #44403C; }
    .ordering-box li { margin-bottom: 4px; }
    table.spec-table { width: 100%; border-collapse: collapse; border: 1px solid #E4E4E0; font-size: 11px; }
    table.spec-table th, table.spec-table td { padding: 6px 8px; border-bottom: 1px solid #E4E4E0; text-align: left; }
    table.spec-table th { width: 40%; background: #FBFBFA; color: #57534E; font-weight: 600; }
    .compat-list { display: flex; flex-direction: column; gap: 5px; }
    .compat-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 9px; border: 1px solid #E4E4E0; border-radius: 4px; background: #FBFBFA; font-size: 11px; }
    .compat-row:hover { border-color: #C24D00; }
    .compat-row .arrow { color: #C24D00; font-weight: 700; }

    /* Commercial Terms Back Page */
    .terms-page { margin-top: 22px; background: #141A21; color: #fff; padding: 28px 34px; page-break-before: auto; break-inside: avoid; }
    .terms-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 22px; margin-top: 14px; font-size: 11.5px; color: #D6D3D1; }
    .terms-page h2 { margin: 0; font-size: 18px; color: #fff; }
    .terms-page h3 { margin: 0 0 8px; font-size: 13px; color: #FF9E5E; }
    .terms-page ul { margin: 0 0 0 16px; padding: 0; }
    .terms-page li { margin-bottom: 5px; }
    .terms-foot { margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.14); display: flex; justify-content: space-between; font-size: 10.5px; color: #A8A29E; }
    .terms-foot a { color: #FF9E5E; font-weight: 700; }

    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .container { margin: 0; max-width: none; box-shadow: none; border-radius: 0; }
      .cat-section { padding: 10px 0 6px; }
      .toc-page { padding: 14px 4px; }
      .cover { min-height: 268mm; }
    }
    @media (max-width: 760px) {
      .toc-grid, .prod-grid, .guide-types, .ds-hero, .ds-cols, .ds-highlights, .cover-stats, .terms-grid { grid-template-columns: 1fr; }
      .cover { padding: 28px 22px; min-height: auto; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <strong>${escHtml(companyName)} Catalogue Studio</strong>
      <span class="toolbar-badge">${escHtml(rows.length.toLocaleString("en-IN"))} / ${escHtml(
        totalMatching.toLocaleString("en-IN")
      )} SKUs</span>
      <a href="#toc" style="color:#D6D3D1;text-decoration:underline;">Table of Contents</a>
      <a href="#terms" style="color:#D6D3D1;text-decoration:underline;">Terms &amp; RFQ Desk</a>
    </div>
    <div class="toolbar-actions">
      <button type="button" onclick="window.print()" class="tb-btn tb-primary">Save as PDF / Print</button>
      <a href="${escHtml(
        `/api/admin/catalogue?scope=${encodeURIComponent(params.scope)}${
          params.slug ? `&slug=${encodeURIComponent(params.slug)}` : ""
        }&layout=${layout}&images=${includeImages ? "1" : "0"}&prices=${
          showPrices ? "1" : "0"
        }&limit=${safeLimit}&offset=${safeOffset}${
          params.preparedFor ? `&preparedFor=${encodeURIComponent(params.preparedFor)}` : ""
        }&download=1`
      )}" class="tb-btn">Download Standalone HTML</a>
    </div>
  </div>

  <div class="container">
    <!-- COVER PAGE -->
    <header id="cover" class="cover">
      <div class="cover-top">
        <div>
          <img src="${escHtml(mainLogoData)}" alt="${escHtml(companyName)}" class="cover-logo" />
          <div style="font-size:11px;color:#A8A29E;margin-top:8px;font-family:monospace;">
            B2B INDUSTRIAL MRO • AGRI • SPECIAL ITEMS SUPPLY PARTNER
          </div>
        </div>
        ${
          targetBrandLogoUri
            ? `<div class="cover-brand-box"><img src="${escHtml(targetBrandLogoUri)}" alt="${escHtml(
                targetBrand?.name || ""
              )}" class="cover-brand-logo" /></div>`
            : ""
        }
      </div>

      <div class="cover-mid">
        <div class="cover-accent"></div>
        <div class="cover-kicker">${escHtml(params.scope.toUpperCase())} PROCUREMENT CATALOGUE • ${escHtml(
          generatedDate
        )}</div>
        <h1 class="cover-h1">${escHtml(fullDocTitle)}</h1>
        <p class="cover-tagline">${escHtml(
          targetBrand?.description ||
            targetCategory?.description ||
            companyTagline
        )}</p>
        ${
          params.preparedFor
            ? `<div class="prepared-pill">Prepared For: <strong>${escHtml(params.preparedFor)}</strong></div>`
            : ""
        }
        <div class="cover-stats">
          <div class="cover-stat"><span>Catalogued SKUs</span><strong>${escHtml(
            totalMatching.toLocaleString("en-IN")
          )}</strong></div>
          <div class="cover-stat"><span>Brands Included</span><strong>${escHtml(
            brandStatsMap.size || 1
          )}</strong></div>
          <div class="cover-stat"><span>Dispatch Scope</span><strong>Pan-India GST</strong></div>
          <div class="cover-stat"><span>Lead Time</span><strong>Confirmed on PO</strong></div>
        </div>

        <div class="cover-jump">
          <a href="#toc">Browse Table of Contents ↓</a>
          ${
            params.scope === "category" && categoryGuide
              ? `<a href="#category-guide" class="sec">Technical Sizing Guide ↓</a>`
              : ""
          }
          <a href="#terms" class="sec">RFQ Desk &amp; Terms ↓</a>
        </div>
      </div>

      <div class="cover-bottom">
        <div><strong>${escHtml(companyName)}</strong> — ${escHtml(companyAddress)}</div>
        <div>WhatsApp / Call: <strong>${escHtml(companyPhone)}</strong> • Email: <strong>${escHtml(
          companyEmail
        )}</strong></div>
      </div>
    </header>

    <!-- COMPANY PROFILE & INTERACTIVE TABLE OF CONTENTS -->
    <section id="toc" class="toc-page">
      <div class="page-head">
        <img src="${escHtml(darkLogoData)}" alt="${escHtml(companyName)}" />
        <div class="page-head-meta">${escHtml(docTitle)} • Click any section to jump directly</div>
      </div>

      <div class="toc-grid">
        <div>
          <h2 style="margin:0 0 6px;font-size:18px;">Interactive Table of Contents</h2>
          <p style="margin:0;font-size:11.5px;color:#57534E;">Click any section below to navigate inside this PDF / HTML catalogue.</p>
          <ul class="toc-list">
            ${tocLinksHtml}
            <li><a href="#terms"><span>Commercial Terms, GST Billing &amp; Consolidated RFQ Desk</span><span class="toc-count">Jump →</span></a></li>
          </ul>
        </div>

        <div class="company-card">
          <h3>About ${escHtml(companyName)}</h3>
          <p>Multi-brand wholesale industrial &amp; MRO supply partner based in Secunderabad, Telangana, delivering across India with full GST tax invoicing, verified OEM sourcing, and responsive technical support.</p>
          <p><strong>Phone / WhatsApp:</strong> ${escHtml(companyPhone)}<br/><strong>Email:</strong> ${escHtml(
            companyEmail
          )}<br/><strong>Website:</strong> <a href="${escHtml(origin)}" target="_blank" style="color:#C24D00;text-decoration:underline;">${escHtml(
            origin
          )}</a>${companyGstin ? `<br/><strong>GSTIN:</strong> ${escHtml(companyGstin)}` : ""}</p>

          ${
            brandStatsMap.size > 1
              ? `<h3 style="margin-top:14px;">Brands Covered (${brandStatsMap.size})</h3>
                 <div class="brand-chips">${Array.from(brandStatsMap.values())
                   .slice(0, 32)
                   .map(
                     (b) => `<a href="#${escHtml(b.anchorId)}" class="brand-chip">
                       ${b.logoUri ? `<img src="${escHtml(b.logoUri)}" alt="${escHtml(b.name)}" />` : ""}
                       <span>${escHtml(b.name)}</span>
                       <span class="cnt">(${b.count})</span>
                     </a>`
                   )
                   .join("")}</div>`
              : ""
          }
        </div>
      </div>
    </section>

    ${categoryGuideHtml}

    <!-- PRODUCT CATALOGUE BODY -->
    ${sectionsHtml}

    <!-- COMMERCIAL TERMS & ENQUIRY DESK -->
    <footer id="terms" class="terms-page">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
        <div>
          <h2>Commercial Terms &amp; Bulk Procurement Desk</h2>
          <p style="margin:4px 0 0;font-size:11.5px;color:#A8A29E;">Consolidated multi-brand quotations on a single GST invoice from ${escHtml(
            companyName
          )}.</p>
        </div>
        <img src="${escHtml(mainLogoData)}" alt="${escHtml(companyName)}" style="height:34px;" />
      </div>

      <div class="terms-grid">
        <div>
          <h3>Standard Commercial Terms</h3>
          <ul>
            <li>Quotations remain valid for <strong>7 days</strong> from issue date unless otherwise agreed in writing.</li>
            <li>Delivery &amp; dispatch schedules are <strong>Confirmed Upon Order</strong> based on real-time OEM / warehouse allocation.</li>
            <li>GST charged as applicable per HSN classification with full B2B GST credit invoicing.</li>
            <li>Before ordering precision/MIL-spec tools or configured pneumatic actuators, please verify exact part numbers, accessories (e.g. turret heads, mounting kits), and calibration requirements with our team.</li>
          </ul>
        </div>
        <div>
          <h3>Direct Quote &amp; Order Desk</h3>
          <p style="margin:0 0 8px;"><strong>${escHtml(companyName)}</strong><br/>${escHtml(companyAddress)}</p>
          <p style="margin:0 0 10px;">WhatsApp / Phone: <strong>${escHtml(companyPhone)}</strong><br/>Email: <strong>${escHtml(
            companyEmail
          )}</strong><br/>Catalog URL: <a href="${escHtml(origin)}" target="_blank" style="color:#FF9E5E;text-decoration:underline;">${escHtml(
            origin
          )}</a></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="https://wa.me/${escHtml(whatsappNumber)}" target="_blank" style="background:#16A34A;color:#fff;padding:6px 12px;border-radius:4px;font-weight:700;font-size:11px;">Chat on WhatsApp ↗</a>
            <a href="mailto:${escHtml(companyEmail)}" style="background:#EA6A12;color:#fff;padding:6px 12px;border-radius:4px;font-weight:700;font-size:11px;">Email BOM / RFQ ↗</a>
          </div>
        </div>
      </div>

      <div class="terms-foot">
        <span>Generated on ${escHtml(generatedDate)} • ${escHtml(companyName)}</span>
        <span><a href="#cover">↑ Cover</a> &nbsp;|&nbsp; <a href="#toc">↑ Table of Contents</a></span>
      </div>
    </footer>
  </div>
  ${
    params.autoPrint
      ? `<script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 350); });</script>`
      : ""
  }
</body>
</html>`;

  const slugPart = params.slug ? `-${params.slug}` : "";
  const volPart =
    totalMatching > safeLimit ? `-part-${Math.floor(safeOffset / safeLimit) + 1}` : "";
  const filename = `radiant-${params.scope}-catalogue${slugPart}${volPart}.html`.replace(
    /[^a-z0-9._-]+/gi,
    "-"
  );

  return {
    html,
    filename,
    totalMatching,
    renderedCount: rows.length,
    title: fullDocTitle,
  };
}
