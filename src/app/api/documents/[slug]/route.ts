import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const s = await getSiteSettings();

  if (slug === "terms-summary") {
    const text = `RADIANT INDUSTRIAL CO. — STANDARD COMMERCIAL TERMS & CONDITIONS
Headquarters: ${s["contact_address"] || "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India"}
Phone: ${s["contact_phone"] || "+91 8522095253"} | Email: ${s["contact_email"] || "info@radiantindustrial.in"}

1. Quotation Validity: Prices quoted are valid for 7 days from the date of quotation, unless otherwise specified.
2. Delivery & Lead Time: Delivery timeline and dispatch schedule are confirmed upon order / Purchase Order receipt.
3. Freight: Standard freight & transport terms apply up to the agreed delivery location unless explicitly stated otherwise.
4. Payment Terms: As mutually agreed and confirmed with the Purchase Officer (Advance against PI or approved credit terms).
5. Order Processing: Orders are processed upon receipt of a valid Purchase Order (PO) or written confirmation.
6. Product Specifications: Materials strictly conform to the brand, make, model, and quantities stated in the quotation.
7. Taxes: Applicable GST and statutory charges apply as per HSN classification.
8. Price & Availability: Subject to final confirmation at order placement.
9. Delivery Exceptions: Subject to manufacturer and supplier lead times.
10. Acceptance: Issuance of a PO or acceptance of a quotation constitutes acceptance of these terms.
`;
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'inline; filename="radiant-commercial-terms.txt"',
      },
    });
  }

  if (slug === "company-profile") {
    const text = `RADIANT INDUSTRIAL CO. — VENDOR CAPABILITY & SOURCING PROFILE
Website: ${s["site_url"] || "https://radiantindustrial.in"}
Headquarters: ${s["contact_address"] || "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India"}
Phone / WhatsApp: ${s["contact_phone"] || "+91 8522095253"}
Email: ${s["contact_email"] || "info@radiantindustrial.in"}
Operating Hours: ${s["operating_hours"] || "Mon – Sat, 9:00 AM – 6:00 PM IST"}

BUSINESS OVERVIEW
Radiant Industrial Co. operates as an independent B2B wholesale supply and multi-brand procurement partner across India.
While we are not an authorized OEM distributor yet, we reliably source genuine industrial, technical, agricultural, and facility maintenance supplies across 24+ leading brands.

CORE DIVISIONS
1. Industrial Supply: Heavy machinery spares, bearings (SKF, NTN), pneumatics & hydraulics (Dowty, Festo), welding gear (ESAB), safety PPE (Udyogi, Karam), power tools (Bosch, Makita, Taparia), engineering metals & fasteners.
2. Special & Technical Supply: Precision metrology (Mitutoyo, Fluke), Polycab copper cables, L&T & Havells switchgear, SS instrumentation fittings.
3. Agricultural Supply: Jain & Netafim drip irrigation, Kirloskar agri pumps, tractor implements & harvesting tools.
4. General & Facility Supply: Godrej Storage Solutions racking, pallet trucks, packaging tapes, and facility MRO supplies.
`;
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'inline; filename="radiant-vendor-profile.txt"',
      },
    });
  }

  return NextResponse.json({ error: "Document not found" }, { status: 404 });
}
