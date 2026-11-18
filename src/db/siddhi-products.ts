import { eq } from "drizzle-orm";
import { brands, categories, db, divisions, products } from "./index";

interface SiddhiProductDef {
  sku: string;
  slug: string;
  name: string;
  divisionSlug: "industrial" | "special-items" | "agricultural" | "general";
  categorySlug: string;
  shortDescription: string;
  description: string;
  moq: string;
  leadTime: string;
  inStockStatus: string;
  isFeatured: boolean;
  specs: Array<{ label: string; value: string }>;
}

const SIDDHI_PRODUCTS: SiddhiProductDef[] = [
  {
    sku: "SID-IMD-CRUSHER",
    slug: "siddhi-industrial-conveyor-metal-detector-stone-crusher",
    name: "Siddhi Industrial Conveyor Metal Detector (Stone Crusher, Coal & Mining)",
    divisionSlug: "special-items",
    categorySlug: "precision-instruments",
    shortDescription:
      "Detects ferrous, non-ferrous & stainless steel tramp metal on conveyors to protect crushers and minimize downtime.",
    description: [
      "Heavy-duty industrial conveyor metal detector engineered for tough quarrying, mining, coal handling, cement, and steel plant environments.",
      "",
      "Key Capabilities:",
      "• Detects ferrous & non-ferrous metals (including Stainless Steel) before reaching crusher jaws/cones",
      "• Prevents costly crusher damage and minimizes unplanned plant downtime",
      "• High detection accuracy with rugged search coil and weather-protected control enclosure",
      "• Easy installation over existing belt conveyors with low maintenance",
      "• Customizable aperture/coil dimensions to match conveyor belt width",
      "",
      "Applications: Stone Crusher / Blue Metal Plants, Coal Handling Plants, Cement Plants, Steel Plants, Mining & Quarrying.",
      "",
      "Before Ordering: Please confirm conveyor belt width, belt speed, burden depth/material type, and control voltage requirements with our team.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "7–14 Working Days",
    inStockStatus: "Made to Conveyor Width",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Metals Detected", value: "Ferrous, Non-Ferrous & Stainless Steel" },
      { label: "Coil Width", value: "Customizable as per Conveyor Width" },
      { label: "Applications", value: "Stone Crusher, Coal, Cement, Steel, Mining" },
      { label: "Build", value: "Rugged Industrial Enclosure, Low Maintenance" },
    ],
  },
  {
    sku: "SID-VMD-V108",
    slug: "siddhi-validator-v108-hand-held-veterinary-metal-detector",
    name: "Siddhi Validator V-108 Hand Held Veterinary Metal Detector",
    divisionSlug: "agricultural",
    categorySlug: "greenhouse-farm-hardware",
    shortDescription:
      "Ultra-high sensitivity handheld detector for identifying ingested ferrous & non-ferrous metallic objects in cattle and livestock.",
    description: [
      "Validator V-108 Hand Held Veterinary Metal Detector helps veterinary doctors and livestock farms locate hidden metallic foreign objects inside the animal body.",
      "",
      "Key Features:",
      "• Detects both ferrous and non-ferrous tramp metal objects",
      "• Ultra-high sensitivity ring search head with audio and LED metal alert",
      "• Battery operated with in-built charger (`DRY ON` / `RECH ON` mode switch)",
      "• Lightweight, ergonomic, and rugged for field veterinary use",
      "",
      "Used In: Cows & Buffaloes, Goats, Veterinary Clinics & Doctors, Dairy Farms, Goat Farming.",
      "",
      "Before Ordering: Confirm battery/charger configuration and accessories before placing your order.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "3–7 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator V-108" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals" },
      { label: "Sensitivity", value: "Ultra-High Sensitivity" },
      { label: "Power", value: "Battery Operated with In-Built Charger (Dry / Rech)" },
      { label: "Applications", value: "Dairy Farms, Cattle, Goats, Veterinary Practice" },
    ],
  },
  {
    sku: "SID-GMD-G20",
    slug: "siddhi-validator-g20-hand-held-gutka-pouch-metal-detector",
    name: "Siddhi Validator G-20 Hand Held Gutka Pouch Metal Detector",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Ultra-high sensitivity handheld foil-pouch security scanner for Pharma, Food plants, factories, and clean workplaces.",
    description: [
      "Validator G-20 Hand Held Gutka Pouch Metal Detector is designed specifically for security screening at plant gates to detect concealed gutka/foil pouches and keep industrial facilities clean.",
      "",
      "Key Features:",
      "• Tuned for ultra-high sensitivity foil & hidden gutka pouch detection",
      "• Detects ferrous & non-ferrous metals with audio & visual indicators",
      "• Dual power supply operation (`DRY` / rechargeable mode with charge indicator)",
      "• Lightweight handheld grip with wrist lanyard for continuous shift screening",
      "",
      "Ideal For: Pharmaceutical Plants, Food Processing Units, Manufacturing Factories, and Clean-Campus Security Gates.",
      "",
      "Before Ordering: Please confirm quantity, battery preference, and charger adapter details before finalizing.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator G-20" },
      { label: "Target Detection", value: "Hidden Gutka / Foil Pouches, Ferrous & Non-Ferrous Metals" },
      { label: "Sensitivity", value: "Ultra-High Sensitivity" },
      { label: "Power", value: "Dual Power Supply (Dry / Rechargeable)" },
      { label: "Applications", value: "Pharma, Food Industry & Factory Gate Screening" },
    ],
  },
  {
    sku: "SID-HHMD-S15",
    slug: "siddhi-validator-s15-hand-held-metal-detector-super-scanner",
    name: "Siddhi Validator S-15 Hand Held Metal Detector (Super Scanner)",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "High-accuracy paddle-type handheld security metal detector for industrial gates, commercial premises, banks, and public screening.",
    description: [
      "Validator S-15 Hand Held Super Scanner provides fast, reliable personnel security screening across industrial and commercial checkpoints.",
      "",
      "Key Features:",
      "• Wide flat scanning blade for accurate ferrous & non-ferrous metal detection",
      "• Simple switch operation with status LEDs and audio alert",
      "• Ergonomic handheld body built for loss prevention and gate security teams",
      "",
      "Applications: Industrial Security, Police Establishments, Airports & Customs, Shopping Malls, Banks, and Correctional Facilities.",
      "",
      "Before Ordering: Confirm battery/charger pack and holster preferences before placing your order.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator S-15 (Super Scanner)" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals" },
      { label: "Form Factor", value: "Paddle / Flat Super Scanner" },
      { label: "Applications", value: "Industrial Gates, Airports, Malls, Banks, Police" },
    ],
  },
  {
    sku: "SID-HHMD-RING",
    slug: "siddhi-hand-held-security-metal-detector-ring-coil",
    name: "Siddhi Ring-Coil Hand Held Security Metal Detector",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Circular ring-coil handheld metal detector for fast personnel and baggage security scanning at gates and public venues.",
    description: [
      "Ring-coil handheld security metal detector engineered for routine personnel entry screening at factories, warehouses, transport hubs, and commercial buildings.",
      "",
      "Key Features:",
      "• High-visibility circular search coil with audio and LED metal indication",
      "• Lightweight handheld handle with wrist strap for multi-hour gate duty",
      "• Suitable for continuous security screening at plant entry/exit checkpoints",
      "",
      "Before Ordering: Confirm coil variant, sensitivity profile, and power pack details with our team.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: false,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Type", value: "Ring-Coil Hand Held Security Metal Detector" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals" },
      { label: "Applications", value: "Factories, Airports, Malls, Railway/Metro Stations, Hotels" },
    ],
  },
  {
    sku: "SID-DFMD-WT",
    slug: "siddhi-walk-through-door-frame-metal-detector",
    name: "Siddhi Walk-Through Door Frame Metal Detector (DFMD)",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Multi-zone walk-through security archway with high sensitivity, false-alarm filtering, and fast crowd throughput.",
    description: [
      "Siddhi Walk-Through Door Frame Metal Detector delivers high-throughput entry screening for personnel entering industrial plants, public venues, and commercial buildings.",
      "",
      "Key Features:",
      "• High sensitivity detection for both ferrous and non-ferrous metals",
      "• Accurate digital signal processing minimizes false alarms",
      "• Top overhead digital LCD display & control keypad with side LED zone indicators",
      "• Fast, unobstructed visitor flow and durable long-term frame construction",
      "",
      "Applications: Factories, Airports, Government Buildings, Educational Institutions, Stadiums, Concert Halls & Events.",
      "",
      "Before Ordering: Please confirm required detection zones, indoor/weatherproof rating, and installation dimensions.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "5–10 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Type", value: "Walk-Through Door Frame Metal Detector" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals" },
      { label: "Alarm Accuracy", value: "Low False-Alarm Filtering, Fast Screening" },
      { label: "Applications", value: "Factories, Airports, Gov Buildings, Institutions, Events" },
    ],
  },
  {
    sku: "SID-AC-SSB100",
    slug: "siddhi-ssb100-automatic-swing-barrier",
    name: "Siddhi SSB-100 Automatic Motorized Swing Barrier",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Bi-directional motorized swing barrier gate (25–30 persons/min) with tailgating detection and fail-safe emergency release.",
    description: [
      "Siddhi SSB-100 Automatic Swing Barrier provides smart, seamless pedestrian entrance control for modern offices, factory lobbies, banks, and transit hubs.",
      "",
      "Key Specifications & Safety Features:",
      "• Bi-Directional Access control compatible with RFID, biometric, or QR access readers",
      "• Infrared tailgating & wrong-entry detection",
      "• Fail-Safe on Power Failure (auto-opens for safe emergency egress)",
      "• Throughput: 25–30 Persons per Minute",
      "• Motorized operation with heavy-duty self-locking gearbox",
      "",
      "Before Ordering: Confirm aisle width, access controller integration (RFID/Biometric/Face), and lane count before ordering.",
    ].join("\n"),
    moq: "1 Pair (1 Lane)",
    leadTime: "7–12 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "SSB-100" },
      { label: "Access Mode", value: "Bi-Directional" },
      { label: "Throughput", value: "25–30 Persons/Min" },
      { label: "Drive", value: "Motorized with Self-Locking Gearbox" },
      { label: "Safety", value: "Tailgating/Wrong Entry Detection, Fail-Safe on Power Failure" },
    ],
  },
  {
    sku: "SID-AC-SBB6",
    slug: "siddhi-sbb-bldc6-automatic-boom-barrier",
    name: "Siddhi SBB-BLDC-6 Automatic Vehicle Boom Barrier (24V DC BLDC)",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "IP45 weather-proof 24V DC BLDC boom barrier with 1.2–6s adjustable speed, anti-crush rebound & 30m remote range.",
    description: [
      "Siddhi SBB-BLDC-6 Automatic Boom Barrier delivers fast, reliable vehicle entry and exit control for factory gates, logistics yards, commercial complexes, and parking facilities.",
      "",
      "Key Specifications:",
      "• Drive Motor: High-efficiency 24V DC BLDC Motor (low maintenance, continuous duty)",
      "• Adjustable Speed: 1.2 – 6 seconds",
      "• Safety: Automatic rebound function on resistance/obstruction",
      "• Weather Protection: IP45 Weather-Proof housing",
      "• Remote Control Range: ≤ 30 meters",
      "",
      "Before Ordering: Confirm required boom arm length (up to 6 m), left/right mounting orientation, and loop/FASTag/RFID integration.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "5–10 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "SBB-BLDC-6" },
      { label: "Motor", value: "24V DC BLDC Motor" },
      { label: "Operating Speed", value: "1.2 – 6s Adjustable" },
      { label: "Remote Range", value: "≤ 30 m" },
      { label: "Protection", value: "IP45 Weather-Proof + Auto Rebound on Resistance" },
    ],
  },
  {
    sku: "SID-AC-TRIPOD",
    slug: "siddhi-tripod-turnstile-access-gate",
    name: "Siddhi Stainless Steel Tripod Turnstile Gate",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Waist-height stainless steel tripod turnstile (bridge & pedestal variants) for high-traffic pedestrian gate control.",
    description: [
      "Siddhi Tripod Turnstile regulates pedestrian entry and exit one person at a time across factory time-office gates, corporate lobbies, metro stations, stadiums, and gyms.",
      "",
      "Key Highlights:",
      "• Stainless steel weather-resistant housing (cabinet bridge and pedestal column options)",
      "• LED directional passage indicators and drop-arm fail-safe function",
      "• Integrates easily with RFID card, fingerprint/face biometric, and token systems",
      "",
      "Before Ordering: Confirm bridge vs. pedestal style, lane count, and access reader integration requirements.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "5–10 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: false,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Type", value: "Tripod Turnstile (Bridge / Pedestal)" },
      { label: "Body", value: "Stainless Steel Housing" },
      { label: "Integration", value: "RFID / Biometric / Push-Button" },
    ],
  },
  {
    sku: "SID-AC-PTYPE",
    slug: "siddhi-p-type-pedestrian-swing-gate",
    name: "Siddhi P-Type Pedestrian & Wheelchair Swing Barrier Gate",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Stainless steel pedestal P-type pipe swing gate for wide-lane VIP, wheelchair, trolley, and material passage.",
    description: [
      "Siddhi P-Type Pedestrian Swing Gate creates a wide controlled passage lane alongside tripod turnstiles for differently-abled access, material trolleys, and supervised entry.",
      "",
      "Before Ordering: Specify required swing arm width (typically 900–1200 mm) and uni/bi-directional control mode.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "5–10 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: false,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Type", value: "P-Type Pedestal Swing Barrier" },
      { label: "Application", value: "Wide Lane / Wheelchair / Trolley Access" },
    ],
  },
  {
    sku: "SID-AC-FLAP",
    slug: "siddhi-automatic-flap-barrier-turnstile",
    name: "Siddhi Automatic Retractable Flap Barrier Turnstile",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Fast-opening stainless steel flap barrier with acrylic wings for corporate lobbies, transit terminals & clean plants.",
    description: [
      "Siddhi Automatic Flap Barrier combines sleek brushed stainless steel cabinets with fast-retracting acrylic wings and optical sensors for high-speed entrance control.",
      "",
      "Applications: Corporate Offices, Banks, Airports, Metro/Railway Stations, Malls, and Clean-Room Plant Entrances.",
      "",
      "Before Ordering: Confirm lane width, number of lanes (single/multi), and card/biometric mounting cutout specs.",
    ].join("\n"),
    moq: "1 Pair (1 Lane)",
    leadTime: "7–12 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: false,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Type", value: "Retractable Wing Flap Barrier" },
      { label: "Housing", value: "Brushed Stainless Steel with Acrylic Wings" },
    ],
  },
  {
    sku: "SID-AC-FULLHT",
    slug: "siddhi-full-height-revolving-turnstile",
    name: "Siddhi Full-Height Stainless Steel Revolving Turnstile",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Floor-to-ceiling heavy-duty perimeter cage turnstile preventing tailgating and climb-over at unattended plant gates.",
    description: [
      "Siddhi Full-Height Revolving Turnstile provides strict unmanned perimeter access control for industrial plants, logistics hubs, warehouses, stadiums, and high-security boundaries.",
      "",
      "Before Ordering: Specify single-lane or double-lane cage, rotor bar configuration (90°/120°), and access control reader mounting.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "10–15 Working Days",
    inStockStatus: "Made to Order",
    isFeatured: false,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Type", value: "Full-Height Perimeter Turnstile" },
      { label: "Material", value: "Heavy-Duty Stainless Steel Rotor & Cage" },
    ],
  },
];

async function ensureSiddhiBrand(): Promise<number> {
  const [existing] = await db.select().from(brands).where(eq(brands.slug, "siddhi"));
  const brandData = {
    slug: "siddhi",
    name: "Siddhi",
    countryOfOrigin: "India",
    sourcingType: "independent",
    sourcingNote:
      "We are not an official authorized dealer yet; we source genuine items directly against your order.",
    description:
      "Industrial conveyor metal detectors, handheld security/veterinary/gutka pouch detectors, walk-through door frames, boom barriers, and entrance turnstiles.",
    websiteUrl: null,
    isFeatured: true,
    sortOrder: 31,
    seoTitle: "Siddhi Metal Detectors & Access Control | Radiant Industrial Co.",
    seoDescription:
      "Source genuine Siddhi industrial conveyor metal detectors, handheld & walk-through metal detectors, boom barriers, and turnstiles through Radiant Industrial Co.",
    isActive: true,
  };

  if (existing) {
    await db.update(brands).set(brandData).where(eq(brands.id, existing.id));
    return existing.id;
  }

  await db.insert(brands).values(brandData).onConflictDoNothing({ target: brands.slug });
  const [created] = await db.select().from(brands).where(eq(brands.slug, "siddhi"));
  if (!created) {
    throw new Error("Failed to create or retrieve 'siddhi' brand.");
  }
  return created.id;
}

export async function loadSiddhiProducts(): Promise<{
  brandId: number;
  insertedCount: number;
  updatedCount: number;
  totalProductsAfter: number;
}> {
  const brandId = await ensureSiddhiBrand();

  const allDivisions = await db.select().from(divisions);
  const allCategories = await db.select().from(categories);

  const divBySlug: Record<string, number> = {};
  for (const d of allDivisions) divBySlug[d.slug] = d.id;

  const catBySlug: Record<string, number> = {};
  for (const c of allCategories) catBySlug[c.slug] = c.id;

  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of SIDDHI_PRODUCTS) {
    const divisionId = divBySlug[item.divisionSlug];
    const categoryId = catBySlug[item.categorySlug];
    if (!divisionId || !categoryId) {
      throw new Error(
        `Missing division '${item.divisionSlug}' or category '${item.categorySlug}' in database.`
      );
    }

    const record = {
      slug: item.slug,
      sku: item.sku,
      name: item.name,
      shortDescription: item.shortDescription,
      description: item.description,
      divisionId,
      categoryId,
      brandId,
      pricingMode: "rfq_only",
      basePrice: null,
      priceUnit: "NOS",
      gstPercent: 18,
      moq: item.moq,
      leadTime: item.leadTime,
      hsnCode: "",
      specificationsJson: JSON.stringify(item.specs),
      inStockStatus: item.inStockStatus,
      isFeatured: item.isFeatured,
      isActive: true,
      seoTitle: `${item.name} (${item.sku}) | Radiant Industrial Co.`,
      seoDescription: item.shortDescription,
    };

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, item.sku));

    if (existing) {
      await db.update(products).set(record).where(eq(products.id, existing.id));
      updatedCount++;
    } else {
      await db.insert(products).values(record);
      insertedCount++;
    }
  }

  const totalRows = await db.select({ id: products.id }).from(products);

  return {
    brandId,
    insertedCount,
    updatedCount,
    totalProductsAfter: totalRows.length,
  };
}
