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
      "Ultra-high sensitivity SMD handheld veterinary metal detector (390×130×40 mm, ABS body, 9V dry/rechargeable) for locating ingested metallic objects in livestock.",
    description: [
      "Validator V-108 Hand Held Veterinary Metal Detector helps veterinary doctors and livestock farms locate swallowed metallic foreign objects (wires, nails, pins, scrap metal) inside cattle and livestock.",
      "",
      "Key Specifications & Features:",
      "• Circuitry: Fully automatic, self-adjusting SMD (Surface Mount Device) circuit — no manual tuning needed",
      "• Detection Range: Metal objects > 1 gm (~30 mm), razor blade (~60 mm), small metallic fasteners/coins (~80 mm)",
      "• Targets: Detects both ferrous and non-ferrous metals (iron, steel, stainless steel, brass, copper, aluminium)",
      "• Indications: Variable proportional audio tone + LED status indicators (ON, METAL, LOW BTY, CHG)",
      "• Power Supply: Dual power (`DRY ON` 9V cell up to ~90 hrs / `RECH ON` rechargeable ~20 hrs) with built-in 230V AC 50 Hz charger",
      "• Build & Size: Rugged lightweight ABS molded body, 390 × 130 × 40 mm (~290 g without battery / ~360 g with battery)",
      "• Operating Environment: 0°C to 50°C, 0–90% RH (non-condensing)",
      "",
      "Used In: Cows & Buffaloes, Goats, Veterinary Clinics & Doctors, Dairy Farms, Goat Farming.",
      "",
      "Before Ordering: Confirm battery/charger pack and farm accessories before placing your order.",
    ].join("\n"),
    moq: "1 NOS",
    leadTime: "3–7 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator V-108" },
      { label: "Circuitry", value: "Automatic Self-Adjusting SMD Technology" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals (> 1 gm @ ~30 mm)" },
      { label: "Indications", value: "Proportional Audio + LEDs (ON, METAL, LOW, CHG)" },
      { label: "Power Supply", value: "9V Dry (~90h) / Rechargeable (~20h) + Built-In 230V AC Charger" },
      { label: "Dimensions & Weight", value: "390 × 130 × 40 mm | ~290 g (no batt.) / ~360 g (with batt.)" },
      { label: "Body & Rating", value: "ABS Molded Body | 0°C to 50°C, 0–90% RH" },
    ],
  },
  {
    sku: "SID-GMD-G20",
    slug: "siddhi-validator-g20-hand-held-gutka-pouch-metal-detector",
    name: "Siddhi Validator G-20 Hand Held Gutka Pouch Metal Detector",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Ultra-high sensitivity SMD handheld foil & gutka pouch scanner (1 gm detection, 390×130×40 mm, 9V dual power) for pharma, food & factory gates.",
    description: [
      "Validator G-20 Hand Held Gutka Pouch Metal Detector is engineered with ultra-high sensitivity SMD circuitry to detect concealed foil/gutka pouches and tiny metallic items during security screening.",
      "",
      "Key Specifications & Features:",
      "• Circuitry: Fully automatic, self-adjusting SMD technology for stable zero-drift operation",
      "• Detection Distance: Objects/foil > 1 gm (~30 mm), razor blade (~60 mm), small metallic items (~80 mm)",
      "• Targets: Detects concealed gutka foil pouches, mild/stainless steel, brass, copper, aluminium, gold, silver & ferrous/non-ferrous alloys",
      "• Indications: Proportional variable audio pitch + LEDs (ON, METAL, LOW BTY, CHG)",
      "• Power Supply: Dual power (`DRY ON` 9V cell up to ~90 hrs / `RECH ON` rechargeable ~20 hrs) + built-in 230V AC charger",
      "• Build & Safety: Impact-resistant ABS body (390 × 130 × 40 mm, ~290 g / ~360 g with battery); safe for cardiac pacemakers, pregnant personnel, and magnetic media",
      "",
      "Ideal For: Pharmaceutical Plants, Food Processing Units, Factories, Hospitals, and Clean-Campus Entrances.",
      "",
      "Before Ordering: Please confirm quantity, battery configuration, and charger adapter details before finalizing.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator G-20" },
      { label: "Circuitry", value: "Automatic Self-Adjusting SMD Technology" },
      { label: "Target Detection", value: "Gutka Foil Pouches, Ferrous & Non-Ferrous Metals (> 1 gm)" },
      { label: "Indications", value: "Proportional Audio + LEDs (ON, METAL, LOW, CHG)" },
      { label: "Power Supply", value: "9V Dry (~90h) / Rechargeable (~20h) + Built-In 230V AC Charger" },
      { label: "Dimensions & Weight", value: "390 × 130 × 40 mm | ~290 g (no batt.) / ~360 g (with batt.)" },
      { label: "Safety & Environment", value: "Pacemaker Safe | ABS Body | 0°C to 50°C" },
    ],
  },
  {
    sku: "SID-HHMD-P7",
    slug: "siddhi-validator-p7-hand-held-metal-detector-wand",
    name: "Siddhi Validator P-7 Hand Held Metal Detector (Flat Wand)",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Lightweight flat-wand SMD handheld security metal detector (detects down to 1 gm, ~260 g) with dual power & built-in charger.",
    description: [
      "Validator P-7 Hand Held Metal Detector features a slim, extended flat-wand profile engineered for rapid body and bag security scanning at industrial and commercial gates.",
      "",
      "Key Specifications & Features:",
      "• Sensitivity: Ultra-high sensitivity capable of detecting ferrous and non-ferrous objects down to 1 gram (SS, MS, brass, copper, aluminium, precious metals, concealed weapons)",
      "• Circuitry: Fully automatic, self-adjusting SMD circuit requiring no manual sensitivity tuning",
      "• Indications: Proportional variable audio alarm (tone varies by metal quantity) + visual LED indicators (ON, METAL, LOW, CHG)",
      "• Power Supply: Dual power supply (9V dry cell or rechargeable battery) with in-built battery charger",
      "• Build & Safety: High-strength ABS molded flat-wand body (~260 g without battery / ~360 g with battery); safe for cardiac pacemakers and magnetic media",
      "",
      "Applications: Factory Security Gates, Airports, Banks, Hotels, Shopping Malls, Police Establishments, Schools & Public Events.",
      "",
      "Before Ordering: Confirm battery/charger package and holster requirement with our team.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator P-7" },
      { label: "Form Factor", value: "Slim Flat-Wand Hand Held Scanner" },
      { label: "Circuitry", value: "Automatic Self-Adjusting SMD Technology" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals (Down to 1 gm)" },
      { label: "Indications", value: "Proportional Audio + LEDs (ON, METAL, LOW, CHG)" },
      { label: "Power Supply", value: "Dual Power (9V Dry / Rechargeable) + Built-In Charger" },
      { label: "Weight & Safety", value: "~260 g (no batt.) / ~360 g (with batt.) | Pacemaker Safe ABS Body" },
    ],
  },
  {
    sku: "SID-HHMD-S15",
    slug: "siddhi-validator-s15-hand-held-metal-detector-super-scanner",
    name: "Siddhi Validator S-15 Hand Held Metal Detector (Super Scanner)",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Compact round-disc coil SMD Super Scanner (~330×95×40 mm, ~230 g) with dual 9V dry/rechargeable power and built-in charger.",
    description: [
      "Validator S-15 Hand Held Metal Detector (Super Scanner) combines a solid circular search head with automatic self-adjusting SMD circuitry for accurate personnel screening.",
      "",
      "Key Specifications & Features:",
      "• Search Coil: Solid disc Super Scanner head detecting ferrous & non-ferrous metals, conductive alloys, and concealed threats",
      "• Circuitry: Fully automatic self-adjusting SMD electronics with proportional variable audio tone",
      "• Indications: Status LEDs for Power ON, Metal Detected, Battery LOW, and Charging (CHG)",
      "• Power Supply: Dual power (`DRY ON` 9V / `RECH ON` rechargeable) with built-in 230V AC charger",
      "• Compact Size & Weight: Impact-resistant ABS body (~330 × 95 × 40 mm), ~230 g (without battery) / ~300 g (with battery); 0°C to 50°C",
      "• Safety: Safe for cardiac pacemakers and magnetic storage media",
      "",
      "Applications: Industrial Security, Police Establishments, Airports & Customs, Shopping Malls, Banks, and Prisons.",
      "",
      "Before Ordering: Confirm battery/charger pack and carry holster preferences before placing your order.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator S-15 (Super Scanner)" },
      { label: "Form Factor", value: "Solid Round-Disc Coil Handheld Scanner" },
      { label: "Circuitry", value: "Automatic Self-Adjusting SMD Technology" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals & Conductive Alloys" },
      { label: "Power Supply", value: "9V Dry / Rechargeable + Built-In 230V AC Charger" },
      { label: "Dimensions & Weight", value: "~330 × 95 × 40 mm | ~230 g (no batt.) / ~300 g (with batt.)" },
      { label: "Safety & Environment", value: "Pacemaker Safe | ABS Body | 0°C to 50°C" },
    ],
  },
  {
    sku: "SID-HHMD-S16",
    slug: "siddhi-validator-s16-hand-held-metal-detector-ring-coil",
    name: "Siddhi Validator S-16 Hand Held Metal Detector (Large Ring-Coil)",
    divisionSlug: "industrial",
    categorySlug: "safety-ppe",
    shortDescription:
      "Large open ring-coil SMD handheld metal detector (390×130×40 mm, detects down to 1 gm) with dual power & built-in charger.",
    description: [
      "Validator S-16 Hand Held Metal Detector features an enlarged open circular ring coil (390 × 130 × 40 mm) for wider-sweep screening of personnel and belongings.",
      "",
      "Key Specifications & Features:",
      "• High Sensitivity: Open circular search coil detects ferrous & non-ferrous metals down to 1 gram (SS, MS, brass, copper, aluminium, gold, silver, weapons)",
      "• Circuitry: Fully automatic self-adjusting SMD technology with proportional variable audio alert",
      "• Indications: LED indicators for Power ON, Metal Detected, Battery LOW, and Charging (CHG)",
      "• Power Supply: Dual power (`DRY ON` 9V / `RECH ON` rechargeable) with built-in AC mains battery charger",
      "• Build & Safety: Rugged ABS molded body (390 × 130 × 40 mm, ~290 g without battery / ~360 g with battery); 0°C to 50°C; safe for pacemakers & magnetic media",
      "",
      "Applications: Factories, Airports, Banks, Railway/Metro Stations, Malls, Hotels & Public Screening Gates.",
      "",
      "Before Ordering: Confirm battery/charger configuration and carry lanyard/holster preferences with our team.",
    ].join("\n"),
    moq: "2 NOS",
    leadTime: "3–5 Working Days",
    inStockStatus: "Available to Order",
    isFeatured: true,
    specs: [
      { label: "Brand", value: "Siddhi" },
      { label: "Model", value: "Validator S-16" },
      { label: "Form Factor", value: "Large Open Ring-Coil Handheld Scanner" },
      { label: "Circuitry", value: "Automatic Self-Adjusting SMD Technology" },
      { label: "Detection", value: "Ferrous & Non-Ferrous Metals (Down to 1 gm)" },
      { label: "Power Supply", value: "9V Dry / Rechargeable + Built-In AC Charger" },
      { label: "Dimensions & Weight", value: "390 × 130 × 40 mm | ~290 g (no batt.) / ~360 g (with batt.)" },
      { label: "Safety & Environment", value: "Pacemaker Safe | ABS Body | 0°C to 50°C" },
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

    let [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, item.sku));

    if (!existing && item.sku === "SID-HHMD-S16") {
      [existing] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, "SID-HHMD-RING"));
    }

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
