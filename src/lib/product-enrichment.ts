import type { SpecRow } from "@/db/schema";

const INTERNAL_SKU_PREFIX_RE =
  /^(?:DMC|KBL|TAP|BSH|MKT|MIT|FLK|BKD|DWT|HKK|ADD|FRM|ALK|TLT|ECO|PFP|DWS|FVL|FEV|FVK|MSL|FVB|BST|LOC|JDL|GODREJ|SUP|PLC|HAV|FES|FESTO|HNY|NTN|LT-SW|LTV|JAIN|NTF|FLC|UNB|3M|ESAB|NRT|FEN|SKF|GAZ|KRM|UDY|STN|STR)-(.+)$/i;

export function parseSpecsJson(raw: string | null | undefined): SpecRow[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (r): r is SpecRow =>
            Boolean(r) &&
            typeof r.label === "string" &&
            typeof r.value === "string" &&
            r.label.trim().length > 0 &&
            r.value.trim().length > 0
        )
      : [];
  } catch {
    return [];
  }
}

export function extractManufacturerPartNumber(sku: string, specs: SpecRow[]): string {
  for (const s of specs) {
    if (
      /^(mpn|manufacturer\s*part.*|part\s*(number|no\.?|no\.?\s*\/\s*sku|designation)|model(\s*no\.?)?|type\s*series\s*code|catalog(?:ue)?\s*(code|no\.?|number))$/i.test(
        (s.label || "").trim()
      )
    ) {
      const val = (s.value || "").trim();
      if (val && val.length <= 64 && !/^(n\/?a|as applicable|-)$/i.test(val)) {
        return val;
      }
    }
  }
  const match = sku.trim().match(INTERNAL_SKU_PREFIX_RE);
  return match?.[1]?.trim() || sku.trim();
}

function addSpecIfMissing(specs: SpecRow[], label: string, value: string | null | undefined) {
  const cleanVal = (value || "").trim();
  if (!cleanVal) return;
  const normLabel = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exists = specs.some(
    (s) => s.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normLabel
  );
  if (!exists) {
    specs.push({ label, value: cleanVal });
  }
}

/**
 * Extracts verified technical key-value specs cleanly from product descriptions and names
 * when those parameters are not yet broken out in specificationsJson.
 */
export function buildEnrichedSpecifications(
  product: {
    name: string;
    sku: string;
    shortDescription?: string | null;
    description?: string | null;
    hsnCode?: string | null;
  },
  existingSpecs: SpecRow[],
  mpn: string
): SpecRow[] {
  const specs = existingSpecs.map((s) => ({ label: s.label.trim(), value: s.value.trim() }));
  const fullText = [product.name, product.shortDescription || "", product.description || ""].join("\n");

  // 1. Wire AWG range (e.g. "12 through 26 AWG", "16 - 32 AWG", "20 to 32 AWG")
  const awgMatch = fullText.match(
    /\b(\d{1,2})\s*(?:-|–|to|through)\s*(\d{1,2})\s*AWG\b/i
  );
  if (awgMatch) {
    addSpecIfMissing(specs, "Wire Range", `${awgMatch[1]} – ${awgMatch[2]} AWG`);
  }

  // 2. MIL-Spec / AS / ISO / DIN / IS standards
  const stdMatches = Array.from(
    new Set(
      (
        fullText.match(
          /\b(?:MIL-DTL-\d+\/\d+\*?|MIL-C-\d+\/?\d*|AS\d+\/\d+\*?|ISO\s*\d{4,5}|DIN\s*\d{3,5}|VDMA\s*\d{4,5}|IS\s*\d{3,5}(?:-\d{4})?)\b/gi
        ) || []
      ).map((m) => m.replace(/\s+/g, " ").trim())
    )
  );
  if (stdMatches.length > 0) {
    addSpecIfMissing(specs, "Standard / Qualification", stdMatches.slice(0, 4).join(", "));
  }

  // 3. Crimp geometry & selector knob
  if (/\b8[- ]?(?:impression|indent)\b/i.test(fullText)) {
    const selectorMatch = fullText.match(/\b(\d+)[- ]?position\s+selector|\b(\d+)\s*step\s+selector/i);
    const selText = selectorMatch
      ? `, ${selectorMatch[1] || selectorMatch[2]}-Position Selector Knob`
      : "";
    addSpecIfMissing(specs, "Crimp Configuration", `8-Indent Precision Ratchet${selText}`);
  }

  // 4. Bore x Stroke extracted from Festo/pneumatic part designations like ADN-25-10-I-P-A or DSBC-80-100-PA-N3R3 or DFM-50-50
  const cylCodeMatch = `${product.name} ${mpn}`.match(
    /\b(?:DSBC|DNC|ADN|AEN|ADNGF|DSNU|DFM|ADVU|AEVU)(?:-[A-Z]+)?-(\d{1,3})-(\d{1,4})\b/i
  );
  if (cylCodeMatch) {
    addSpecIfMissing(specs, "Bore Diameter", `${cylCodeMatch[1]} mm`);
    addSpecIfMissing(specs, "Stroke Length", `${cylCodeMatch[2]} mm`);
  }

  // 5. Cushioning codes for pneumatic cylinders
  if (/\bPPV\b|\badjustable\s+cushioning\b/i.test(fullText)) {
    addSpecIfMissing(specs, "End-Position Cushioning", "PPV — Adjustable Pneumatic Cushioning");
  } else if (/\bPPS|self-adjusting.*cushioning\b/i.test(fullText)) {
    addSpecIfMissing(specs, "End-Position Cushioning", "PPS — Self-Adjusting Pneumatic Cushioning");
  }

  // 6. Acting mode & Magnetic piston sensing
  if (/\bdouble-acting\b/i.test(fullText)) {
    addSpecIfMissing(specs, "Mode of Operation", "Double-Acting");
  } else if (/\bsingle-acting\b/i.test(fullText)) {
    addSpecIfMissing(specs, "Mode of Operation", "Single-Acting");
  }

  // 7. Operating pressure / Voltage / Power / Dimensions / Weight
  const pressureMatch = fullText.match(/\b(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(bar|MPa|psi)\b/i);
  if (pressureMatch) {
    addSpecIfMissing(
      specs,
      "Operating Pressure",
      `${pressureMatch[1]} – ${pressureMatch[2]} ${pressureMatch[3]}`
    );
  }

  const dimMatch = fullText.match(
    /\b(\d+(?:\.\d+)?)\s*(?:"|in\.?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|in\.?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|in\.?)/i
  );
  if (dimMatch) {
    addSpecIfMissing(specs, "Dimensions", `${dimMatch[1]}" × ${dimMatch[2]}" × ${dimMatch[3]}"`);
  }

  const weightMatch = fullText.match(/\bweighs?\s+(?:approximately\s+)?(\d+(?:\.\d+)?\s*(?:oz|lbs?|kg|g))\b/i);
  if (weightMatch) {
    addSpecIfMissing(specs, "Weight", weightMatch[1]);
  }

  // 8. Calibration gage reference
  const gageMatch = fullText.match(/\b(?:DMC®?\s*part\s*no\.?\s*|gage\s*\()(?:G\d{2,4})|\b(G125)\b/i);
  if (gageMatch) {
    addSpecIfMissing(specs, "Calibration Gage", "DMC G125 (M22520/3-1) Go/No-Go Gage");
  }

  if (product.hsnCode && product.hsnCode.trim()) {
    addSpecIfMissing(specs, "HSN Code", product.hsnCode.trim());
  }

  return specs;
}

/**
 * Picks up to 4 concise, high-signal spec highlights for the above-the-fold product summary strip.
 */
export function extractKeySpecHighlights(specs: SpecRow[]): SpecRow[] {
  const priorityLabels = [
    /wire range|awg/i,
    /standard|qualification|mil-spec/i,
    /bore diameter/i,
    /stroke length/i,
    /crimp configuration/i,
    /mode of operation/i,
    /end-position cushioning|cushioning/i,
    /operating pressure|pressure/i,
    /calibration gage/i,
    /dimensions/i,
    /weight/i,
    /material|grade/i,
  ];
  const picked: SpecRow[] = [];
  for (const re of priorityLabels) {
    const found = specs.find((s) => re.test(s.label) && !picked.some((p) => p.label === s.label));
    if (found) picked.push(found);
    if (picked.length >= 4) break;
  }
  return picked;
}

/**
 * Extracts companion/compatible OEM part codes referenced inside product descriptions or known series pairings.
 */
export function extractReferencedPartCodes(
  product: { sku: string; slug: string; name: string; shortDescription?: string | null; description?: string | null },
  mpn: string
): string[] {
  const codes = new Set<string>();
  const upperMpn = mpn.toUpperCase().replace(/\*+$/, "");
  const fullText = [product.name, product.shortDescription || "", product.description || ""].join(" ");

  // Explicit known DMC AF8 / AFM8 / MH860 ecosystem
  if (upperMpn === "AF8" || product.slug === "dmc-tools-af8") {
    ["G125", "88-100", "DMC1186", "TH1", "TH4", "TH163", "AFM8*", "MH860"].forEach((c) =>
      codes.add(c)
    );
  } else if (upperMpn === "AFM8" || product.slug === "dmc-tools-afm8") {
    ["G125", "AF8*", "MH860", "WA22", "TH1"].forEach((c) => codes.add(c));
  } else if (upperMpn.startsWith("MH860")) {
    ["G125", "AF8*", "AFM8*"].forEach((c) => codes.add(c));
  }

  // Extract explicit model/part codes mentioned in text (e.g. G125, 88-100, AFE8B, WA27F, DMC1186, YSRW-DGC, DGC, DSBC)
  const tokenMatches =
    fullText.match(
      /\b(?:G125|88-100|AFE8B|WA27F|WA22|DMC1186|UH2-5|TH\d{1,4}[A-Z]?|TP\d{1,4}[A-Z]?|86-\d{1,4}[A-Z]?|YSRW-DGC(?:-25-KF)?|DSBC|DNC|ADN|AEN|ADNGF|DSNU|DFM|DGC)\b/g
    ) || [];
  for (const tok of tokenMatches) {
    if (tok.toUpperCase() !== upperMpn) {
      codes.add(tok);
    }
  }

  return Array.from(codes).slice(0, 12);
}

export interface OrderingGuidance {
  title: string;
  checklist: string[];
}

export function getOrderingGuidance(params: {
  categorySlug?: string | null;
  brandSlug?: string | null;
  mpn: string;
}): OrderingGuidance {
  const { categorySlug, brandSlug, mpn } = params;

  if (brandSlug === "dmc-tools") {
    return {
      title: `Before Ordering DMC ${mpn}`,
      checklist: [
        "Confirm contact MIL-spec / connector series and exact wire AWG range before finalizing.",
        "Turret heads (TH-series), single-position heads (TP-series), and UH2-5 adjustable positioners are ordered separately unless purchasing a complete kit (e.g. DMC1186).",
        "Specify if you require factory or third-party calibration certification alongside Go/No-Go gage (G125 / 88-100) checks.",
      ],
    };
  }

  if (categorySlug === "pneumatic-cylinders" || brandSlug === "festo") {
    return {
      title: `Before Ordering Pneumatic Component ${mpn}`,
      checklist: [
        "Verify exact cylinder series, bore diameter (mm), stroke length (mm), and acting type (double-acting or single-acting).",
        "Confirm cushioning type (P, PPV adjustable, or PPS self-adjusting), piston rod thread, and mounting style (foot, flange, trunnion, clevis).",
        "Indicate solenoid coil voltage (e.g. 24V DC / 230V AC), port thread size (M5, G1/8, G1/4, G3/8), and T-slot/C-slot magnetic proximity switch requirements.",
      ],
    };
  }

  if (categorySlug === "valves-pipes-flow") {
    return {
      title: `Before Ordering Flow Control Item ${mpn}`,
      checklist: [
        "Confirm nominal bore (NB / DN), end connection (flanged, BSP/NPT screwed, socket weld, wafer), and pressure class (PN16 / Class 150 / 800).",
        "Verify body and trim/seal material compatibility (WCB, CF8M/SS316, brass, PTFE/EPDM/Viton) for your media temperature and fluid.",
      ],
    };
  }

  return {
    title: `Ordering & Verification Notes (${mpn})`,
    checklist: [
      "Share your required quantity, OEM part number, and GST billing/delivery pin code for formal quotation.",
      "Specifications, tolerances, and sub-assemblies may vary by manufacturer revision—our procurement team confirms exact datasheet fitment before dispatch.",
    ],
  };
}
