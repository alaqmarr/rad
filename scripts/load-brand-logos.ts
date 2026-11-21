import { eq } from "drizzle-orm";
import { brands, db } from "../src/db";

/**
 * Repeatable, non-destructive brand metadata & logo updater.
 * Ensures newly added brands exist and updates brands.logoUrl + websiteUrl.
 */
export const BRAND_LOGO_UPDATES: Record<
  string,
  {
    name: string;
    logoUrl: string | null;
    websiteUrl?: string;
    countryOfOrigin?: string;
    isFeatured?: boolean;
    sortOrder?: number;
    description?: string;
  }
> = {
  radiant: { name: "Radiant", logoUrl: "/logos/logo-long.png" },
  "godrej-storage": { name: "Godrej Storage Solutions", logoUrl: "/logos/brands/godrej-storage.svg", websiteUrl: "https://www.godrejenterprises.com" },
  skf: { name: "SKF", logoUrl: "/logos/brands/skf.svg", websiteUrl: "https://www.skf.com" },
  ntn: { name: "NTN", logoUrl: "/logos/brands/ntn.svg", websiteUrl: "https://www.ntnglobal.com" },
  polycab: { name: "Polycab", logoUrl: "/logos/brands/polycab.png", websiteUrl: "https://polycab.com" },
  esab: { name: "ESAB", logoUrl: "/logos/brands/esab.svg", websiteUrl: "https://esab.com" },
  udyogi: { name: "Udyogi", logoUrl: "/logos/brands/udyogi.svg", websiteUrl: "https://udyogisafety.com" },
  "bosch-professional": { name: "Bosch Professional", logoUrl: "/logos/brands/bosch-professional.svg", websiteUrl: "https://www.bosch-professional.com" },
  dowty: { name: "Dowty", logoUrl: "/logos/brands/dowty.png" },
  festo: { name: "Festo", logoUrl: "/logos/brands/festo.svg", websiteUrl: "https://www.festo.com" },
  karam: { name: "Karam", logoUrl: "/logos/brands/karam.svg", websiteUrl: "https://karamonline.com" },
  "3m-industrial": { name: "3M Industrial", logoUrl: "/logos/brands/3m-industrial.svg", websiteUrl: "https://www.3mindia.in" },
  "honeywell-safety": { name: "Honeywell Safety", logoUrl: "/logos/brands/honeywell-safety.svg", websiteUrl: "https://automation.honeywell.com" },
  makita: { name: "Makita", logoUrl: "/logos/brands/makita.svg", websiteUrl: "https://www.makita.in" },
  taparia: { name: "Taparia", logoUrl: "/logos/brands/taparia.svg", websiteUrl: "https://www.tapariatools.com" },
  "lt-switchgear": { name: "L&T Switchgear (Lauritz Knudsen)", logoUrl: "/logos/brands/lt-switchgear.svg", websiteUrl: "https://www.lk-ea.com" },
  havells: { name: "Havells", logoUrl: "/logos/brands/havells.svg", websiteUrl: "https://havells.com" },
  mitutoyo: { name: "Mitutoyo", logoUrl: "/logos/brands/mitutoyo.svg", websiteUrl: "https://www.mitutoyo.co.in" },
  fluke: { name: "Fluke", logoUrl: "/logos/brands/fluke.svg", websiteUrl: "https://www.fluke.com" },
  "jindal-stainless": { name: "Jindal Stainless", logoUrl: "/logos/brands/jindal-stainless.png", websiteUrl: "https://www.jindalstainless.com" },
  kirloskar: { name: "Kirloskar", logoUrl: "/logos/brands/kirloskar.svg", websiteUrl: "https://www.kirloskarpumps.com" },
  "supreme-industries": { name: "Supreme Industries", logoUrl: "/logos/brands/supreme-industries.png", websiteUrl: "https://www.supreme.co.in" },
  "loctite-henkel": { name: "Loctite (Henkel)", logoUrl: "/logos/brands/loctite-henkel.svg", websiteUrl: "https://www.henkel-adhesives.com" },
  "norton-abrasives": { name: "Norton Abrasives", logoUrl: "/logos/brands/norton-abrasives.svg", websiteUrl: "https://www.nortonabrasives.com" },
  "fenner-india": { name: "Fenner India", logoUrl: "/logos/brands/fenner-india.svg", websiteUrl: "https://www.jkfenner.com" },
  unbrako: { name: "Unbrako", logoUrl: "/logos/brands/unbrako.png", websiteUrl: "https://unbrako.com" },
  "lt-valves": { name: "L&T Valves", logoUrl: "/logos/brands/lt-valves.svg", websiteUrl: "https://www.lntvalves.com" },
  "stanley-black-decker": { name: "Stanley Tools", logoUrl: "/logos/brands/stanley-black-decker.svg", websiteUrl: "https://www.stanleytools.com" },
  "dmc-tools": { name: "DMC Tools", logoUrl: "/logos/brands/dmc-tools.png", websiteUrl: "https://dmctools.com" },
  "gazelle-industrial": { name: "Gazelle Industrial", logoUrl: "/logos/brands/gazelle-industrial.png", websiteUrl: "https://www.gazelleindustrial.com" },
  "black-decker": {
    name: "Black & Decker",
    logoUrl: "/logos/brands/black-decker.svg",
    websiteUrl: "https://www.blackanddecker.in",
    countryOfOrigin: "USA",
    isFeatured: false,
    sortOrder: 35,
    description: "Compact power drills, sanders, jigsaws, heat guns, and maintenance workshop tools.",
  },
  dewalt: {
    name: "DEWALT",
    logoUrl: "/logos/brands/dewalt.svg",
    websiteUrl: "https://in.dewalt.global",
    countryOfOrigin: "USA",
    isFeatured: true,
    sortOrder: 36,
    description: "Heavy-duty XR brushless power tools, rotary hammers, angle grinders, saws, and accessories.",
  },
  hikoki: {
    name: "HiKOKI",
    logoUrl: "/logos/brands/hikoki.svg",
    websiteUrl: "https://www.hikoki-powertools.in",
    countryOfOrigin: "Japan",
    isFeatured: true,
    sortOrder: 37,
    description: "Industrial power tools, MultiVolt cordless systems, demolition hammers, and cut-off machines.",
  },
  addison: {
    name: "Addison",
    logoUrl: "/logos/brands/addison.svg",
    websiteUrl: "https://addison.co.in",
    countryOfOrigin: "India",
    isFeatured: true,
    sortOrder: 38,
    description: "Precision HSS & carbide twist drills, end mills, reamers, taps, and milling cutters.",
  },
  freemans: {
    name: "Freemans",
    logoUrl: "/logos/brands/freemans.svg",
    websiteUrl: "https://www.freemansgroup.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 39,
    description: "Precision measuring tapes, spirit levels, laser distance meters, and hand measuring tools.",
  },
  "alko-plus": {
    name: "Alko Plus",
    logoUrl: "/logos/brands/alko-plus.svg",
    websiteUrl: "https://alkoplus.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 40,
    description: "Industrial safety helmets, full-body harnesses, lanyards, safety shoes, and fall protection PPE.",
  },
  tooltech: {
    name: "Tooltech",
    logoUrl: "/logos/brands/tooltech.svg",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 41,
    description: "Industrial cutting, hand tools, precision MRO consumables, and workshop hardware.",
  },
  ecodrive: {
    name: "Ecodrive",
    logoUrl: "/logos/brands/ecodrive.svg",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 42,
    description: "Industrial power transmission belts, V-belts, pulleys, and mechanical drive components.",
  },
  "poly-f-plus": {
    name: "Poly F Plus",
    logoUrl: "/logos/brands/poly-f-plus.svg",
    websiteUrl: "https://www.jkfenner.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 43,
    description: "Anti-static, oil- and heat-resistant industrial wrapped V-belts and wedge belts.",
  },
  dowsil: {
    name: "DOWSIL",
    logoUrl: "/logos/brands/dowsil.svg",
    websiteUrl: "https://www.dow.com",
    countryOfOrigin: "USA / Global",
    isFeatured: false,
    sortOrder: 44,
    description: "High-performance silicone sealants, structural glazing adhesives, and industrial thermal compounds.",
  },
  fevicol: {
    name: "Fevicol",
    logoUrl: "/logos/brands/fevicol.svg",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    isFeatured: true,
    sortOrder: 45,
    description: "Industrial woodworking, laminate, assembly, and multi-substrate synthetic resin adhesives.",
  },
  feviseal: {
    name: "Feviseal",
    logoUrl: null,
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 46,
    description: "Neutral-cure and acetoxy silicone sealants for industrial weatherproofing, HVAC, and glazing.",
  },
  "fevi-quick": {
    name: "Fevi Kwik",
    logoUrl: "/logos/brands/fevi-quick.svg",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 47,
    description: "Instant cyanoacrylate industrial adhesives for rapid metal, plastic, rubber, and elastomer bonding.",
  },
  mseal: {
    name: "M-Seal",
    logoUrl: "/logos/brands/mseal.svg",
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 48,
    description: "Two-part epoxy compounds for leak sealing, pipe joining, electrical insulation, and metallic repair.",
  },
  fevibond: {
    name: "Fevibond",
    logoUrl: null,
    websiteUrl: "https://www.pidilite.com",
    countryOfOrigin: "India",
    isFeatured: false,
    sortOrder: 49,
    description: "Synthetic rubber contact adhesives for leather, rubber, foam, canvas, and metal bonding.",
  },
  bostik: {
    name: "Bostik",
    logoUrl: "/logos/brands/bostik.svg",
    websiteUrl: "https://www.bostik.com/india/en",
    countryOfOrigin: "France / India",
    isFeatured: true,
    sortOrder: 50,
    description: "Industrial adhesives, hot-melt assembly glues, structural sealants, and industrial bonding systems.",
  },
};

async function main() {
  let updated = 0;
  let created = 0;

  for (const [slug, cfg] of Object.entries(BRAND_LOGO_UPDATES)) {
    const [existing] = await db
      .select({ id: brands.id, logoUrl: brands.logoUrl, websiteUrl: brands.websiteUrl })
      .from(brands)
      .where(eq(brands.slug, slug));

    if (!existing) {
      await db
        .insert(brands)
        .values({
          slug,
          name: cfg.name,
          logoUrl: cfg.logoUrl,
          websiteUrl: cfg.websiteUrl || null,
          countryOfOrigin: cfg.countryOfOrigin || "India",
          isFeatured: cfg.isFeatured ?? false,
          sortOrder: cfg.sortOrder ?? 99,
          sourcingType: "independent",
          sourcingNote:
            "We are not an official authorized dealer yet; we source genuine items directly against your order.",
          description: cfg.description || `Genuine ${cfg.name} industrial supplies.`,
          seoTitle: `${cfg.name} Wholesale Supply | Radiant Industrial Co.`,
          seoDescription: `Source genuine ${cfg.name} products in India through Radiant Industrial Co.`,
          isActive: true,
        })
        .onConflictDoNothing({ target: brands.slug });
      created++;
      continue;
    }

    await db
      .update(brands)
      .set({
        logoUrl: cfg.logoUrl ?? existing.logoUrl,
        websiteUrl: existing.websiteUrl || cfg.websiteUrl || null,
      })
      .where(eq(brands.id, existing.id));

    updated++;
  }

  console.log(
    JSON.stringify(
      {
        totalConfigured: Object.keys(BRAND_LOGO_UPDATES).length,
        created,
        updated,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[load-brand-logos] Error:", err);
    process.exit(1);
  });
