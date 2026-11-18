import { NextResponse } from "next/server";
import { db, whatsappLogs } from "@/db";
import { getSiteSettings } from "@/lib/settings";

/**
 * Meta WhatsApp Business Cloud API Webhook (ready for future activation).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const settings = await getSiteSettings();
  const verifyToken = (settings["whatsapp_verify_token"] || "").trim();

  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const entry = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    const fromPhone = message?.from || "unknown";

    await db.insert(whatsappLogs).values({
      direction: "inbound",
      waMessageId: message?.id || null,
      phoneNumber: String(fromPhone),
      messageType: message?.type || "webhook",
      payloadJson: JSON.stringify(payload),
      status: "received",
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
