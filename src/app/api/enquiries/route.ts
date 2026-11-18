import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import { db, enquiries, type EnquiryItem } from "@/db";
import { authOptions } from "@/lib/auth";
import { sendEnquiryEmails } from "@/lib/mailer";
import { buildWhatsAppQuoteMessage, dispatchWhatsAppMessage } from "@/lib/whatsapp";
import { getSiteSettings } from "@/lib/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(200);
  return NextResponse.json({ enquiries: rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const channel = String(body?.channel || "email");
    const customerName = String(body?.customerName || "").trim();
    const companyName = String(body?.companyName || "").trim();
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const gstNumber = String(body?.gstNumber || "").trim();
    const deliveryLocation = String(body?.deliveryLocation || "").trim();
    const attachmentUrl = body?.attachmentUrl ? String(body.attachmentUrl) : null;
    const message = String(body?.message || "").trim();
    const pageUrl = body?.pageUrl ? String(body.pageUrl) : undefined;
    const items: EnquiryItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!customerName && channel !== "whatsapp") {
      return NextResponse.json({ error: "Your name is required." }, { status: 400 });
    }

    if (channel === "email" && !email) {
      return NextResponse.json({ error: "Email address is required for email quotes." }, { status: 400 });
    }

    const referenceNo = `RFQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const [created] = await db
      .insert(enquiries)
      .values({
        referenceNo,
        channel,
        customerName: customerName || "WhatsApp Visitor",
        companyName,
        email,
        phone,
        gstNumber,
        deliveryLocation,
        itemsJson: JSON.stringify(items),
        attachmentUrl,
        message,
        status: "new",
      })
      .returning();

    let emailSent = false;
    let customerThankYouSent = false;
    let emailError: string | undefined;
    let whatsappUrl: string | undefined;

    if (channel === "email" || channel === "contact_form") {
      const mailRes = await sendEnquiryEmails({
        referenceNo,
        channel: channel === "contact_form" ? "Contact Form" : "Email Enquiry",
        customerName: customerName || "Buyer",
        companyName,
        email,
        phone,
        gstNumber,
        deliveryLocation,
        items,
        attachmentUrl,
        message,
      });
      emailSent = mailRes.sent;
      customerThankYouSent = mailRes.customerThankYouSent;
      emailError = mailRes.error;
      if (emailSent && created) {
        await db.update(enquiries).set({ emailSent: true }).where(eq(enquiries.id, created.id));
      }
    }

    if (channel === "whatsapp") {
      const settings = await getSiteSettings();
      const waText = buildWhatsAppQuoteMessage({
        items,
        customerName,
        companyName,
        deliveryLocation,
        notes: message,
        pageUrl,
        showPrices: settings["show_public_prices"] === "true",
      });
      const waRes = await dispatchWhatsAppMessage({ message: waText });
      whatsappUrl = waRes.url;
      if (created) {
        await db
          .update(enquiries)
          .set({ whatsappDispatched: waRes.dispatched })
          .where(eq(enquiries.id, created.id));
      }
    }

    return NextResponse.json({
      success: true,
      referenceNo,
      enquiryId: created?.id,
      emailSent,
      customerThankYouSent,
      emailError,
      whatsappUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit enquiry" },
      { status: 500 }
    );
  }
}
