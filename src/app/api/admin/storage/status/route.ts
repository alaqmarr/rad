import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getR2RealtimeStatus } from "@/lib/r2";
import { getStorageAuditSummary } from "@/lib/storage-audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const runWriteProbe = url.searchParams.get("probe") === "1";

    const [status, audit] = await Promise.all([
      getR2RealtimeStatus({ runWriteProbe }),
      getStorageAuditSummary(),
    ]);

    return NextResponse.json({ status, audit });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to inspect storage status" },
      { status: 500 }
    );
  }
}
