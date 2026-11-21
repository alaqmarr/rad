import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, ensureDbReady, divisions, categories, brands, products } from "../src/db";
import {
  buildEnrichedSpecifications,
  extractManufacturerPartNumber,
  parseSpecsJson,
} from "../src/lib/product-enrichment";
import { htmlToCleanText } from "../src/lib/sanitize-text";

async function main() {
  await ensureDbReady();
  console.log("=== Enriching Buyer-Intent SEO, Categories & Verified Specs ===");

  // 1. Ensure Industrial division & Pneumatic Cylinders category exist
  const [indDiv] = await db
    .select()
    .from(divisions)
    .where(eq(divisions.slug, "industrial"))
    .limit(1);
  if (!indDiv) {
    throw new Error("Industrial division not found in DB.");
  }

  await db
    .insert(categories)
    .values({
      slug: "pneumatic-cylinders",
      name: "Pneumatic Cylinders & Actuators",
      description:
        "ISO 15552 profile cylinders (DSBC, DNC), ISO 21287 compact cylinders (ADN, AEN, ADNGF), ISO 6432 round cylinders (DSNU), guided drives (DFM), rodless linear actuators (DGC), and shock absorbers supplied across India.",
      divisionId: indDiv.id,
      sortOrder: 4,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: "Pneumatic Cylinders & Actuators",
        description:
          "ISO 15552 profile cylinders (DSBC, DNC), ISO 21287 compact cylinders (ADN, AEN, ADNGF), ISO 6432 round cylinders (DSNU), guided drives (DFM), rodless linear actuators (DGC), and shock absorbers supplied across India.",
        divisionId: indDiv.id,
        sortOrder: 4,
        isActive: true,
      },
    });

  const [pneuCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "pneumatic-cylinders"))
    .limit(1);

  if (!pneuCat) {
    throw new Error("Failed to create pneumatic-cylinders category.");
  }

  // 2. Move Festo cylinder / linear drive / actuator SKUs into pneumatic-cylinders cleanly
  const [festoBrand] = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "festo"))
    .limit(1);

  let movedCylinders = 0;
  if (festoBrand) {
    const festoProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.brandId, festoBrand.id), eq(products.isActive, true)));

    const cylinderPattern =
      /cylinder|linear drive|linear actuator|semi-rotary|rotary drive|guided drive|mini slide|bellows|cartridge cylinder|shock absorber|actuator attachment|actuator-specific|stopper/i;
    const excludePattern = /ball valve actuator unit/i;

    const toMoveIds = festoProducts
      .filter((p) => cylinderPattern.test(p.name) && !excludePattern.test(p.name))
      .map((p) => p.id);

    if (toMoveIds.length > 0) {
      await db
        .update(products)
        .set({ categoryId: pneuCat.id, updatedAt: new Date().toISOString() })
        .where(inArray(products.id, toMoveIds));
      movedCylinders = toMoveIds.length;
    }
  }
  console.log(`Moved ${movedCylinders} Festo cylinder/actuator models to /categories/pneumatic-cylinders.`);

  // 3. Flagship Part-Number SEO & Verified Spec Updates (DMC Tools + Companions)
  const flagshipUpdates: Array<{
    slug: string;
    seoTitle: string;
    seoDescription: string;
    shortDescription?: string;
    extraSpecs: Array<{ label: string; value: string }>;
  }> = [
    {
      slug: "dmc-tools-af8",
      seoTitle: "DMC AF8 Adjustable Crimp Tool | Radiant Industrial Co.",
      seoDescription:
        "Buy genuine DMC AF8 (MIL-DTL-22520/1* / AS22520/1*) 8-indent adjustable crimp tool in India (12-26 AWG). Compatible TH turret heads, TP positioners, UH2-5 & G125 gages supplied on quote.",
      shortDescription:
        "MIL-DTL-22520/1* (AS22520/1*) heavy-duty 8-indent adjustable crimp tool frame for 12–26 AWG contacts with 8-position precision selector knob. Compatible with TH turret heads, TP positioners & M22520/3-1 (G125) gage.",
      extraSpecs: [
        { label: "Manufacturer Part No.", value: "AF8* (MIL-DTL-22520/1-01)" },
        { label: "MIL-Spec Qualification", value: "MIL-DTL-22520/1*, AS22520/1*" },
        { label: "Wire Range", value: "12 – 26 AWG (machined closed-barrel contacts)" },
        { label: "Crimp Configuration", value: "8-Indent Cycle-Controlled Ratchet, 8-Position Selector Knob" },
        { label: "Compatible Heads", value: "TH-Series Turret Heads, TP-Series Positioners, UH2-5 Universal Head (sold separately)" },
        { label: "Calibration Gage", value: "M22520/3-1 Go/No-Go Gage (DMC G125 on SEL #4) or 88-100 Gage Set" },
        { label: "Dimensions & Weight", value: "9.75\" × 2.5\" × 1.25\" | ~15 oz (425 g)" },
      ],
    },
    {
      slug: "dmc-tools-afm8",
      seoTitle: "DMC AFM8 Miniature Adjustable Crimp Tool | Radiant Industrial Co.",
      seoDescription:
        "Genuine DMC AFM8* (MIL-DTL-22520/2* / AS22520/2*) 8-indent miniature crimp tool for 20-32 AWG connectors supplied across India with compatible positioners & G125 gage.",
      extraSpecs: [
        { label: "Manufacturer Part No.", value: "AFM8* (MIL-DTL-22520/2-01)" },
        { label: "MIL-Spec Qualification", value: "MIL-DTL-22520/2*, AS22520/2*" },
        { label: "Wire Range", value: "20 – 32 AWG (miniature / sub-miniature contacts)" },
        { label: "Crimp Configuration", value: "8-Indent Precision Ratchet, 8-Step Selector Knob" },
        { label: "Calibration Gage", value: "M22520/3-1 Go/No-Go Gage (DMC G125 on SEL #8)" },
        { label: "Dimensions & Weight", value: "6.75\" length | ~10 oz (285 g)" },
      ],
    },
    {
      slug: "dmc-tools-mh860-mh860",
      seoTitle: "DMC MH860 Adjustable Middle Range Crimp Tool | Radiant Industrial Co.",
      seoDescription:
        "Genuine DMC MH860* (MIL-DTL-22520/7* / AS22520/7*) 8-indent crimp tool for 16-32 AWG contacts using DMC 86-type positioners. Pan-India GST wholesale supply.",
      extraSpecs: [
        { label: "Manufacturer Part No.", value: "MH860* (MIL-DTL-22520/7-01)" },
        { label: "MIL-Spec Qualification", value: "MIL-DTL-22520/7*, AS22520/7*" },
        { label: "Wire Range", value: "16 – 32 AWG" },
        { label: "Compatible Positioners", value: "DMC 86-Series Positioners" },
      ],
    },
    {
      slug: "dmc-tools-g125",
      seoTitle: "DMC G125 (M22520/3-1) Go/No-Go Calibration Gage | Radiant Industrial Co.",
      seoDescription:
        "Official DMC G125 (M22520/3-1) Go/No-Go calibration gage (.0390 GO / .0440 NO-GO) for AF8, AFM8 & M22520 series 8-indent crimp tools across India.",
      extraSpecs: [
        { label: "Manufacturer Part No.", value: "G125 (MIL-DTL-22520/3-1)" },
        { label: "Tolerance Window", value: "GO .0390\" / NO-GO .0440\"" },
        { label: "Compatible Crimp Tools", value: "DMC AF8* (SEL #4), AFM8* (SEL #8), WA27F, AFE8B" },
      ],
    },
    {
      slug: "dmc-tools-88-100",
      seoTitle: "DMC 88-100 Go/No-Go Gage Set (Selectors 1-8) for AF8 | Radiant Industrial Co.",
      seoDescription:
        "DMC 88-100 full 8-position Go/No-Go calibration gage set for verifying DMC AF8 crimp indenter closure across selector settings 1 through 8.",
      extraSpecs: [
        { label: "Manufacturer Part No.", value: "88-100" },
        { label: "Coverage", value: "All Selector Settings 1 – 8" },
        { label: "Compatible Crimp Tool", value: "DMC AF8 / AF8* (MIL-DTL-22520/1)" },
      ],
    },
    {
      slug: "dmc-tools-dmc1186",
      seoTitle: "DMC1186 AF8 Complete Tool Kit with Turrets & G125 Gage | Radiant Industrial Co.",
      seoDescription:
        "Complete DMC1186 aerospace tooling kit including the DMC AF8 frame, M22520/1-02 to M22520/1-18 turret heads/positioners, and G125 Go/No-Go gage.",
      extraSpecs: [
        { label: "Manufacturer Part No.", value: "DMC1186" },
        { label: "Included Frame", value: "DMC AF8* (MIL-DTL-22520/1-01)" },
        { label: "Included Accessories", value: "M22520/1-02 to M22520/1-18 Heads & DMC G125 Gage" },
      ],
    },
  ];

  for (const item of flagshipUpdates) {
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.slug, item.slug))
      .limit(1);
    if (!existing) continue;

    const currentSpecs = parseSpecsJson(existing.specificationsJson);
    const mergedMap = new Map<string, { label: string; value: string }>();
    for (const s of [...item.extraSpecs, ...currentSpecs]) {
      const k = s.label.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!mergedMap.has(k)) mergedMap.set(k, s);
    }

    await db
      .update(products)
      .set({
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        ...(item.shortDescription ? { shortDescription: item.shortDescription } : {}),
        specificationsJson: JSON.stringify(Array.from(mergedMap.values())),
        isFeatured: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(products.id, existing.id));
  }
  console.log(`Updated ${flagshipUpdates.length} flagship buyer-search products.`);

  // 4. Enrich Festo Pneumatic Cylinders & Thin-Spec Active Products Across Catalog
  const allRows = await db
    .select({
      product: products,
      brandName: brands.name,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true));

  let enrichedSpecsCount = 0;
  let enrichedMetaCount = 0;

  for (const row of allRows) {
    const p = row.product;
    const rawSpecs = parseSpecsJson(p.specificationsJson);
    const mpn = extractManufacturerPartNumber(p.sku, rawSpecs);
    const cleanName = htmlToCleanText(p.name, true) || p.name;
    const cleanDesc = htmlToCleanText(p.description, false);
    const cleanShort = htmlToCleanText(p.shortDescription, true);

    const enriched = buildEnrichedSpecifications(
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

    const updates: Partial<typeof products.$inferInsert> = {};
    if (enriched.length > rawSpecs.length) {
      updates.specificationsJson = JSON.stringify(enriched);
      enrichedSpecsCount++;
    }

    if (!p.seoTitle || !p.seoDescription) {
      const brandLabel = row.brandName ? `${row.brandName} ` : "";
      if (!p.seoTitle) {
        const hasMpn = cleanName.toLowerCase().includes(mpn.toLowerCase().replace(/\*+$/, ""));
        updates.seoTitle = hasMpn
          ? `${cleanName} | Radiant Industrial Co.`
          : `${cleanName} (${mpn}) | Radiant Industrial Co.`;
      }
      if (!p.seoDescription) {
        const specSnippet = enriched
          .slice(0, 3)
          .map((s) => `${s.label}: ${s.value}`)
          .join(" • ");
        updates.seoDescription = `${cleanName} (${mpn}) wholesale GST supply across India${
          specSnippet ? ` — ${specSnippet}` : ` by ${brandLabel || "Radiant Industrial Co."}`
        }. Request bulk quotation.`;
      }
      enrichedMetaCount++;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(products).set(updates).where(eq(products.id, p.id));
    }
  }

  console.log(`Enriched specs on ${enrichedSpecsCount} products, metadata on ${enrichedMetaCount} products.`);

  // 5. Rebuild products_fts cleanly if present
  try {
    await db.run(sql`INSERT INTO products_fts(products_fts) VALUES('rebuild')`);
    console.log("Rebuilt products_fts full-text index.");
  } catch (err) {
    console.log("Skipped products_fts rebuild:", (err as Error).message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
