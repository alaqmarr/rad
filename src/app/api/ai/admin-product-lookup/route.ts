import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scrapeAndStructureProduct } from "@/lib/ai-scraper";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const query = String(body?.query || "").trim();
    if (!query) {
      return NextResponse.json(
        { error: "Enter a product name, brand, or model number." },
        { status: 400 }
      );
    }

    const draft = await scrapeAndStructureProduct(query);
    return NextResponse.json({ success: true, draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Product lookup failed" },
      { status: 500 }
    );
  }
}
