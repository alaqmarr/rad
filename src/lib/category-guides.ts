export interface CategorySubTypeGuide {
  name: string;
  standard: string;
  specRange: string;
  summary: string;
  modelSlugs: string[];
}

export interface CategorySizingRow {
  series: string;
  standard: string;
  boresOrRange: string;
  strokeOrVariant: string;
  cushioningOrRating: string;
  portsOrNotes: string;
}

export interface CategoryFaqItem {
  question: string;
  answer: string;
}

export interface CategoryProcurementGuide {
  seoTitle: string;
  seoDescription: string;
  badgeLabel: string;
  introHeadline: string;
  introSummary: string;
  typesTitle: string;
  types: CategorySubTypeGuide[];
  sizingTitle: string;
  sizingColumns: [string, string, string, string, string, string];
  sizingRows: CategorySizingRow[];
  orderingTitle: string;
  orderingChecklist: string[];
  faqs: CategoryFaqItem[];
}

export const CATEGORY_PROCUREMENT_GUIDES: Record<string, CategoryProcurementGuide> = {
  "pneumatic-cylinders": {
    seoTitle: "Industrial Pneumatic Cylinders & Actuators Supplier India",
    seoDescription:
      "Source ISO 15552 profile (DSBC, DNC), ISO 21287 compact (ADN, AEN), ISO 6432 round (DSNU), guided (DFM), and rodless (DGC) pneumatic cylinders across India. Request GST quotes with bore & stroke selection support.",
    badgeLabel: "ISO 15552 • ISO 21287 • ISO 6432 PNEUMATIC ACTUATION",
    introHeadline: "Pneumatic Cylinder Types, Bore & Stroke Selection Guide",
    introSummary:
      "Select the right Festo or industrial pneumatic cylinder by mounting standard, bore diameter, stroke length, end-position cushioning, and proximity sensor slot before raising your RFQ.",
    typesTitle: "Industrial Pneumatic Cylinder Types & Specific Models",
    types: [
      {
        name: "ISO 15552 Standard Profile Cylinders",
        standard: "ISO 15552 / VDMA 24562",
        specRange: "Bore: Ø32 – Ø125 mm (up to Ø320 mm) | Stroke: 10 – 2,000 mm",
        summary:
          "Tie-rod and clean-profile linear actuators with adjustable (PPV) or self-adjusting (PPS) pneumatic end-position cushioning and T-slots for magnetic proximity sensors.",
        modelSlugs: [
          "festo-standards-based-cylinder-dsbc-dsbc",
          "festo-standards-based-cylinder-dnc-dnc",
          "festo-standards-based-cylinder-dsbc-80-100-pa-n3r3-fp-02-50-04-01",
        ],
      },
      {
        name: "ISO 21287 Compact Cylinders",
        standard: "ISO 21287",
        specRange: "Bore: Ø12 – Ø125 mm | Stroke: 5 – 400 mm",
        summary:
          "Up to 50% shorter installation length than ISO 15552 profile cylinders. Available in double-acting (ADN), single-acting (AEN), non-rotating guide-rod (ADNGF), and heavy-duty (ADVU) configurations.",
        modelSlugs: [
          "festo-compact-cylinder-double-acting-adn-adn",
          "festo-compact-cylinder-single-acting-aen-aen",
          "festo-compact-cylinder-adngf-adngf",
          "festo-compact-cylinder-adn-25-10-i-p-a-cqa",
        ],
      },
      {
        name: "ISO 6432 Round & Mini Cylinders",
        standard: "ISO 6432",
        specRange: "Bore: Ø8 – Ø25 mm | Stroke: 10 – 500 mm",
        summary:
          "Compact stainless-steel barrel cylinders engineered for packaging lines, pick-and-place tooling, and tight machine frames with elastic or self-adjusting cushioning.",
        modelSlugs: [
          "festo-round-cylinder-double-acting-dsnu-dsnu-pub",
          "festo-round-cylinder-crdsnu-crdsnu-pub",
          "festo-round-cylinder-dsnu-s-dsnu-s",
        ],
      },
      {
        name: "Guided Drives, Rodless & Specialty Actuators",
        standard: "OEM Heavy-Duty / Bellows",
        specRange: "Bore: Ø6 – Ø100 mm | High lateral torque resistance",
        summary:
          "Twin-rod guided drives (DFM), mini slides (DGSL), rodless linear actuators (DGC) with YSRW shock absorbers, and short-stroke bellows cylinders (EB) for high-force clamping or dusty plants.",
        modelSlugs: [
          "festo-guided-drive-dfm-dfm",
          "festo-linear-drive-dgc-dgc",
          "festo-bellows-cylinder-eb-eb",
          "festo-cartridge-cylinder-egz-egz",
        ],
      },
    ],
    sizingTitle: "Bore, Stroke & Technical Options Reference",
    sizingColumns: [
      "Series",
      "Standard",
      "Bore Options",
      "Stroke Options",
      "Cushioning & Pressure",
      "Port Thread & Sensing",
    ],
    sizingRows: [
      {
        series: "DSBC / DNC",
        standard: "ISO 15552",
        boresOrRange: "Ø32, Ø40, Ø50, Ø63, Ø80, Ø100, Ø125 mm",
        strokeOrVariant: "1 – 2,000 mm (std increments 25–500 mm)",
        cushioningOrRating: "P / PPV / PPS | 0.4 – 12 bar",
        portsOrNotes: "G1/8 to G1/2 | T-slot magnetic sensor",
      },
      {
        series: "ADN / AEN / ADNGF",
        standard: "ISO 21287",
        boresOrRange: "Ø12, Ø16, Ø20, Ø25, Ø32, Ø40, Ø50, Ø63, Ø80, Ø100 mm",
        strokeOrVariant: "1 – 300 / 400 mm",
        cushioningOrRating: "P elastic / PPS | 0.6 – 10 bar",
        portsOrNotes: "M5 to G1/4 | Male or female rod thread",
      },
      {
        series: "DSNU / CRDSNU",
        standard: "ISO 6432",
        boresOrRange: "Ø8, Ø10, Ø12, Ø16, Ø20, Ø25 mm",
        strokeOrVariant: "1 – 500 mm",
        cushioningOrRating: "P / PPV / PPS | 1 – 10 bar",
        portsOrNotes: "M5 / G1/8 | Threaded nose / swivel mount",
      },
      {
        series: "DFM / DGSL",
        standard: "Twin Guide / Slide",
        boresOrRange: "Ø12, Ø16, Ø20, Ø25, Ø32, Ø40, Ø50, Ø63 mm",
        strokeOrVariant: "10 – 400 mm",
        cushioningOrRating: "Elastic P / Hydraulic shock | 1 – 10 bar",
        portsOrNotes: "Plain-bearing or ball-bearing guide",
      },
      {
        series: "DGC / DGC-HD",
        standard: "Rodless Linear",
        boresOrRange: "Ø8, Ø12, Ø18, Ø25, Ø32, Ø40, Ø50, Ø63 mm",
        strokeOrVariant: "Up to 8,500 mm (custom stroke)",
        cushioningOrRating: "PPV / YSR / YSRW shock | 1.5 – 8 bar",
        portsOrNotes: "Single-side supply, dust-protected band",
      },
    ],
    orderingTitle: "How to Order Pneumatic Cylinders Without Fitment Delays",
    orderingChecklist: [
      "Share exact OEM part number (e.g. DSBC-80-100-PA-N3R3 or ADN-25-10-I-P-A) OR specify Series + Bore (mm) + Stroke (mm).",
      "Confirm piston rod end (male M-thread vs female I-thread), through-rod (S2), or heat-resistant seal (S6) requirements.",
      "Specify magnetic piston sensing (A), end-position cushioning (P / PPV / PPS), and mounting kits (foot HNC, flange FNC, clevis LNC).",
      "Include push-in fitting tube OD (4, 6, 8, 10, 12 mm) and proximity switches so we consolidate them on one GST invoice.",
    ],
    faqs: [
      {
        question: "Which ISO pneumatic cylinder should I choose: DSBC (ISO 15552) or ADN (ISO 21287)?",
        answer:
          "Choose DSBC / DNC (ISO 15552) for strokes above 50 mm, heavier side loads, or high-speed cycling needing adjustable PPV / self-adjusting PPS cushioning. Choose ADN / AEN (ISO 21287) where mounting space is tight and strokes are typically 10–150 mm.",
      },
      {
        question: "Can Radiant supply exact bore-and-stroke configured Festo cylinders across India?",
        answer:
          "Yes. We supply both standard off-the-shelf bore/stroke configurations and configured Festo ISO 15552, ISO 21287, ISO 6432, DFM, and DGC models with pan-India GST billing.",
      },
      {
        question: "What information speeds up an industrial pneumatic cylinder quotation?",
        answer:
          "Providing the full Festo type code (e.g. ADN-25-10-I-P-A) or the 4 core parameters—Bore (mm), Stroke (mm), Mounting Standard, and Acting Type—lets our procurement desk confirm lead time and pricing promptly.",
      },
    ],
  },

  "tools-cutting-machining": {
    seoTitle: "Hand, Power & Aerospace Crimp Tools Supplier India",
    seoDescription:
      "Wholesale supply of MIL-spec DMC AF8, AFM8, MH860 crimp tools, turret heads, M22520 gages, Bosch/Makita/DEWALT power tools & Taparia/Stanley hand tools across India.",
    badgeLabel: "HAND, POWER & MIL-SPEC CRIMP TOOLING",
    introHeadline: "Industrial & MIL-Spec Tooling Selection Guide",
    introSummary:
      "Search exact part numbers for MIL-DTL-22520 crimp frames, turret heads, calibrated Go/No-Go gages, industrial drills/grinders, and forged workshop hand tools.",
    typesTitle: "Core Tooling Families & High-Demand Models",
    types: [
      {
        name: "MIL-Spec 8-Indent Crimp Frames & Kits (DMC)",
        standard: "MIL-DTL-22520/1* • /2* • /7*",
        specRange: "Wire Range: 12 – 32 AWG",
        summary:
          "Cycle-controlled precision ratchet crimp frames with 8-position selector knobs for aerospace, defence, harness, and industrial circular connectors.",
        modelSlugs: [
          "dmc-tools-af8",
          "dmc-tools-afm8",
          "dmc-tools-mh860-mh860",
          "dmc-tools-dmc1186",
        ],
      },
      {
        name: "Turret Heads, Positioners & Calibration Gages",
        standard: "M22520/1-02 to /1-18 • M22520/3-1",
        specRange: "TH-Series • TP-Series • G125 • 88-100",
        summary:
          "Contact-specific turret heads, positioners, and precision Go/No-Go calibration gages required to configure and verify AF8, AFM8, and MH860 crimp depth.",
        modelSlugs: ["dmc-tools-g125", "dmc-tools-88-100", "dmc-tools-th1", "dmc-tools-th4"],
      },
    ],
    sizingTitle: "Crimp Frame Comparison Matrix",
    sizingColumns: [
      "Model / MPN",
      "MIL-Spec Standard",
      "Wire Range (AWG)",
      "Frame Size",
      "Compatible Heads",
      "Verification Gage",
    ],
    sizingRows: [
      {
        series: "DMC AF8*",
        standard: "MIL-DTL-22520/1*",
        boresOrRange: "12 – 26 AWG",
        strokeOrVariant: "Standard 9.75\" (~425 g)",
        cushioningOrRating: "TH-Series Turrets, TP-Series, UH2-5",
        portsOrNotes: "DMC G125 (SEL #4) / 88-100 Set",
      },
      {
        series: "DMC MH860*",
        standard: "MIL-DTL-22520/7*",
        boresOrRange: "16 – 32 AWG",
        strokeOrVariant: "Middle-Range Compact",
        cushioningOrRating: "86-Series Positioners",
        portsOrNotes: "Verify per M22520/3 gage chart",
      },
      {
        series: "DMC AFM8*",
        standard: "MIL-DTL-22520/2*",
        boresOrRange: "20 – 32 AWG",
        strokeOrVariant: "Miniature 6.75\" (~285 g)",
        cushioningOrRating: "K-Series Positioners",
        portsOrNotes: "DMC G125 on SEL #8",
      },
    ],
    orderingTitle: "Tooling Procurement Checklist",
    orderingChecklist: [
      "Verify wire AWG range and connector contact MIL-spec / manufacturer part number before ordering crimp frames.",
      "Turret heads (TH-series) and positioners (86-/K-series) ship separately unless ordering a complete kit such as DMC1186.",
      "For industrial power & cutting tools, specify chuck/arbor size, voltage (230V AC / 18V Li-Ion), and consumable wheel/blade diameter.",
    ],
    faqs: [
      {
        question: "Does the DMC AF8 include turret heads in the box?",
        answer:
          "The standard AF8* (M22520/1-01) is supplied as the crimp tool frame alone; compatible TH-series turret heads, TP-series positioners, UH2-5 adjustable heads, and G125 gages are specified per your connector contact and supplied separately or as the DMC1186 kit.",
      },
    ],
  },

  "valves-pipes-flow": {
    seoTitle: "Industrial Valves, Pipes & Flow Control Supplier India",
    seoDescription:
      "Wholesale industrial ball, gate, globe, butterfly, check, and pneumatic solenoid valves across L&T Valves, Festo, Supreme & Jindal pipelines in India.",
    badgeLabel: "PROCESS VALVES • ACTUATED & PIPELINE HARDWARE",
    introHeadline: "Industrial Valve & Flow Control Selection Guide",
    introSummary:
      "Specify valve pattern, nominal bore, pressure class, body/trim metallurgy, and actuation method before requesting your project quotation.",
    typesTitle: "Flow Control Configurations",
    types: [
      {
        name: "Actuated Ball Valves & Process Isolation",
        standard: "API 6D / BS 5351 / ISO 5211",
        specRange: "DN15 – DN300 | PN16 – PN40 / Class 150–800",
        summary:
          "Manual gear-operated and pneumatic rack-and-pinion actuated ball/butterfly valves for steam, water, compressed air, oil, and chemical service.",
        modelSlugs: [
          "festo-ball-valve-actuator-unit-vzba-vzba-kha",
          "festo-ball-valve-actuator-unit-vzbc-vzbc-kha",
          "festo-ball-valve-actuator-unit-vzbm-a-vzbm-kha",
        ],
      },
    ],
    sizingTitle: "Valve Specification Parameters",
    sizingColumns: [
      "Valve Class",
      "Design Standard",
      "Line Size (NB / DN)",
      "Pressure Rating",
      "End Connections",
      "Common Body / Seat",
    ],
    sizingRows: [
      {
        series: "Process Isolation Valves",
        standard: "API 600 / ASME B16.34",
        boresOrRange: "15 mm – 600 mm (1/2\" – 24\")",
        strokeOrVariant: "Class 150 / 300 / 600 / 800",
        cushioningOrRating: "RF Flanged / Socket Weld / Butt Weld",
        portsOrNotes: "WCB / CF8 / CF8M | PTFE / Stellite",
      },
      {
        series: "Pneumatic Valve Actuators",
        standard: "ISO 5211 / NAMUR",
        boresOrRange: "DN15 – DN150 (1/2\" – 6\")",
        strokeOrVariant: "PN16 – PN40 | 4–8 bar pilot air",
        cushioningOrRating: "Double-acting / Spring-return",
        portsOrNotes: "SS316 / Brass | Namur 24V DC pilot",
      },
    ],
    orderingTitle: "Flow Control RFQ Checklist",
    orderingChecklist: [
      "Specify line size (NB/DN), end connection (BSP/NPT screwed, ANSI/DIN flanged, wafer), and pressure/temperature rating.",
      "State process fluid/gas to verify elastomer seat compatibility (PTFE, EPDM, NBR, Viton) and body grade (SS316/WCB/Brass).",
    ],
    faqs: [
      {
        question: "What details are needed to quote an industrial valve or actuator assembly?",
        answer:
          "Share nominal bore, connection type, pressure class, body/seal material, fluid media, and whether manual lever/gear or pneumatic/electric actuation is required.",
      },
    ],
  },

  "precision-instruments": {
    seoTitle: "Precision & Calibration Instruments Supplier India (Mitutoyo, Fluke)",
    seoDescription:
      "Shop genuine Mitutoyo micrometers, vernier calipers, dial gauges, and Fluke industrial multimeters, clamp meters & calibration testers across India.",
    badgeLabel: "DIMENSIONAL METROLOGY & TEST INSTRUMENTS",
    introHeadline: "Metrology & Test Equipment Selection Guide",
    introSummary:
      "Match measurement range, resolution, IP protection rating, and calibration certificate requirement before placing plant metrology orders.",
    typesTitle: "Key Instrument Families",
    types: [],
    sizingTitle: "Selection Matrix",
    sizingColumns: ["Category", "Typical Range", "Resolution", "Protection", "Output", "Calibration"],
    sizingRows: [
      {
        series: "Micrometers & Calipers",
        standard: "0–150 mm / 0–300 mm",
        boresOrRange: "0.001 mm – 0.01 mm",
        strokeOrVariant: "IP65 / IP67 Coolant Proof",
        cushioningOrRating: "SPC Data Output Optional",
        portsOrNotes: "Traceable / NABL on request",
      },
      {
        series: "Clamp Meters & Multimeters",
        standard: "600V – 1000V CAT III/IV",
        boresOrRange: "True-RMS AC/DC",
        strokeOrVariant: "IP54 Field Rugged",
        cushioningOrRating: "Min/Max/Peak Capture",
        portsOrNotes: "Safety Leads Included",
      },
    ],
    orderingTitle: "Metrology Ordering Checklist",
    orderingChecklist: [
      "Verify measurement span, least count (0.01 mm vs 0.001 mm), and coolant-proof IP rating.",
      "Request third-party NABL calibration certification explicitly on your RFQ if required for QC audit compliance.",
    ],
    faqs: [],
  },

  "bearings-transmission": {
    seoTitle: "Industrial Bearings, V-Belts & Power Transmission Supplier India",
    seoDescription:
      "Wholesale SKF, NTN & Fenner ball bearings, tapered roller bearings, pillow blocks, V-belts, pulleys, and power transmission components across India.",
    badgeLabel: "SKF • NTN • FENNER POWER TRANSMISSION",
    introHeadline: "Bearing & Drive Selection Checklist",
    introSummary:
      "Confirm OEM bearing suffix (2RS, ZZ, C3 clearance), shaft diameter, and belt cross-section before ordering plant maintenance spares.",
    typesTitle: "Drive & Bearing Families",
    types: [],
    sizingTitle: "Bearing & Belt Suffix Guide",
    sizingColumns: ["Suffix / Code", "Meaning", "Sealing", "Clearance", "Drive Belt", "Notes"],
    sizingRows: [
      {
        series: "2RS / 2RSH / LLU",
        standard: "Contact Rubber Seals",
        boresOrRange: "Dust & Moisture Sealed",
        strokeOrVariant: "Pre-lubricated Grease",
        cushioningOrRating: "Deep Groove / Angular",
        portsOrNotes: "Verify shaft & housing fit",
      },
      {
        series: "ZZ / 2Z / C3",
        standard: "Metal Shields + Clearance",
        boresOrRange: "Higher RPM / Thermal",
        strokeOrVariant: "Radial Internal C3",
        cushioningOrRating: "Electric Motors / Fans",
        portsOrNotes: "Check exact suffix on raceway",
      },
    ],
    orderingTitle: "Power Transmission Ordering Checklist",
    orderingChecklist: [
      "Always mention complete bearing suffix (e.g. 6205-2Z/C3 vs 6205-2RSH) so clearances and seals match OEM spec.",
      "For V-belts and timing belts, confirm section profile (SPZ/SPA/SPB/A/B/C/HTD) and pitch/inside length.",
    ],
    faqs: [],
  },

  "electrical-pneumatic-mro": {
    seoTitle: "Electrical Switchgear, Cables & Pneumatic FRL MRO Supplier India",
    seoDescription:
      "Wholesale Havells, Polycab, L&T Switchgear MCB/MCCB/contactors, armoured cables, Festo solenoid valves, and FRL air preparation units across India.",
    badgeLabel: "INDUSTRIAL SWITCHGEAR • CABLES • PNEUMATIC CONTROL",
    introHeadline: "Plant Electrical & Pneumatic Control MRO Guide",
    introSummary:
      "For ISO/compact/round pneumatic cylinders see our dedicated Pneumatic Cylinders & Actuators catalog; this division covers switchgear, armoured cables, FRL units, solenoid valves, and tubing.",
    typesTitle: "Electrical & Air-Prep Sub-Systems",
    types: [],
    sizingTitle: "Electrical & Air Control Selection Parameters",
    sizingColumns: ["Sub-System", "Voltage / Pressure", "Rating / Port", "Mounting / Cores", "Protection", "Companion Scope"],
    sizingRows: [
      {
        series: "MCB / MCCB / Contactors",
        standard: "230V / 415V AC",
        boresOrRange: "6A – 800A | 10kA – 50kA",
        strokeOrVariant: "DIN Rail / Panel Mount",
        cushioningOrRating: "IP20 / IP54 Enclosure",
        portsOrNotes: "Specify coil V & aux contacts",
      },
      {
        series: "FRL & Solenoid Valves",
        standard: "24V DC / 230V AC Pilot",
        boresOrRange: "G1/8 – G1 | 0 – 12 bar",
        strokeOrVariant: "5/2, 3/2, 5/3 Manifold",
        cushioningOrRating: "IP65 Coil",
        portsOrNotes: "Pair with Pneumatic Cylinders",
      },
    ],
    orderingTitle: "Electrical & Pneumatic Control Checklist",
    orderingChecklist: [
      "Confirm pole configuration (SP/DP/TP/FP), breaking capacity (kA), tripping curve, and coil voltage.",
      "For cables, confirm conductor (Cu/Al), cores × sq.mm, armouring, and IS/FR-LSH standard.",
    ],
    faqs: [],
  },
};

export function getCategoryProcurementGuide(slug: string): CategoryProcurementGuide | null {
  return CATEGORY_PROCUREMENT_GUIDES[slug] || null;
}
