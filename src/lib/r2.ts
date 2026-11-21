import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db, siteSettings } from "@/db";
import { getSiteSettings } from "./settings";

export interface UploadResult {
  url: string;
  key: string;
  storage: "r2" | "local";
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  isConfigured: boolean;
}

export interface R2EnvCandidate {
  available: boolean;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface R2BucketObjectSample {
  key: string;
  size: number;
  lastModified: string | null;
}

export interface R2RealtimeStatus {
  checkedAt: string;
  configured: boolean;
  connected: boolean;
  writable: boolean | null;
  bucketExists: boolean;
  bucketCreated?: boolean;
  latencyMs: number | null;
  probeLatencyMs?: number | null;
  error: string | null;
  bucketName: string;
  accountIdMasked: string;
  accessKeyMasked: string;
  endpoint: string;
  publicUrl: string;
  effectivePublicUrl: string;
  publicUrlReachable: boolean | null;
  envCandidate: {
    available: boolean;
    bucketName: string;
    hasPublicUrl: boolean;
  };
  bucketStats: {
    objectCount: number;
    totalBytes: number;
    truncated: boolean;
    prefixes: Record<string, { count: number; bytes: number }>;
    recentObjects: R2BucketObjectSample[];
  } | null;
  localDisk: {
    sqliteDbBytes: number;
    uploadsBytes: number;
    uploadsFiles: number;
    logosBytes: number;
    logosFiles: number;
  };
}

export function getEnvR2Candidate(): R2EnvCandidate {
  const accountId = (
    process.env.R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID ||
    ""
  ).trim();
  const accessKeyId = (
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    ""
  ).trim();
  const secretAccessKey = (
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    ""
  ).trim();
  const bucketName = (
    process.env.R2_BUCKET_NAME || "radiant-industrial-media"
  ).trim();
  const publicUrl = (
    process.env.R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  return {
    available: Boolean(accountId && accessKeyId && secretAccessKey && bucketName),
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  };
}

export async function getR2Config(): Promise<R2Config> {
  const settings = await getSiteSettings();
  const accountId = (settings["r2_account_id"] || "").trim();
  const accessKeyId = (settings["r2_access_key_id"] || "").trim();
  const secretAccessKey = (settings["r2_secret_access_key"] || "").trim();
  const bucketName = (settings["r2_bucket_name"] || "radiant-industrial-media").trim();
  const publicUrl = (settings["r2_public_url"] || "").trim().replace(/\/+$/, "");

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, isConfigured };
}

export function createR2S3Client(r2: Pick<R2Config, "accountId" | "accessKeyId" | "secretAccessKey">): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  });
}

export function maskSecret(value: string, head = 4, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail) return "•".repeat(value.length);
  return `${value.slice(0, head)}${"•".repeat(Math.min(12, value.length - head - tail))}${value.slice(-tail)}`;
}

export async function saveR2SettingsToDb(values: {
  r2_account_id?: string;
  r2_access_key_id?: string;
  r2_secret_access_key?: string;
  r2_bucket_name?: string;
  r2_public_url?: string;
}): Promise<void> {
  const defs: Record<string, { label: string; isSecret: boolean }> = {
    r2_account_id: { label: "Cloudflare R2 Account ID", isSecret: false },
    r2_access_key_id: { label: "R2 Access Key ID", isSecret: true },
    r2_secret_access_key: { label: "R2 Secret Access Key", isSecret: true },
    r2_bucket_name: { label: "R2 Bucket Name", isSecret: false },
    r2_public_url: { label: "R2 Public CDN URL", isSecret: false },
  };

  for (const [key, val] of Object.entries(values)) {
    if (val === undefined) continue;
    const cleaned = val.trim();
    const existing = await db
      .select({ key: siteSettings.key })
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(siteSettings)
        .set({ value: cleaned, updatedAt: new Date().toISOString() })
        .where(eq(siteSettings.key, key));
    } else {
      const def = defs[key] || { label: key, isSecret: key.includes("secret") };
      await db.insert(siteSettings).values({
        key,
        category: "r2",
        label: def.label,
        value: cleaned,
        valueType: def.isSecret ? "password" : "text",
        isSecret: def.isSecret,
      });
    }
  }
}

export function parseR2QuickPaste(raw: string): Partial<{
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}> {
  const text = raw.trim();
  const out: Partial<{
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  }> = {};

  if (!text) return out;

  // 1. Try JSON object first
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const pick = (...keys: string[]) => {
        for (const k of keys) {
          const v = obj[k];
          if (typeof v === "string" && v.trim()) return v.trim();
        }
        return undefined;
      };
      out.accountId = pick("accountId", "account_id", "r2_account_id", "R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID");
      out.accessKeyId = pick("accessKeyId", "access_key_id", "r2_access_key_id", "R2_ACCESS_KEY_ID");
      out.secretAccessKey = pick("secretAccessKey", "secret_access_key", "r2_secret_access_key", "R2_SECRET_ACCESS_KEY");
      out.bucketName = pick("bucketName", "bucket", "bucket_name", "r2_bucket_name", "R2_BUCKET_NAME");
      out.publicUrl = pick("publicUrl", "public_url", "r2_public_url", "R2_PUBLIC_URL");
    } catch {
      // fall through to regex parsing
    }
  }

  // 2. Parse KEY=VALUE or KEY: VALUE lines
  const kvMatches = text.matchAll(
    /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*[:=]\s*["']?([^\r\n"']+)["']?/gm
  );
  for (const m of kvMatches) {
    const k = m[1].toUpperCase();
    const v = m[2].trim();
    if (!v) continue;
    if (k.includes("ACCOUNT_ID")) out.accountId ||= v;
    else if (k.includes("ACCESS_KEY")) out.accessKeyId ||= v;
    else if (k.includes("SECRET_ACCESS") || k.includes("SECRET_KEY")) out.secretAccessKey ||= v;
    else if (k.includes("BUCKET")) out.bucketName ||= v;
    else if (k.includes("PUBLIC_URL") || k.includes("CDN_URL")) out.publicUrl ||= v.replace(/\/+$/, "");
    else if (k.includes("ENDPOINT") || k.includes("S3_API")) {
      const accMatch = v.match(/https?:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com(?:\/([^/\s]+))?/i);
      if (accMatch) {
        out.accountId ||= accMatch[1];
        if (accMatch[2]) out.bucketName ||= accMatch[2];
      }
    }
  }

  // 3. Extract Cloudflare S3 endpoint URL anywhere in text
  const s3UrlMatch = text.match(/https?:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com(?:\/([a-z0-9._-]+))?/i);
  if (s3UrlMatch) {
    out.accountId ||= s3UrlMatch[1];
    if (s3UrlMatch[2]) out.bucketName ||= s3UrlMatch[2];
  }

  // 4. Extract r2.dev public CDN URL if present
  const pubMatch = text.match(/https?:\/\/pub-[a-z0-9]+\.r2\.dev\b/i);
  if (pubMatch) {
    out.publicUrl ||= pubMatch[0];
  }

  // 5. Fallback positional hex heuristics for unstructured pastes (accountId=32hex, accessKey=32hex, secretKey=64hex)
  if (!out.secretAccessKey) {
    const secretHex = text.match(/\b([a-f0-9]{64})\b/i);
    if (secretHex) out.secretAccessKey = secretHex[1];
  }
  const hex32s = [...text.matchAll(/\b([a-f0-9]{32})\b/gi)].map((m) => m[1]);
  for (const h of hex32s) {
    if (!out.accountId) out.accountId = h;
    else if (!out.accessKeyId && h !== out.accountId) out.accessKeyId = h;
  }

  return out;
}

export async function discoverCloudflareR2WithToken(params: {
  apiToken: string;
  preferredBucketName?: string;
}): Promise<{
  accountId: string;
  accountName: string;
  bucketName: string;
  bucketCreated: boolean;
  publicUrl: string;
  existingBuckets: string[];
}> {
  const token = params.apiToken.trim();
  if (!token) throw new Error("Cloudflare API Token is required.");

  const cfFetch = async (endpoint: string, init?: RequestInit) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(12000),
    });
    const json = (await res.json()) as {
      success: boolean;
      errors?: Array<{ message: string; code?: number }>;
      result?: unknown;
    };
    return { status: res.status, json };
  };

  const accountsRes = await cfFetch("/accounts");
  const accountsList = Array.isArray(accountsRes.json.result)
    ? (accountsRes.json.result as Array<{ id: string; name: string }>)
    : [];
  if (!accountsRes.json.success || accountsList.length === 0) {
    const msg =
      accountsRes.json.errors?.[0]?.message ||
      "Unable to list Cloudflare accounts with this token. Ensure it includes Account Settings:Read & R2:Edit.";
    throw new Error(msg);
  }

  const account = accountsList[0];
  const accountId = account.id;
  const targetBucket = (params.preferredBucketName || "radiant-industrial-media").trim();

  // List existing buckets
  const listRes = await cfFetch(`/accounts/${accountId}/r2/buckets`);
  const rawBuckets = (listRes.json.result as { buckets?: Array<{ name: string }> } | undefined)?.buckets;
  const existingBuckets = Array.isArray(rawBuckets) ? rawBuckets.map((b) => b.name) : [];

  let bucketCreated = false;
  if (!existingBuckets.includes(targetBucket)) {
    const createRes = await cfFetch(`/accounts/${accountId}/r2/buckets`, {
      method: "POST",
      body: JSON.stringify({ name: targetBucket }),
    });
    if (!createRes.json.success) {
      const errMsg = createRes.json.errors?.[0]?.message || "Failed to create R2 bucket via API";
      throw new Error(errMsg);
    }
    bucketCreated = true;
    existingBuckets.push(targetBucket);
  }

  // Ensure/discover managed r2.dev public domain
  let publicUrl = "";
  const domRes = await cfFetch(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(targetBucket)}/domains/managed`);
  const domResult = domRes.json.result as { enabled?: boolean; domain?: string } | undefined;
  if (domResult?.enabled && domResult.domain) {
    publicUrl = `https://${domResult.domain}`;
  } else {
    const enableRes = await cfFetch(
      `/accounts/${accountId}/r2/buckets/${encodeURIComponent(targetBucket)}/domains/managed`,
      {
        method: "PUT",
        body: JSON.stringify({ enabled: true }),
      }
    );
    const enabledResult = enableRes.json.result as { domain?: string } | undefined;
    if (enableRes.json.success && enabledResult?.domain) {
      publicUrl = `https://${enabledResult.domain}`;
    }
  }

  return {
    accountId,
    accountName: account.name || accountId,
    bucketName: targetBucket,
    bucketCreated,
    publicUrl,
    existingBuckets,
  };
}

export async function verifyAndAutoCreateBucket(
  cfg: R2Config,
  options: { createIfMissing?: boolean; runWriteProbe?: boolean } = {}
): Promise<{
  connected: boolean;
  bucketExists: boolean;
  bucketCreated: boolean;
  writable: boolean | null;
  latencyMs: number;
  probeLatencyMs: number | null;
  error: string | null;
}> {
  if (!cfg.isConfigured) {
    return {
      connected: false,
      bucketExists: false,
      bucketCreated: false,
      writable: null,
      latencyMs: 0,
      probeLatencyMs: null,
      error: "Missing R2 Account ID, Access Key ID, Secret Access Key, or Bucket Name.",
    };
  }

  const s3 = createR2S3Client(cfg);
  const t0 = performance.now();
  let bucketExists = false;
  let bucketCreated = false;

  try {
    await s3.send(new HeadBucketCommand({ Bucket: cfg.bucketName }));
    bucketExists = true;
  } catch (err) {
    const statusCode = (err as { $metadata?: { httpStatusCode?: number }; name?: string })?.$metadata?.httpStatusCode;
    const errName = (err as { name?: string })?.name || "";
    if (options.createIfMissing !== false && (statusCode === 404 || errName === "NotFound" || errName === "NoSuchBucket")) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: cfg.bucketName }));
        bucketExists = true;
        bucketCreated = true;
      } catch (createErr) {
        return {
          connected: false,
          bucketExists: false,
          bucketCreated: false,
          writable: false,
          latencyMs: Math.round(performance.now() - t0),
          probeLatencyMs: null,
          error: createErr instanceof Error ? createErr.message : "Bucket not found and auto-create failed",
        };
      }
    } else {
      return {
        connected: false,
        bucketExists: false,
        bucketCreated: false,
        writable: false,
        latencyMs: Math.round(performance.now() - t0),
        probeLatencyMs: null,
        error: err instanceof Error ? err.message : "Failed to connect to R2 bucket",
      };
    }
  }

  const latencyMs = Math.round(performance.now() - t0);

  if (!options.runWriteProbe) {
    return {
      connected: true,
      bucketExists,
      bucketCreated,
      writable: null,
      latencyMs,
      probeLatencyMs: null,
      error: null,
    };
  }

  const probeKey = `.healthcheck/radiant-probe-${Date.now()}.txt`;
  const pt0 = performance.now();
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: cfg.bucketName,
        Key: probeKey,
        Body: Buffer.from(`ok:${new Date().toISOString()}`),
        ContentType: "text/plain",
      })
    );
    await s3.send(new GetObjectCommand({ Bucket: cfg.bucketName, Key: probeKey }));
    await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucketName, Key: probeKey }));
    return {
      connected: true,
      bucketExists,
      bucketCreated,
      writable: true,
      latencyMs,
      probeLatencyMs: Math.round(performance.now() - pt0),
      error: null,
    };
  } catch (probeErr) {
    return {
      connected: true,
      bucketExists,
      bucketCreated,
      writable: false,
      latencyMs,
      probeLatencyMs: Math.round(performance.now() - pt0),
      error: `Connected read-only; write probe failed: ${
        probeErr instanceof Error ? probeErr.message : "Unknown write error"
      }`,
    };
  }
}

function measureDirUsage(dirPath: string): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  if (!fs.existsSync(/*turbopackIgnore: true*/ dirPath)) return { bytes: 0, files: 0 };

  const walk = (p: string) => {
    for (const entry of fs.readdirSync(/*turbopackIgnore: true*/ p, { withFileTypes: true })) {
      const full = path.join(/*turbopackIgnore: true*/ p, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files++;
        bytes += fs.statSync(/*turbopackIgnore: true*/ full).size;
      }
    }
  };
  walk(dirPath);
  return { bytes, files };
}

function measureLocalDisk(): R2RealtimeStatus["localDisk"] {
  const cwd = process.cwd();
  const dataDir = path.resolve(/*turbopackIgnore: true*/ cwd, "data");
  let sqliteDbBytes = 0;
  for (const name of ["radiant.db", "radiant.db-wal", "radiant.db-shm"]) {
    const p = path.join(/*turbopackIgnore: true*/ dataDir, name);
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      sqliteDbBytes += fs.statSync(/*turbopackIgnore: true*/ p).size;
    }
  }

  const uploads = measureDirUsage(path.resolve(/*turbopackIgnore: true*/ cwd, "public", "uploads"));
  const logos = measureDirUsage(path.resolve(/*turbopackIgnore: true*/ cwd, "public", "logos"));
  return {
    sqliteDbBytes,
    uploadsBytes: uploads.bytes,
    uploadsFiles: uploads.files,
    logosBytes: logos.bytes,
    logosFiles: logos.files,
  };
}

export async function getR2RealtimeStatus(options: { runWriteProbe?: boolean } = {}): Promise<R2RealtimeStatus> {
  const cfg = await getR2Config();
  const envCand = getEnvR2Candidate();
  const localDisk = measureLocalDisk();

  const endpoint = cfg.accountId ? `https://${cfg.accountId}.r2.cloudflarestorage.com` : "";
  const effectivePublicUrl = cfg.publicUrl
    ? cfg.publicUrl
    : cfg.isConfigured
    ? `https://${cfg.bucketName}.${cfg.accountId}.r2.dev`
    : "";

  const base: R2RealtimeStatus = {
    checkedAt: new Date().toISOString(),
    configured: cfg.isConfigured,
    connected: false,
    writable: null,
    bucketExists: false,
    latencyMs: null,
    probeLatencyMs: null,
    error: null,
    bucketName: cfg.bucketName,
    accountIdMasked: maskSecret(cfg.accountId),
    accessKeyMasked: maskSecret(cfg.accessKeyId),
    endpoint,
    publicUrl: cfg.publicUrl,
    effectivePublicUrl,
    publicUrlReachable: null,
    envCandidate: {
      available: envCand.available,
      bucketName: envCand.bucketName,
      hasPublicUrl: Boolean(envCand.publicUrl),
    },
    bucketStats: null,
    localDisk,
  };

  if (!cfg.isConfigured) {
    return base;
  }

  const probe = await verifyAndAutoCreateBucket(cfg, {
    createIfMissing: false,
    runWriteProbe: options.runWriteProbe,
  });

  base.connected = probe.connected;
  base.bucketExists = probe.bucketExists;
  base.writable = probe.writable;
  base.latencyMs = probe.latencyMs;
  base.probeLatencyMs = probe.probeLatencyMs;
  base.error = probe.error;

  if (!probe.connected) {
    return base;
  }

  // Paginate ListObjectsV2 up to 10 pages (10,000 objects) for crisp live storage telemetry
  const s3 = createR2S3Client(cfg);
  const prefixes: Record<string, { count: number; bytes: number }> = {};
  const allSample: R2BucketObjectSample[] = [];
  let objectCount = 0;
  let totalBytes = 0;
  let truncated = false;
  let continuationToken: string | undefined;

  try {
    for (let page = 0; page < 10; page++) {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucketName,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of resp.Contents || []) {
        const key = obj.Key || "";
        const size = Number(obj.Size || 0);
        if (!key || key.startsWith(".healthcheck/")) continue;

        objectCount++;
        totalBytes += size;

        const topPrefix = key.includes("/") ? `${key.split("/")[0]}/` : "root/";
        if (!prefixes[topPrefix]) prefixes[topPrefix] = { count: 0, bytes: 0 };
        prefixes[topPrefix].count++;
        prefixes[topPrefix].bytes += size;

        allSample.push({
          key,
          size,
          lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
        });
      }

      if (!resp.IsTruncated || !resp.NextContinuationToken) break;
      if (page === 9) {
        truncated = true;
        break;
      }
      continuationToken = resp.NextContinuationToken;
    }

    allSample.sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
    base.bucketStats = {
      objectCount,
      totalBytes,
      truncated,
      prefixes,
      recentObjects: allSample.slice(0, 12),
    };
  } catch (listErr) {
    base.error = base.error || (listErr instanceof Error ? listErr.message : "Unable to list R2 objects");
  }

  // Optional fast public CDN domain reachability check
  if (cfg.publicUrl) {
    try {
      const cdnRes = await fetch(cfg.publicUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
      });
      // R2 custom domains return 200, 403, or 404 when root object isn't present — all prove DNS + TLS + edge are live
      base.publicUrlReachable = cdnRes.status > 0 && cdnRes.status < 500;
    } catch {
      base.publicUrlReachable = false;
    }
  }

  return base;
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function uploadBufferToR2FixedKey(params: {
  buffer: Buffer;
  key: string;
  mimeType: string;
  cfg?: R2Config;
}): Promise<{ url: string; key: string; size: number }> {
  const r2 = params.cfg || (await getR2Config());
  if (!r2.isConfigured) {
    throw new Error("Cloudflare R2 is not configured.");
  }

  const s3 = createR2S3Client(r2);
  await s3.send(
    new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = r2.publicUrl
    ? `${r2.publicUrl}/${params.key}`
    : `https://${r2.bucketName}.${r2.accountId}.r2.dev/${params.key}`;

  return { url, key: params.key, size: params.buffer.length };
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
    const uploaded = await uploadBufferToR2FixedKey({
      buffer: params.buffer,
      key,
      mimeType: params.mimeType,
      cfg: r2,
    });

    return {
      url: uploaded.url,
      key,
      storage: "r2",
      fileName: params.fileName,
      fileSize: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  // Local fallback until R2 credentials are entered in Admin Settings / Storage
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

  const s3 = createR2S3Client(r2);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: r2.bucketName,
      Key: key,
    })
  );
}
