import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSiteSettings } from "./settings";

export interface UploadResult {
  url: string;
  key: string;
  storage: "r2" | "local";
  fileName: string;
  fileSize: number;
  mimeType: string;
}

async function getR2Config() {
  const settings = await getSiteSettings();
  const accountId = (settings["r2_account_id"] || "").trim();
  const accessKeyId = (settings["r2_access_key_id"] || "").trim();
  const secretAccessKey = (settings["r2_secret_access_key"] || "").trim();
  const bucketName = (settings["r2_bucket_name"] || "radiant-industrial-media").trim();
  const publicUrl = (settings["r2_public_url"] || "").trim().replace(/\/+$/, "");

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, isConfigured };
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function uploadFileToStorage(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
}): Promise<UploadResult> {
  const folder = (params.folder || "general").replace(/[^a-z0-9\-_/]/gi, "");
  const ext = path.extname(params.fileName) || "";
  const base = sanitizeFileName(path.basename(params.fileName, ext)) || "file";
  const uniqueId = crypto.randomBytes(5).toString("hex");
  const key = `${folder}/${Date.now()}-${uniqueId}-${base}${ext}`;

  const r2 = await getR2Config();

  if (r2.isConfigured) {
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: params.buffer,
        ContentType: params.mimeType,
      })
    );

    const url = r2.publicUrl
      ? `${r2.publicUrl}/${key}`
      : `https://${r2.bucketName}.${r2.accountId}.r2.dev/${key}`;

    return {
      url,
      key,
      storage: "r2",
      fileName: params.fileName,
      fileSize: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  // Local fallback until R2 credentials are entered in Admin Settings
  const uploadsRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads", folder);
  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }
  const localFileName = `${Date.now()}-${uniqueId}-${base}${ext}`;
  const fullPath = path.join(uploadsRoot, localFileName);
  fs.writeFileSync(fullPath, params.buffer);

  return {
    url: `/uploads/${folder}/${localFileName}`,
    key: `local:${folder}/${localFileName}`,
    storage: "local",
    fileName: params.fileName,
    fileSize: params.buffer.length,
    mimeType: params.mimeType,
  };
}

export async function deleteFileFromStorage(key: string): Promise<void> {
  if (!key) return;
  if (key.startsWith("local:")) {
    const rel = key.replace(/^local:/, "");
    const fullPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads", rel);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return;
  }

  const r2 = await getR2Config();
  if (!r2.isConfigured) return;

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  });

  await s3.send(
    new DeleteObjectCommand({
      Bucket: r2.bucketName,
      Key: key,
    })
  );
}
