import { NextResponse } from "next/server";
import { runProcurementAssistant, forwardAiLead, type ChatMessage } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId || "anon-" + Date.now());
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const fwd = req.headers.get("x-forwarded-for") || "";
    const clientIp = fwd.split(",")[0]?.trim() || "";
    const clientKey = clientIp ? `ip:${clientIp}` : `sess:${sessionId}`;

    const result = await runProcurementAssistant({ sessionId, messages, clientKey });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI assistant unavailable" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId || "anon-" + Date.now());
    const customerName = String(body?.customerName || "").trim();
    const phone = String(body?.phone || "").trim();
    const requestedItems = String(body?.requestedItems || "").trim();

    if (!customerName || !phone || !requestedItems) {
      return NextResponse.json(
        { error: "Name, Phone/WhatsApp, and Required Items are required." },
        { status: 400 }
      );
    }

    const result = await forwardAiLead({
      sessionId,
      customerName,
      companyName: body?.companyName ? String(body.companyName) : undefined,
      email: body?.email ? String(body.email) : undefined,
      phone,
      deliveryLocation: body?.deliveryLocation ? String(body.deliveryLocation) : undefined,
      requestedItems,
      notes: body?.notes ? String(body.notes) : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to forward lead" },
      { status: 500 }
    );
  }
}
