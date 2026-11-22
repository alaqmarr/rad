import { eq } from "drizzle-orm";
import { brands, categories, db, products } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function toSlug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchText(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      if (attempt === 3) return null;
      await new Promise((res) => setTimeout(res, 300 * attempt));
    }
  }
  return null;
}

async function loadUnbrako(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "unbrako"));
  if (!brandRow) throw new Error("Brand 'unbrako' not found.");

  const targetCat =
    catBySlug["fasteners-bolts-anchors"] ||
    catBySlug["tools-cutting-machining"] ||
    Object.values(catBySlug)[0];

  const categoryPages = [
    { path: "socket-screws", family: "Socket Screws" },
    { path: "pins", family: "Precision Pins" },
    { path: "wrenches", family: "Hex Key Wrenches" },
    { path: "hex-bolts", family: "High-Tensile Hex Bolts" },
    { path: "hex-nuts", family: "High-Tensile Hex Nuts" },
    { path: "petrochemical-studbolts", family: "Petrochemical Studbolts" },
  ];

  const toInsert: Array<typeof products.$inferInsert> = [];

  for (const cp of categoryPages) {
    const html = await fetchText(`https://unbrako.com/${cp.path}`);
    if (!html) continue;

    for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = tr[1];
      if (/<th\b/i.test(rowHtml)) continue;
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (cells.length < 2) continue;

      const rawName = htmlToCleanText(cells[0], true);
      if (!rawName || rawName.length < 3 || /^product$/i.test(rawName)) continue;

      const imgPath =
        rowHtml.match(/href=["'](images\/product\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i)?.[1] ||
        rowHtml.match(/src=["'](images\/product\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i)?.[1] ||
        null;
      const imageUrl = imgPath ? `https://unbrako.com/${imgPath.replace(/^\/+/, "")}` : null;

      const sizeRange = htmlToCleanText(cells[2], true);
      const grade = htmlToCleanText(cells[3], true);
      const asme = htmlToCleanText(cells[4], true);
      const iso = htmlToCleanText(cells[5], true);
      const din = htmlToCleanText(cells[6], true);

      const fullName = rawName.toLowerCase().includes("unbrako") ? rawName : `Unbrako ${rawName}`;
      const dbSku = `UNB-${toSlug(rawName).toUpperCase()}`.slice(0, 56);
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`unbrako-${rawName}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const specs = [
        { label: "Brand", value: "Unbrako" },
        { label: "Category", value: cp.family },
        ...(sizeRange ? [{ label: "Size Range", value: sizeRange }] : []),
        ...(grade ? [{ label: "Property Class / Grade", value: grade }] : []),
        ...(asme ? [{ label: "ASME Standard", value: asme }] : []),
        ...(iso ? [{ label: "ISO Standard", value: iso }] : []),
        ...(din ? [{ label: "DIN Standard", value: din }] : []),
      ];

      const shortDesc = `${fullName}${sizeRange ? ` (${sizeRange})` : ""}${
        grade ? ` • Grade ${grade}` : ""
      }. Genuine Unbrako high-tensile fastener.`.slice(0, 220);

      const fullDesc = [
        `${fullName} — precision engineered high-tensile industrial fastener from Unbrako.`,
        sizeRange ? `Available Diameter / Size Range: ${sizeRange}` : "",
        grade ? `Material Grade / Property Class: ${grade}` : "",
        [asme && `ASME ${asme}`, iso && `ISO ${iso}`, din && `DIN ${din}`].filter(Boolean).join(" | "),
        "",
        "Before Ordering: Specify thread diameter (M / UNC / UNF / BSW), length (mm / inch), coating/finish, and standard box quantity.",
      ]
        .filter(Boolean)
        .join("\n");

      toInsert.push({
        slug: safeSlug,
        sku: dbSku,
        name: fullName,
        shortDescription: shortDesc,
        description: fullDesc,
        divisionId: targetCat.divisionId,
        categoryId: targetCat.id,
        brandId: brandRow.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "100 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "7318",
        specificationsJson: JSON.stringify(specs),
        primaryImageUrl: imageUrl,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${fullName} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }

  return {
    brand: "unbrako",
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function loadDowtyTrelleborg(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "dowty"));
  if (!brandRow) throw new Error("Brand 'dowty' not found.");

  const targetCat =
    catBySlug["bearings-transmission"] ||
    catBySlug["pipes-valves-fittings"] ||
    Object.values(catBySlug)[0];

  const base = "https://www.trelleborg.com/en/seals/products-and-solutions/static-seals";
  const indexHtml = await fetchText(base);
  const sealUrls = new Set<string>([`${base}/bonded-seal`]);
  if (indexHtml) {
    for (const m of indexHtml.matchAll(/href=["'](\/en\/seals\/products-and-solutions\/static-seals\/[^"']+)["']/gi)) {
      sealUrls.add(`https://www.trelleborg.com${m[1]}`);
    }
  }

  const toInsert: Array<typeof products.$inferInsert> = [];
  for (const url of sealUrls) {
    const html = await fetchText(url);
    if (!html) continue;
    const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], true);
    if (!h1 || h1.length < 3) continue;

    const rawImg = html.match(/\/seals\/-\/media\/[^"'\s)]+\.(?:jpg|jpeg|png|gif|webp)[^"'\s)]*/i)?.[0] || null;
    const imageUrl = rawImg ? `https://www.trelleborg.com${htmlToCleanText(rawImg, true)}` : null;

    const desc = htmlToCleanText(
      html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1],
      false
    );
    const leaf = url.split("/").filter(Boolean).pop() || toSlug(h1);
    const fullName = /dowty|bonded/i.test(h1) ? `Dowty ${h1}` : `Dowty / Trelleborg ${h1}`;
    const dbSku = `DWT-${leaf.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
      0,
      56
    );
    if (existingSkus.has(dbSku)) continue;
    existingSkus.add(dbSku);

    let safeSlug = toSlug(`dowty-${leaf}`);
    if (existingSlugs.has(safeSlug)) {
      let sfx = 2;
      while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
      safeSlug = `${safeSlug}-${sfx}`;
    }
    existingSlugs.add(safeSlug);

    const shortDesc = `${fullName} — high-pressure metallic & elastomer hydraulic static/bonded seal. Verify BSP/Metric size before order.`.slice(
      0,
      220
    );

    toInsert.push({
      slug: safeSlug,
      sku: dbSku,
      name: fullName,
      shortDescription: shortDesc,
      description: [
        desc || `${fullName} — precision static & hydraulic sealing washer solution.`,
        "",
        "Before Ordering: Specify BSP (1/8\" to 2\") or Metric (M4 to M60) inner/outer diameter, elastomer (NBR / FKM Viton), and ring metal (Mild Steel / SS316).",
      ].join("\n"),
      divisionId: targetCat.divisionId,
      categoryId: targetCat.id,
      brandId: brandRow.id,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: "25 NOS",
      leadTime: "Confirmed Upon Order",
      hsnCode: "4016",
      specificationsJson: JSON.stringify([
        { label: "Brand", value: "Dowty (Trelleborg Sealing Solutions)" },
        { label: "Seal Type", value: h1 },
      ]),
      primaryImageUrl: imageUrl,
      galleryJson: JSON.stringify([]),
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${fullName} | Radiant Industrial Co.`,
      seoDescription: shortDesc,
    });
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }

  return {
    brand: "dowty",
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function loadFevicolOfficial(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brandRow] = await db.select().from(brands).where(eq(brands.slug, "fevicol"));
  if (!brandRow) throw new Error("Brand 'fevicol' not found.");

  const targetCat = catBySlug["lubricants-adhesives-abrasives"] || Object.values(catBySlug)[0];
  const sitemaps = [
    "https://fevicol.in/wp-sitemap-posts-fevicol-porduct-1.xml",
    "https://fevicol.in/wp-sitemap-posts-our-product-1.xml",
  ];
  const urls = new Set<string>();
  for (const sm of sitemaps) {
    const xml = await fetchText(sm);
    if (!xml) continue;
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) urls.add(m[1].trim());
  }
  for (const catUrl of [
    "https://fevicol.in/wood-work-adhesive/",
    "https://fevicol.in/flooring-footwear/",
    "https://fevicol.in/foam-upholstery/",
    "https://fevicol.in/joineries/",
  ]) {
    const h = await fetchText(catUrl);
    if (!h) continue;
    for (const m of h.matchAll(/href=["'](https?:\/\/fevicol\.in\/(?:fevicol-porduct|our-product|wood-work-adhesive|joineries)\/[^"']+)["']/gi)) {
      urls.add(m[1]);
    }
  }

  const toInsert: Array<typeof products.$inferInsert> = [];
  for (const url of urls) {
    const html = await fetchText(url);
    if (!html) continue;
    const h1 = htmlToCleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], true);
    const title = htmlToCleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], true)?.split("–")[0]?.trim();
    const name = h1 || title || "";
    if (!name || /page not found|oops/i.test(name)) continue;

    const rawImg = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
      .map((m) => m[1].trim())
      .find((s) => s.includes("/wp-content/uploads/") && !/logo|cropped/i.test(s));
    const imageUrl = rawImg || null;

    const leaf = url.split("/").filter(Boolean).pop() || toSlug(name);
    const dbSku = `FVL-${leaf.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
      0,
      56
    );
    if (existingSkus.has(dbSku)) continue;
    existingSkus.add(dbSku);

    let safeSlug = toSlug(`fevicol-${leaf}`);
    if (existingSlugs.has(safeSlug)) {
      let sfx = 2;
      while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
      safeSlug = `${safeSlug}-${sfx}`;
    }
    existingSlugs.add(safeSlug);

    const shortDesc = `${name} — genuine Pidilite Fevicol industrial & woodworking adhesive. Confirm pack size (500g / 1kg / 5kg / 20kg / 50kg) before order.`.slice(
      0,
      220
    );

    toInsert.push({
      slug: safeSlug,
      sku: dbSku,
      name,
      shortDescription: shortDesc,
      description: `${name} — high-strength bonding adhesive from Pidilite Fevicol supplied in bulk buckets, tins, and drums by Radiant Industrial Co.`,
      divisionId: targetCat.divisionId,
      categoryId: targetCat.id,
      brandId: brandRow.id,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: "1 NOS",
      leadTime: "Confirmed Upon Order",
      hsnCode: "3506",
      specificationsJson: JSON.stringify([
        { label: "Brand", value: "Fevicol (Pidilite)" },
        { label: "Product Code", value: leaf.toUpperCase() },
      ]),
      primaryImageUrl: imageUrl,
      galleryJson: JSON.stringify([]),
      inStockStatus: "Available to Order",
      isFeatured: false,
      isActive: true,
      seoTitle: `${name} | Radiant Industrial Co.`,
      seoDescription: shortDesc,
    });
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await db
      .insert(products)
      .values(toInsert.slice(i, i + 100))
      .onConflictDoNothing({ target: products.sku });
  }

  return {
    brand: "fevicol",
    inserted: toInsert.length,
    withImages: toInsert.filter((x) => Boolean(x.primaryImageUrl)).length,
  };
}

async function fetchAllShopify(domain: string): Promise<any[]> {
  const all: any[] = [];
  for (let p = 1; p <= 25; p++) {
    const raw = await fetchText(`https://${domain}/products.json?limit=250&page=${p}`);
    if (!raw) break;
    let parsed: { products?: any[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      break;
    }
    if (!parsed.products?.length) break;
    all.push(...parsed.products);
    if (parsed.products.length < 250) break;
  }
  return all;
}

async function load3mAndEsab(
  catBySlug: Record<string, { id: number; divisionId: number }>,
  existingSkus: Set<string>,
  existingSlugs: Set<string>
) {
  const [brand3m] = await db.select().from(brands).where(eq(brands.slug, "3m-industrial"));
  const [brandEsab] = await db.select().from(brands).where(eq(brands.slug, "esab"));

  const [lionProds, pioneerProds] = await Promise.all([
    fetchAllShopify("www.liontoolsmart.com"),
    fetchAllShopify("pioneerpowertools.in"),
  ]);

  const safety3mProds: any[] = [];
  for (let p = 1; p <= 5; p++) {
    const raw = await fetchText(`https://safetycart.in/wp-json/wc/store/v1/products?per_page=100&page=${p}`);
    if (!raw) break;
    const list = JSON.parse(raw) as any[];
    if (!Array.isArray(list) || list.length === 0) break;
    safety3mProds.push(...list);
    if (list.length < 100) break;
  }

  const results: Array<{ brand: string; inserted: number; withImages: number }> = [];

  if (brand3m) {
    const toInsert3m: Array<typeof products.$inferInsert> = [];
    const defaultCat3m = catBySlug["safety-ppe"] || Object.values(catBySlug)[0];

    for (const item of [...lionProds, ...pioneerProds]) {
      const vendor = String(item.vendor || "").trim();
      const rawTitle = htmlToCleanText(item.title, true);
      const is3mBrand =
        /^3m\b/i.test(vendor) || /^(?:3m|scotch(?:-brite|-weld)?)\b/i.test(rawTitle);
      if (!is3mBrand) continue;
      const name = rawTitle;
      const skuVal = String(item.variants?.[0]?.sku || item.handle || name).trim();
      const dbSku = `3M-${skuVal.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
        0,
        56
      );
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`3m-${item.handle || name}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const cat = /tape|adhesive|abrasive|disc|sand|glue|sealant/i.test(name)
        ? catBySlug["lubricants-adhesives-abrasives"] || defaultCat3m
        : defaultCat3m;
      const desc = htmlToCleanText(item.body_html, false);
      const shortDesc = `${name} — genuine 3M Industrial / Safety supply. Verify pack size & part number before ordering.`.slice(
        0,
        220
      );

      toInsert3m.push({
        slug: safeSlug,
        sku: dbSku,
        name,
        shortDescription: shortDesc,
        description: desc || `${name} — genuine 3M India industrial & personal protective equipment.`,
        divisionId: cat.divisionId,
        categoryId: cat.id,
        brandId: brand3m.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: /tape|abrasive|disc/i.test(name) ? "6805" : "9004",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "3M Industrial" },
          { label: "Model / Code", value: skuVal },
        ]),
        primaryImageUrl: item.images?.[0]?.src || null,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }

    for (const item of safety3mProds) {
      const name = htmlToCleanText(item.name, true);
      if (!/^(?:3m|scotch(?:-brite|-weld)?)\b/i.test(name)) continue;
      const code = String(item.sku || item.slug || name).trim();
      const dbSku = `3M-${code.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
        0,
        56
      );
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`3m-${item.slug || name}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const desc =
        htmlToCleanText(item.description, false) || htmlToCleanText(item.short_description, false);
      const shortDesc = `${name} — genuine 3M Safety PPE product. Confirm certification & pack quantity before ordering.`.slice(
        0,
        220
      );

      toInsert3m.push({
        slug: safeSlug,
        sku: dbSku,
        name,
        shortDescription: shortDesc,
        description: desc || `${name} — certified 3M workplace respiratory, hearing & eye protection.`,
        divisionId: defaultCat3m.divisionId,
        categoryId: defaultCat3m.id,
        brandId: brand3m.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "6307",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "3M Safety & Industrial" },
          { label: "Code", value: code },
        ]),
        primaryImageUrl: item.images?.[0]?.src || null,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }

    for (let i = 0; i < toInsert3m.length; i += 100) {
      await db
        .insert(products)
        .values(toInsert3m.slice(i, i + 100))
        .onConflictDoNothing({ target: products.sku });
    }
    results.push({
      brand: "3m-industrial",
      inserted: toInsert3m.length,
      withImages: toInsert3m.filter((x) => Boolean(x.primaryImageUrl)).length,
    });
  }

  if (brandEsab) {
    const toInsertEsab: Array<typeof products.$inferInsert> = [];
    const defaultCatEsab = catBySlug["welding-fabrication"] || Object.values(catBySlug)[0];

    for (const item of [...pioneerProds, ...lionProds]) {
      const hay = `${item.vendor || ""} ${item.title || ""}`;
      if (!/\besab\b/i.test(hay)) continue;
      const name = htmlToCleanText(item.title, true);
      const skuVal = String(item.variants?.[0]?.sku || item.handle || name).trim();
      const dbSku = `ESAB-${skuVal.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(
        0,
        56
      );
      if (existingSkus.has(dbSku)) continue;
      existingSkus.add(dbSku);

      let safeSlug = toSlug(`esab-${item.handle || name}`);
      if (existingSlugs.has(safeSlug)) {
        let sfx = 2;
        while (existingSlugs.has(`${safeSlug}-${sfx}`)) sfx++;
        safeSlug = `${safeSlug}-${sfx}`;
      }
      existingSlugs.add(safeSlug);

      const desc = htmlToCleanText(item.body_html, false);
      const shortDesc = `${name} — genuine ESAB welding & cutting equipment. Confirm duty cycle, phase & accessories before ordering.`.slice(
        0,
        220
      );

      toInsertEsab.push({
        slug: safeSlug,
        sku: dbSku,
        name,
        shortDescription: shortDesc,
        description: desc || `${name} — genuine ESAB welding inverter, torch & consumable solution.`,
        divisionId: defaultCatEsab.divisionId,
        categoryId: defaultCatEsab.id,
        brandId: brandEsab.id,
        pricingMode: "rfq_only",
        basePrice: null,
        priceUnit: "NOS",
        gstPercent: 18,
        moq: "1 NOS",
        leadTime: "Confirmed Upon Order",
        hsnCode: "8515",
        specificationsJson: JSON.stringify([
          { label: "Brand", value: "ESAB" },
          { label: "Model / Code", value: skuVal },
        ]),
        primaryImageUrl: item.images?.[0]?.src || null,
        galleryJson: JSON.stringify([]),
        inStockStatus: "Available to Order",
        isFeatured: false,
        isActive: true,
        seoTitle: `${name} | Radiant Industrial Co.`,
        seoDescription: shortDesc,
      });
    }

    for (let i = 0; i < toInsertEsab.length; i += 100) {
      await db
        .insert(products)
        .values(toInsertEsab.slice(i, i + 100))
        .onConflictDoNothing({ target: products.sku });
    }
    results.push({
      brand: "esab",
      inserted: toInsertEsab.length,
      withImages: toInsertEsab.filter((x) => Boolean(x.primaryImageUrl)).length,
    });
  }

  return results;
}

async function main() {
  const allCats = await db.select().from(categories);
  const catBySlug: Record<string, { id: number; divisionId: number }> = {};
  for (const c of allCats) catBySlug[c.slug] = { id: c.id, divisionId: c.divisionId };

  const existingRows = await db.select({ sku: products.sku, slug: products.slug }).from(products);
  const existingSkus = new Set(existingRows.map((r) => r.sku));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  const res = [
    await loadUnbrako(catBySlug, existingSkus, existingSlugs),
    await loadDowtyTrelleborg(catBySlug, existingSkus, existingSlugs),
    await loadFevicolOfficial(catBySlug, existingSkus, existingSlugs),
    ...(await load3mAndEsab(catBySlug, existingSkus, existingSlugs)),
  ];

  console.log(JSON.stringify(res, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-fasteners-seals-adhesives] Error:", err);
    process.exit(1);
  });
