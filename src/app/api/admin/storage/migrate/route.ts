import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getR2RealtimeStatus } from "@/lib/r2";
import { getStorageAuditSummary, migrateExternalImagesBatch } from "@/lib/storage-audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let batchSize = 20;
    try {
      const body = (await req.json()) as { batchSize?: number };
      if (body?.batchSize && Number.isFinite(body.batchSize)) {
        batchSize = Math.max(1, Math.min(40, Math.round(body.batchSize)));
      }
    } catch {
      // empty body uses default 20
    }

    const result = await migrateExternalImagesBatch(batchSize);
    const [status, audit] = await Promise.all([
      getR2RealtimeStatus({ runWriteProbe: false }),
      getStorageAuditSummary(),
    ]);

    return NextResponse.json({ ok: true, result, status, audit });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to migrate batch to R2" },
      { status: 500 }
    );
  }
}
