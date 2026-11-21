import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageAuditSummary, runLiveExternalSizeEstimate } from "@/lib/storage-audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let samplePerHost = 6;
    try {
      const body = (await req.json()) as { samplePerHost?: number };
      if (body?.samplePerHost && Number.isFinite(body.samplePerHost)) {
        samplePerHost = Math.max(2, Math.min(15, Math.round(body.samplePerHost)));
      }
    } catch {
      // empty POST body allowed
    }

    const estimate = await runLiveExternalSizeEstimate(samplePerHost);
    const audit = await getStorageAuditSummary();

    return NextResponse.json({ ok: true, estimate, audit });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to measure external storage requirement" },
      { status: 500 }
    );
  }
}
