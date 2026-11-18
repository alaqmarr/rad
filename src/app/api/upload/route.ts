import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFileToStorage } from "@/lib/r2";

const ALLOWED_RFQ_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xlsx", ".xls", ".csv", ".doc", ".docx"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "admin";
    const session = await getServerSession(authOptions);

    if (scope !== "rfq" && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || (scope === "rfq" ? "rfq-attachments" : "media"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File exceeds 15 MB limit" }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const ext = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".")) : "";
    if (scope === "rfq" && !ALLOWED_RFQ_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Unsupported BOM/attachment format. Upload PDF, Excel, Word, or Image." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFileToStorage({
      buffer,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      folder,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
