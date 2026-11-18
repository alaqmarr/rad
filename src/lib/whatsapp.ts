import { db, whatsappLogs } from "@/db";
import { getSiteSettings } from "./settings";
import type { EnquiryItem } from "@/db/schema";

export function buildWhatsAppQuoteMessage(params: {
  items: EnquiryItem[];
  customerName?: string;
  companyName?: string;
  deliveryLocation?: string;
  notes?: string;
  pageUrl?: string;
  showPrices?: boolean;
}): string {
  const lines: string[] = [
    "Hello Radiant Industrial Co.,",
    "Please share your best price & delivery timeline for:",
    "",
  ];

  params.items.forEach((item, index) => {
    const brandPart = item.brand ? ` (${item.brand})` : "";
    const skuPart = item.sku ? `[${item.sku}] ` : "";
    const pricePart =
      params.showPrices && item.listedPrice != null
        ? ` — Listed: ₹${Number(item.listedPrice).toLocaleString("en-IN")}/${item.unit || "NOS"}`
        : "";
    lines.push(
      `${index + 1}. ${skuPart}${item.name}${brandPart} — Qty: ${item.qty} ${item.unit || "NOS"}${pricePart}`
    );
  });

  if (params.customerName || params.companyName) {
    lines.push("");
    lines.push(
      `Name: ${[params.customerName, params.companyName].filter(Boolean).join(" | ")}`
    );
  }
  if (params.deliveryLocation) {
    lines.push(`Delivery Location: ${params.deliveryLocation}`);
  }
  if (params.notes) {
    lines.push(`Notes: ${params.notes}`);
  }
  if (params.pageUrl) {
    lines.push(`Product Link: ${params.pageUrl}`);
  }

  return lines.join("\n");
}

export function buildWhatsAppUrl(phoneDigits: string, message: string): string {
  const cleanPhone = phoneDigits.replace(/[^\d]/g, "") || "918522095253";
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Future-ready WhatsApp Business Cloud API dispatcher.
 * Reads configuration purely from database site_settings.
 */
export async function dispatchWhatsAppMessage(params: {
  toPhone?: string;
  message: string;
}): Promise<{ mode: "wa_link" | "cloud_api"; url: string; dispatched: boolean }> {
  const s = await getSiteSettings();
  const mode = (s["whatsapp_mode"] || "wa_link") as "wa_link" | "cloud_api";
  const businessPhone = s["whatsapp_number"] || "918522095253";
  const phoneNumberId = (s["whatsapp_phone_number_id"] || "").trim();
  const accessToken = (s["whatsapp_access_token"] || "").trim();

  const targetPhone = (params.toPhone || businessPhone).replace(/[^\d]/g, "");
  const fallbackUrl = buildWhatsAppUrl(targetPhone, params.message);

  if (mode === "cloud_api" && phoneNumberId && accessToken) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: targetPhone,
          type: "text",
          text: { body: params.message },
        }),
      });
      const json = await res.json();
      await db.insert(whatsappLogs).values({
        direction: "outbound",
        waMessageId: json?.messages?.[0]?.id || null,
        phoneNumber: targetPhone,
        messageType: "text",
        payloadJson: JSON.stringify(json),
        status: res.ok ? "sent" : "failed",
      });
      return { mode, url: fallbackUrl, dispatched: res.ok };
    } catch (err) {
      await db.insert(whatsappLogs).values({
        direction: "outbound",
        phoneNumber: targetPhone,
        messageType: "text",
        payloadJson: JSON.stringify({ error: err instanceof Error ? err.message : "Network error" }),
        status: "failed",
      });
      return { mode, url: fallbackUrl, dispatched: false };
    }
  }

  await db.insert(whatsappLogs).values({
    direction: "outbound",
    phoneNumber: targetPhone,
    messageType: "wa_link",
    payloadJson: JSON.stringify({ preview: params.message }),
    status: "link_generated",
  });

  return { mode: "wa_link", url: fallbackUrl, dispatched: true };
}
